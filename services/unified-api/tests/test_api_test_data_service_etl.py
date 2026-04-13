import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock
from json import JSONDecodeError

import pytest
import httpx

from schemas.api_test_data import ExecutionResult
from services import api_test_data_service as service_module
from services.api_test_data_service import ApiTestDataService


class DummyDb:
    def __init__(self):
        self.execute = AsyncMock()
        self.execute_one = AsyncMock()
        self.fetch = AsyncMock()


def test_substitute_variables_nested_payload():
    service = ApiTestDataService(DummyDb())

    payload = {
        "message": "Hello {{name}}",
        "items": ["{{first}}", "{{second}}", "{{missing}}"],
        "meta": {"count": 2, "active": True},
    }

    result = service._substitute_variables_in_dict(
        payload,
        {"name": "Wakeb", "first": "A", "second": "B"},
    )

    assert result["message"] == "Hello Wakeb"
    assert result["items"] == ["A", "B", "{{missing}}"]
    assert result["meta"] == {"count": 2, "active": True}


def test_add_authentication_variants():
    service = ApiTestDataService(DummyDb())

    bearer_headers = service._add_authentication({}, "bearer", {"token": "abc123"})
    assert bearer_headers["Authorization"] == "Bearer abc123"

    api_key_headers = service._add_authentication({}, "api_key", {"header_name": "X-Token", "api_key": "k1"})
    assert api_key_headers["X-Token"] == "k1"

    basic_headers = service._add_authentication({}, "basic", {"username": "u", "password": "p"})
    assert basic_headers["Authorization"].startswith("Basic ")


def test_simple_path_extract_supports_dicts_and_lists():
    service = ApiTestDataService(DummyDb())
    body = {"data": {"users": [{"id": "u1"}, {"id": "u2"}]}}

    assert service._simple_path_extract(body, "$.data.users.1.id") == "u2"
    assert service._simple_path_extract(body, "$.data.users.5.id") is None
    assert service._simple_path_extract(body, "$.data.unknown") is None


def test_extract_variables_fallback_with_default_and_required():
    service = ApiTestDataService(DummyDb())
    response_body = {"data": {"booking": {"id": "b-100"}}}

    extractors = [
        {"name": "booking_id", "json_path": "$.data.booking.id", "required": True},
        {"name": "booking_status", "json_path": "$.data.booking.status", "default_value": "created"},
        {"name": "missing_required", "json_path": "$.data.booking.ref", "required": True},
    ]

    extracted = service._extract_variables(response_body, extractors)

    assert extracted["booking_id"] == "b-100"
    assert extracted["booking_status"] == "created"
    assert "missing_required" not in extracted


def test_log_execution_redacts_sensitive_headers():
    db = DummyDb()
    service = ApiTestDataService(db)

    asyncio.run(
        service._log_execution(
            setup_id="setup-1",
            template_id="tpl-1",
            request_url="https://example.com/api",
            request_method="POST",
            request_headers={
                "Authorization": "Bearer secret",
                "X-API-Key": "secret-key",
                "Content-Type": "application/json",
            },
            request_body={"a": 1},
            response_status=201,
            response_body={"ok": True},
            extracted_variables={"id": "x"},
            duration_ms=25,
            success=True,
            error_message=None,
            executed_by="user-1",
        )
    )

    assert db.execute.await_count == 1
    args = db.execute.await_args.args
    safe_headers = json.loads(args[5])
    assert safe_headers["Authorization"] == "***"
    assert safe_headers["X-API-Key"] == "***"
    assert safe_headers["Content-Type"] == "application/json"


def test_execute_multiple_setups_chains_variables_across_results():
    service = ApiTestDataService(DummyDb())

    async def fake_execute_setup(setup_id, variable_overrides=None, executed_by=None, dry_run=False):
        incoming = dict(variable_overrides or {})
        if setup_id == "s1":
            assert incoming == {"seed": "v"}
            return ExecutionResult(
                setup_id="s1",
                setup_name="First",
                success=True,
                request_url="u",
                request_method="POST",
                duration_ms=10,
                extracted_variables={"token": "t-1"},
                error_message=None,
                executed_at=datetime.utcnow(),
            )

        assert incoming == {"seed": "v", "token": "t-1"}
        return ExecutionResult(
            setup_id="s2",
            setup_name="Second",
            success=False,
            request_url="u",
            request_method="POST",
            duration_ms=10,
            extracted_variables={"ignored": "x"},
            error_message="boom",
            executed_at=datetime.utcnow(),
        )

    service.execute_setup = fake_execute_setup

    ok, combined, results = asyncio.run(
        service.execute_multiple_setups(["s1", "s2"], {"seed": "v"}, "u1")
    )

    assert ok is False
    assert len(results) == 2
    assert combined == {"seed": "v", "token": "t-1"}


@pytest.mark.parametrize(
    "template,variables,expected",
    [
        ("{{a}}", {"a": "1"}, "1"),
        ("x-{{a}}-y", {"a": "b"}, "x-b-y"),
        ("{{a}}/{{b}}", {"a": "p", "b": "q"}, "p/q"),
        ("{{missing}}", {}, "{{missing}}"),
        ("value={{num}}", {"num": 7}, "value=7"),
        ("bool={{flag}}", {"flag": True}, "bool=True"),
        ("repeat {{a}} {{a}}", {"a": "k"}, "repeat k k"),
        ("mixed {{a}} {{missing}}", {"a": "ok"}, "mixed ok {{missing}}"),
    ],
)
def test_substitute_variables_parametrized(template, variables, expected):
    service = ApiTestDataService(DummyDb())
    assert service._substitute_variables(template, variables) == expected


@pytest.mark.parametrize(
    "path,expected",
    [
        ("$.data.id", "a1"),
        ("$", {"data": {"id": "a1", "items": [{"v": 10}, {"v": 20}]}, "ok": True}),
        ("$.data.items.0.v", 10),
        ("$.data.items.1.v", 20),
        ("$.data.items.2.v", None),
        ("$.ok", True),
        ("$.missing", None),
        ("data.id", "a1"),
        ("$.data.items.1", {"v": 20}),
        ("$.data.items.bad", None),
    ],
)
def test_simple_path_extract_parametrized(path, expected):
    service = ApiTestDataService(DummyDb())
    obj = {"data": {"id": "a1", "items": [{"v": 10}, {"v": 20}]}, "ok": True}
    assert service._simple_path_extract(obj, path) == expected


@pytest.mark.parametrize(
    "auth_type,config,expected_header,expected_value",
    [
        ("bearer", {"token": "t1"}, "Authorization", "Bearer t1"),
        ("api_key", {"header_name": "X-Key", "api_key": "k1"}, "X-Key", "k1"),
        ("api_key", {"api_key": "k2"}, "X-API-Key", "k2"),
        ("none", {}, None, None),
        ("bearer", {"token": ""}, None, None),
        ("basic", {"username": "u", "password": "p"}, "Authorization", "Basic dTpw"),
    ],
)
def test_add_authentication_parametrized(auth_type, config, expected_header, expected_value):
    service = ApiTestDataService(DummyDb())
    result = service._add_authentication({}, auth_type, config)
    if expected_header is None:
        assert result == {}
    else:
        assert result[expected_header] == expected_value


@pytest.mark.parametrize(
    "extractors,expected",
    [
        ([{"name": "id", "json_path": "$.data.id"}], {"id": "u1"}),
        ([{"name": "missing", "json_path": "$.data.zz", "default_value": "d"}], {"missing": "d"}),
        ([{"name": "bad", "json_path": "$.data.zz", "required": True}], {}),
        ([{"name": "", "json_path": "$.data.id"}], {}),
        ([{"name": "id", "json_path": ""}], {}),
        (
            [
                {"name": "id", "json_path": "$.data.id"},
                {"name": "role", "json_path": "$.data.role", "default_value": "guest"},
            ],
            {"id": "u1", "role": "guest"},
        ),
    ],
)
def test_extract_variables_parametrized(extractors, expected, monkeypatch):
    service = ApiTestDataService(DummyDb())
    monkeypatch.setattr(service_module, "JSONPATH_AVAILABLE", False)
    monkeypatch.setattr(service_module, "jsonpath_parse", None)
    body = {"data": {"id": "u1"}}
    assert service._extract_variables(body, extractors) == expected


def test_execute_setups_for_prompt_returns_empty_when_no_links():
    db = DummyDb()
    db.fetch.return_value = []
    service = ApiTestDataService(db)

    ok, combined, results = asyncio.run(service.execute_setups_for_prompt("p1", {"x": 1}, "u1"))

    assert ok is True
    assert combined == {}
    assert results == []


def test_execute_setups_for_prompt_chains_extracted_vars():
    db = DummyDb()
    db.fetch.return_value = [{"setup_id": "s1", "name": "One"}, {"setup_id": "s2", "name": "Two"}]
    service = ApiTestDataService(db)

    async def fake_execute_setup(setup_id, variable_overrides=None, executed_by=None, dry_run=False):
        if setup_id == "s1":
            assert variable_overrides == {"seed": "a"}
            return ExecutionResult(
                setup_id="s1",
                setup_name="One",
                success=True,
                request_url="u",
                request_method="POST",
                duration_ms=1,
                extracted_variables={"id": "1"},
                error_message=None,
                executed_at=datetime.utcnow(),
            )
        assert variable_overrides == {"seed": "a", "id": "1"}
        return ExecutionResult(
            setup_id="s2",
            setup_name="Two",
            success=True,
            request_url="u",
            request_method="POST",
            duration_ms=1,
            extracted_variables={"token": "t"},
            error_message=None,
            executed_at=datetime.utcnow(),
        )

    service.execute_setup = fake_execute_setup
    ok, combined, results = asyncio.run(service.execute_setups_for_prompt("p1", {"seed": "a"}, "u1"))

    assert ok is True
    assert len(results) == 2
    assert combined == {"seed": "a", "id": "1", "token": "t"}


def test_execute_setup_dry_run_builds_request_without_network():
    db = DummyDb()
    db.execute_one.return_value = {
        "id": "s1",
        "name": "Create user",
        "custom_variables": {"name": "Wakeb"},
        "output_variables": [],
        "template_id": "t1",
        "template_name": "temp",
        "http_method": "post",
        "path": "/users/{{name}}",
        "template_headers": {"X-Tpl": "{{name}}"},
        "request_body_template": {"name": "{{name}}"},
        "expected_status_codes": [201],
        "response_extractors": [],
        "endpoint_id": "e1",
        "base_url": "https://api.example.com",
        "auth_type": "none",
        "auth_config": {},
        "endpoint_headers": {"X-Env": "test"},
        "timeout_seconds": 5,
        "retry_count": 0,
        "data_set_variables": {"unused": "x"},
    }
    service = ApiTestDataService(db)

    result = asyncio.run(service.execute_setup("s1", dry_run=True))

    assert result.success is True
    assert result.request_url == "https://api.example.com/users/Wakeb"
    assert result.request_method == "POST"
    assert result.error_message == "Dry run - not executed"


def test_execute_setup_returns_not_found_when_setup_missing():
    db = DummyDb()
    db.execute_one.return_value = None
    service = ApiTestDataService(db)
    result = asyncio.run(service.execute_setup("missing-id"))
    assert result.success is False
    assert "not found" in (result.error_message or "").lower()


def test_log_execution_handles_db_failure_gracefully():
    db = DummyDb()
    db.execute.side_effect = Exception("db down")
    service = ApiTestDataService(db)

    asyncio.run(
        service._log_execution(
            setup_id="s",
            template_id="t",
            request_url="u",
            request_method="GET",
            request_headers={"Authorization": "secret"},
            request_body=None,
            response_status=None,
            response_body=None,
            extracted_variables={},
            duration_ms=1,
            success=False,
            error_message="x",
            executed_by=None,
        )
    )

    assert db.execute.await_count == 1


def test_execute_request_success_and_json_body(monkeypatch):
    service = ApiTestDataService(DummyDb())

    class FakeResponse:
        status_code = 201

        @staticmethod
        def json():
            return {"ok": True}

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url, headers=None, json=None):
            assert method == "POST"
            assert url == "https://api.example.com"
            assert headers["Content-Type"] == "application/json"
            assert json == {"x": 1}
            return FakeResponse()

    monkeypatch.setattr(service_module.httpx, "AsyncClient", FakeClient)

    status, body, err = asyncio.run(
        service._execute_request("POST", "https://api.example.com", {}, {"x": 1}, timeout=3, retry_count=0)
    )
    assert status == 201
    assert body == {"ok": True}
    assert err is None


def test_execute_request_handles_non_json_response(monkeypatch):
    service = ApiTestDataService(DummyDb())

    class FakeResponse:
        status_code = 200
        text = "plain-text-response"

        @staticmethod
        def json():
            raise JSONDecodeError("bad", "x", 0)

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url, headers=None, json=None):
            return FakeResponse()

    monkeypatch.setattr(service_module.httpx, "AsyncClient", FakeClient)

    status, body, err = asyncio.run(
        service._execute_request("GET", "https://api.example.com", {}, None, timeout=3, retry_count=0)
    )
    assert status == 200
    assert body == {"_raw_text": "plain-text-response"}
    assert err is None


def test_execute_request_timeout_with_retries(monkeypatch):
    service = ApiTestDataService(DummyDb())

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url, headers=None, json=None):
            raise httpx.TimeoutException("timeout")

    sleeps = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(service_module.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(service_module.asyncio, "sleep", fake_sleep)

    status, body, err = asyncio.run(
        service._execute_request("GET", "https://api.example.com", {}, None, timeout=2, retry_count=2)
    )
    assert status is None
    assert body is None
    assert "Timeout after 2s" in (err or "")
    assert sleeps == [1, 2]


def test_execute_request_unexpected_error_stops_retries(monkeypatch):
    service = ApiTestDataService(DummyDb())

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url, headers=None, json=None):
            raise RuntimeError("boom")

    monkeypatch.setattr(service_module.httpx, "AsyncClient", FakeClient)

    status, body, err = asyncio.run(
        service._execute_request("GET", "https://api.example.com", {}, None, timeout=2, retry_count=3)
    )
    assert status is None
    assert body is None
    assert "Unexpected error" in (err or "")

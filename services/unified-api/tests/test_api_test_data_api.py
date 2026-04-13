import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from api import api_test_data_api as api_module
from schemas.api_test_data import ApiEndpointCreate, AuthType, ExecuteSetupRequest, ExecutionResult


class DummyDb:
    def __init__(self):
        self.fetch = AsyncMock()
        self.execute_one = AsyncMock()


@pytest.mark.parametrize(
    "message,expected",
    [
        ('schema "api_tests" does not exist', True),
        ('relation "api_tests.data_templates" does not exist', True),
        ('relation "api_tests.api_endpoints" does not exist', True),
        ('relation "api_tests.execution_history" does not exist', True),
        ('network timeout', False),
        ('permission denied for schema api_tests', False),
    ],
)
def test_missing_schema_error_detection(message, expected):
    assert api_module._is_missing_api_test_data_schema_error(Exception(message)) is expected


def test_get_project_id_returns_explicit_value():
    db = DummyDb()
    result = asyncio.run(api_module.get_project_id("proj-explicit", None, db))
    assert result == "proj-explicit"


def test_get_project_id_from_current_user_project():
    db = DummyDb()
    user = type("U", (), {})()
    project = type("P", (), {"id": "proj-user"})()
    user.project = project
    current_user = type("CU", (), {"project": user.project, "user": None})()

    result = asyncio.run(api_module.get_project_id(None, current_user, db))
    assert result == "proj-user"


def test_get_project_id_fallback_active_project_query():
    db = DummyDb()
    db.execute_one.return_value = {"id": "proj-latest"}

    result = asyncio.run(api_module.get_project_id(None, None, db))

    assert result == "proj-latest"
    assert "is_active = true" in db.execute_one.await_args.args[0]


def test_get_project_id_fallback_when_active_query_fails():
    db = DummyDb()
    db.execute_one.side_effect = [Exception("column missing"), {"id": "proj-fallback"}]

    result = asyncio.run(api_module.get_project_id(None, None, db))

    assert result == "proj-fallback"
    assert db.execute_one.await_count == 2


def test_get_project_id_raises_when_no_project_found():
    db = DummyDb()
    db.execute_one.side_effect = [None]

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_project_id(None, None, db))

    assert exc.value.status_code == 400


def test_get_user_id_from_current_user():
    db = DummyDb()
    user = type("U", (), {"id": "user-ctx"})()
    current_user = type("CU", (), {"user": user, "project": None})()
    result = asyncio.run(api_module.get_user_id(current_user, db))
    assert result == "user-ctx"


def test_get_user_id_from_database_lookup():
    db = DummyDb()
    db.execute_one.return_value = {"id": "user-db"}
    result = asyncio.run(api_module.get_user_id(None, db))
    assert result == "user-db"


def test_get_user_id_returns_none_if_missing():
    db = DummyDb()
    db.execute_one.return_value = None
    result = asyncio.run(api_module.get_user_id(None, db))
    assert result is None


def test_list_api_endpoints_graceful_when_schema_missing():
    db = DummyDb()
    db.execute_one.side_effect = [{"id": "p-1"}]
    db.fetch.side_effect = Exception('schema "api_tests" does not exist')

    result = asyncio.run(api_module.list_api_endpoints(db=db, current_user=None))

    assert result["success"] is True
    assert result["data"] == []
    assert result["count"] == 0
    assert "schema" in result["message"].lower()


def test_list_api_endpoints_success_formats_ids_and_filters():
    db = DummyDb()
    db.execute_one.return_value = {"id": "proj-1"}
    db.fetch.return_value = [
        {
            "id": "ep-1",
            "project_id": "proj-1",
            "name": "Orders",
            "description": None,
            "base_url": "https://api.example.com",
            "auth_type": "none",
            "default_headers": {},
            "timeout_seconds": 30,
            "retry_count": 2,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": "user-1",
        }
    ]

    result = asyncio.run(api_module.list_api_endpoints(project_id=None, is_active=True, current_user=None, db=db))
    assert result["success"] is True
    assert result["count"] == 1
    assert result["data"][0]["id"] == "ep-1"
    assert result["data"][0]["project_id"] == "proj-1"
    assert result["data"][0]["created_by"] == "user-1"
    fetch_args = db.fetch.await_args.args
    assert "AND is_active = $2" in fetch_args[0]
    assert fetch_args[1] == "proj-1"
    assert fetch_args[2] is True


def test_list_api_endpoints_raises_500_on_unhandled_error():
    db = DummyDb()
    db.execute_one.return_value = {"id": "proj-1"}
    db.fetch.side_effect = Exception("random failure")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.list_api_endpoints(db=db, current_user=None))

    assert exc.value.status_code == 500


def test_create_api_endpoint_serializes_json_fields_and_ids():
    db = DummyDb()
    db.execute_one.side_effect = [
        {"id": "user-1"},
        {
            "id": "ep-1",
            "project_id": "proj-1",
            "name": "Payments",
            "description": "Payment API",
            "base_url": "https://api.example.com",
            "auth_type": "bearer",
            "default_headers": {"X-App": "self-healing"},
            "timeout_seconds": 30,
            "retry_count": 3,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": "user-1",
        }
    ]

    payload = ApiEndpointCreate(
        name="Payments",
        description="Payment API",
        base_url="https://api.example.com",
        auth_type=AuthType.BEARER,
        auth_config={"token": "abc"},
        default_headers={"X-App": "self-healing"},
        timeout_seconds=30,
        retry_count=3,
        is_active=True,
        project_id="proj-1",
    )

    result = asyncio.run(api_module.create_api_endpoint(payload, current_user=None, db=db))

    assert result["success"] is True
    assert result["data"]["id"] == "ep-1"
    assert result["data"]["project_id"] == "proj-1"

    args = db.execute_one.await_args.args
    assert args[1] == "proj-1"
    assert args[5] == "bearer"
    assert json.loads(args[6]) == {"token": "abc"}
    assert json.loads(args[7]) == {"X-App": "self-healing"}


def test_update_api_endpoint_rejects_empty_payload():
    db = DummyDb()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.update_api_endpoint("ep-1", api_module.ApiEndpointUpdate(), current_user=None, db=db))

    assert exc.value.status_code == 400
    assert "No fields to update" in str(exc.value.detail)


def test_update_api_endpoint_serializes_fields_and_returns_data():
    db = DummyDb()
    db.execute_one.return_value = {
        "id": "ep-1",
        "name": "Updated",
        "description": "new",
        "base_url": "https://api.example.com",
        "auth_type": "bearer",
        "is_active": True,
        "updated_at": datetime.utcnow(),
    }

    payload = api_module.ApiEndpointUpdate(
        auth_type=AuthType.BEARER,
        auth_config={"token": "xyz"},
        default_headers={"X-A": "1"},
        is_active=True,
    )

    result = asyncio.run(api_module.update_api_endpoint("ep-1", payload, current_user=None, db=db))
    assert result["success"] is True
    assert result["data"]["id"] == "ep-1"
    args = db.execute_one.await_args.args
    assert "UPDATE api_tests.api_endpoints" in args[0]
    assert "bearer" in args
    assert json.dumps({"token": "xyz"}) in args
    assert json.dumps({"X-A": "1"}) in args


def test_update_api_endpoint_returns_404_when_missing():
    db = DummyDb()
    db.execute_one.return_value = None

    payload = api_module.ApiEndpointUpdate(name="x")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.update_api_endpoint("missing", payload, current_user=None, db=db))

    assert exc.value.status_code == 404


def test_execute_test_data_setup_requires_selector():
    db = DummyDb()

    request = ExecuteSetupRequest(variable_overrides={"x": 1})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.execute_test_data_setup(request, current_user=None, db=db))

    assert exc.value.status_code == 400
    assert "Must provide setup_id, setup_ids, or prompt_id" in str(exc.value.detail)


def test_execute_test_data_setup_single_path(monkeypatch):
    db = DummyDb()

    async def fake_get_user_id(current_user, db_obj):
        return "user-1"

    class FakeService:
        def __init__(self, db_obj):
            self.db_obj = db_obj

        async def execute_setup(self, setup_id, variable_overrides=None, executed_by=None, dry_run=False):
            assert setup_id == "setup-1"
            assert variable_overrides == {"seed": "v"}
            assert executed_by == "user-1"
            assert dry_run is False
            return ExecutionResult(
                setup_id="setup-1",
                setup_name="Create user",
                success=True,
                request_url="https://api.example.com/users",
                request_method="POST",
                response_status=201,
                duration_ms=42,
                extracted_variables={"user_id": "u-9"},
                error_message=None,
                executed_at=datetime.utcnow(),
            )

    monkeypatch.setattr(api_module, "get_user_id", fake_get_user_id)
    monkeypatch.setattr(api_module, "ApiTestDataService", FakeService)

    request = ExecuteSetupRequest(setup_id="setup-1", variable_overrides={"seed": "v"})
    response = asyncio.run(api_module.execute_test_data_setup(request, current_user=None, db=db))

    assert response["success"] is True
    data = response["data"]
    assert data["total_setups"] == 1
    assert data["successful_setups"] == 1
    assert data["failed_setups"] == 0
    assert data["combined_variables"] == {"seed": "v", "user_id": "u-9"}


def test_execute_test_data_setup_setup_ids_branch(monkeypatch):
    db = DummyDb()

    async def fake_get_user_id(current_user, db_obj):
        return "user-1"

    class FakeService:
        def __init__(self, db_obj):
            self.db_obj = db_obj

        async def execute_multiple_setups(self, setup_ids, variable_overrides=None, executed_by=None):
            assert setup_ids == ["s1", "s2"]
            assert variable_overrides == {"seed": "v"}
            assert executed_by == "user-1"
            return True, {"seed": "v", "x": "1"}, [
                ExecutionResult(
                    setup_id="s1",
                    setup_name="a",
                    success=True,
                    request_url="u",
                    request_method="POST",
                    duration_ms=1,
                    extracted_variables={"x": "1"},
                    error_message=None,
                    executed_at=datetime.utcnow(),
                ),
                ExecutionResult(
                    setup_id="s2",
                    setup_name="b",
                    success=True,
                    request_url="u",
                    request_method="POST",
                    duration_ms=1,
                    extracted_variables={},
                    error_message=None,
                    executed_at=datetime.utcnow(),
                ),
            ]

    monkeypatch.setattr(api_module, "get_user_id", fake_get_user_id)
    monkeypatch.setattr(api_module, "ApiTestDataService", FakeService)

    request = ExecuteSetupRequest(setup_ids=["s1", "s2"], variable_overrides={"seed": "v"})
    response = asyncio.run(api_module.execute_test_data_setup(request, current_user=None, db=db))
    assert response["success"] is True
    assert response["data"]["total_setups"] == 2


def test_execute_test_data_setup_prompt_branch(monkeypatch):
    db = DummyDb()

    async def fake_get_user_id(current_user, db_obj):
        return "user-1"

    class FakeService:
        def __init__(self, db_obj):
            self.db_obj = db_obj

        async def execute_setups_for_prompt(self, prompt_id, variable_overrides=None, executed_by=None):
            assert prompt_id == "p-1"
            assert variable_overrides == {"seed": "v"}
            assert executed_by == "user-1"
            return False, {"seed": "v"}, [
                ExecutionResult(
                    setup_id="s1",
                    setup_name="a",
                    success=False,
                    request_url="u",
                    request_method="POST",
                    duration_ms=1,
                    extracted_variables={},
                    error_message="boom",
                    executed_at=datetime.utcnow(),
                )
            ]

    monkeypatch.setattr(api_module, "get_user_id", fake_get_user_id)
    monkeypatch.setattr(api_module, "ApiTestDataService", FakeService)

    request = ExecuteSetupRequest(prompt_id="p-1", variable_overrides={"seed": "v"})
    response = asyncio.run(api_module.execute_test_data_setup(request, current_user=None, db=db))
    assert response["success"] is True
    assert response["data"]["failed_setups"] == 1


def test_dry_run_setup_enables_flag(monkeypatch):
    db = DummyDb()

    async def fake_execute_test_data_setup(request, current_user, db_obj):
        assert request.dry_run is True
        return {"success": True, "data": {"dry_run": True}}

    monkeypatch.setattr(api_module, "execute_test_data_setup", fake_execute_test_data_setup)

    request = ExecuteSetupRequest(setup_id="s1")
    response = asyncio.run(api_module.dry_run_setup(request, current_user=None, db=db))
    assert response["success"] is True
    assert response["data"]["dry_run"] is True


def test_get_template_categories_success():
    db = DummyDb()
    db.fetch.return_value = [{"category": "booking"}, {"category": "users"}]
    result = asyncio.run(api_module.get_template_categories(db=db))
    assert result == {"success": True, "data": ["booking", "users"]}


def test_get_template_categories_raises_500_on_failure():
    db = DummyDb()
    db.fetch.side_effect = Exception("db")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_template_categories(db=db))
    assert exc.value.status_code == 500

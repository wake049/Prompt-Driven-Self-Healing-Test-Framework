import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from api import api_test_data_api as api_module
from schemas.api_test_data import (
    ApiEndpointCreate,
    AuthType,
    DataSetCreate,
    DataSetUpdate,
    DataTemplateCreate,
    DataTemplateUpdate,
    ExecuteSetupRequest,
    ExecutionResult,
    LinkSetupToPromptRequest,
    TestDataSetupCreate as SetupCreateModel,
    TestDataSetupUpdate as SetupUpdateModel,
)


class DummyDb:
    def __init__(self):
        self.fetch = AsyncMock()
        self.execute_one = AsyncMock()


def test_create_api_endpoint_raises_500_on_db_failure():
    db = DummyDb()
    db.execute_one.side_effect = Exception("db write failed")

    payload = ApiEndpointCreate(
        name="Orders",
        description="Orders API",
        base_url="https://api.example.com",
        auth_type=AuthType.NONE,
        auth_config={},
        default_headers={},
        timeout_seconds=30,
        retry_count=1,
        is_active=True,
        project_id="proj-1",
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.create_api_endpoint(payload, current_user=None, db=db))

    assert exc.value.status_code == 500


def test_get_api_endpoint_success_not_found_and_error():
    db = DummyDb()
    db.execute_one.return_value = {
        "id": "ep-1",
        "project_id": "proj-1",
        "name": "Orders",
        "auth_type": "none",
        "auth_config": {},
        "default_headers": {},
        "timeout_seconds": 30,
        "retry_count": 1,
        "is_active": True,
    }

    success = asyncio.run(api_module.get_api_endpoint("ep-1", current_user=None, db=db))
    assert success["success"] is True
    assert success["data"]["id"] == "ep-1"
    assert success["data"]["project_id"] == "proj-1"

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as not_found:
        asyncio.run(api_module.get_api_endpoint("missing", current_user=None, db=db))
    assert not_found.value.status_code == 404

    db.execute_one.side_effect = Exception("db read failed")
    with pytest.raises(HTTPException) as internal:
        asyncio.run(api_module.get_api_endpoint("ep-1", current_user=None, db=db))
    assert internal.value.status_code == 500


def test_delete_api_endpoint_success_not_found_and_error():
    db = DummyDb()
    db.execute_one.return_value = {"id": "ep-1"}

    deleted = asyncio.run(api_module.delete_api_endpoint("ep-1", current_user=None, db=db))
    assert deleted["success"] is True

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as not_found:
        asyncio.run(api_module.delete_api_endpoint("missing", current_user=None, db=db))
    assert not_found.value.status_code == 404

    db.execute_one.side_effect = Exception("db delete failed")
    with pytest.raises(HTTPException) as internal:
        asyncio.run(api_module.delete_api_endpoint("ep-1", current_user=None, db=db))
    assert internal.value.status_code == 500


def test_list_data_templates_with_all_filters_and_formatting():
    db = DummyDb()
    db.fetch.return_value = [
        {
            "id": "t1",
            "endpoint_id": "e1",
            "name": "Create user",
            "description": "desc",
            "category": "user",
            "http_method": "POST",
            "path": "/users",
            "expected_status_codes": [201],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "endpoint_name": "Users API",
        }
    ]

    result = asyncio.run(
        api_module.list_data_templates(
            endpoint_id="e1",
            category="user",
            is_active=True,
            search="create",
            current_user=None,
            db=db,
        )
    )

    assert result["success"] is True
    assert result["count"] == 1
    assert result["data"][0]["id"] == "t1"
    assert result["data"][0]["endpoint_id"] == "e1"
    query = db.fetch.await_args.args[0]
    assert "t.endpoint_id" in query
    assert "t.category" in query
    assert "t.is_active" in query
    assert "ILIKE" in query


def test_list_data_templates_raises_500_on_error():
    db = DummyDb()
    db.fetch.side_effect = Exception("db failed")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.list_data_templates(db=db, current_user=None))

    assert exc.value.status_code == 500


def test_create_data_template_serializes_extractors_and_payload():
    db = DummyDb()
    db.execute_one.side_effect = [
        {"id": "user-1"},
        {
            "id": "t1",
            "endpoint_id": "e1",
            "name": "Create user",
            "description": "desc",
            "category": "user",
            "http_method": "POST",
            "path": "/users",
            "request_headers": {"X-A": "1"},
            "request_body_template": {"name": "x"},
            "expected_status_codes": [201],
            "response_extractors": [{"name": "id", "json_path": "$.data.id"}],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        },
    ]

    payload = DataTemplateCreate(
        endpoint_id="e1",
        name="Create user",
        description="desc",
        category="user",
        http_method="POST",
        path="/users",
        request_headers={"X-A": "1"},
        request_body_template={"name": "x"},
        expected_status_codes=[201],
        response_extractors=[{"name": "id", "json_path": "$.data.id", "required": True}],
        is_active=True,
    )

    result = asyncio.run(api_module.create_data_template(payload, current_user=None, db=db))
    assert result["success"] is True
    assert result["data"]["id"] == "t1"
    args = db.execute_one.await_args.args
    assert args[1] == "e1"
    assert json.loads(args[7]) == {"X-A": "1"}
    assert json.loads(args[8]) == {"name": "x"}
    assert json.loads(args[10])[0]["name"] == "id"


def test_create_data_template_raises_500_on_error():
    db = DummyDb()
    db.execute_one.side_effect = Exception("insert failed")

    payload = DataTemplateCreate(
        endpoint_id="e1",
        name="Create user",
        description="desc",
        category="user",
        http_method="POST",
        path="/users",
        request_headers={},
        request_body_template={"name": "x"},
        expected_status_codes=[201],
        response_extractors=[{"name": "id", "json_path": "$.id", "required": True}],
        is_active=True,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.create_data_template(payload, current_user=None, db=db))
    assert exc.value.status_code == 500


def test_get_data_template_success_and_not_found():
    db = DummyDb()
    db.execute_one.return_value = {
        "id": "t1",
        "endpoint_id": "e1",
        "name": "A",
        "path": "/a",
    }
    result = asyncio.run(api_module.get_data_template("t1", current_user=None, db=db))
    assert result["data"]["id"] == "t1"
    assert result["data"]["endpoint_id"] == "e1"

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_data_template("missing", current_user=None, db=db))
    assert exc.value.status_code == 404


def test_update_data_template_branches():
    db = DummyDb()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.update_data_template("t1", DataTemplateUpdate(), current_user=None, db=db))
    assert exc.value.status_code == 400

    db.execute_one.return_value = {
        "id": "t1",
        "name": "Updated",
        "description": "d",
        "category": "user",
        "http_method": "POST",
        "path": "/users",
        "is_active": True,
        "updated_at": datetime.utcnow(),
    }
    payload = DataTemplateUpdate(
        request_headers={"X-B": "2"},
        request_body_template={"email": "a@b.c"},
        response_extractors=[{"name": "id", "json_path": "$.id"}],
        is_active=True,
    )
    result = asyncio.run(api_module.update_data_template("t1", payload, current_user=None, db=db))
    assert result["success"] is True
    args = db.execute_one.await_args.args
    assert "UPDATE api_tests.data_templates" in args[0]
    assert json.dumps({"X-B": "2"}) in args
    assert json.dumps({"email": "a@b.c"}) in args

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc2:
        asyncio.run(api_module.update_data_template("missing", DataTemplateUpdate(name="x"), current_user=None, db=db))
    assert exc2.value.status_code == 404


def test_delete_data_template_branches():
    db = DummyDb()
    db.execute_one.return_value = {"id": "t1"}
    assert asyncio.run(api_module.delete_data_template("t1", current_user=None, db=db))["success"] is True

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.delete_data_template("missing", current_user=None, db=db))
    assert exc.value.status_code == 404


def test_list_template_library_returns_all_templates():
    result = asyncio.run(api_module.list_template_library())
    assert result["success"] is True
    assert set(result["available_types"]) == {"booking", "user", "order", "payment"}
    assert set(result["data"].keys()) == {"booking", "user", "order", "payment"}


def test_list_data_sets_with_tags_and_template_filter():
    db = DummyDb()
    db.fetch.return_value = [
        {
            "id": "ds1",
            "template_id": "t1",
            "name": "Smoke users",
            "description": "desc",
            "variables": {"email": "a@b.c"},
            "is_default": False,
            "tags": ["smoke", "api"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "template_name": "Create user",
            "template_category": "user",
        }
    ]
    result = asyncio.run(api_module.list_data_sets(template_id="t1", tags="smoke,api", current_user=None, db=db))
    assert result["success"] is True
    assert result["count"] == 1
    assert result["data"][0]["id"] == "ds1"
    q = db.fetch.await_args.args[0]
    assert "ds.template_id" in q
    assert "ds.tags" in q


def test_list_data_sets_raises_500_on_error():
    db = DummyDb()
    db.fetch.side_effect = Exception("db")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.list_data_sets(db=db, current_user=None))
    assert exc.value.status_code == 500


def test_create_data_set_serializes_variables():
    db = DummyDb()
    db.execute_one.side_effect = [
        {"id": "user-1"},
        {
            "id": "ds1",
            "template_id": "t1",
            "name": "x",
            "description": None,
            "variables": {"a": 1},
            "is_default": False,
            "tags": ["smoke"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        },
    ]

    payload = DataSetCreate(
        template_id="t1",
        name="x",
        description=None,
        variables={"a": 1},
        is_default=False,
        tags=["smoke"],
    )
    result = asyncio.run(api_module.create_data_set(payload, current_user=None, db=db))
    assert result["success"] is True
    args = db.execute_one.await_args.args
    assert args[1] == "t1"
    assert json.loads(args[4]) == {"a": 1}


def test_create_data_set_raises_500_on_error():
    db = DummyDb()
    db.execute_one.side_effect = Exception("insert failed")

    payload = DataSetCreate(
        template_id="t1",
        name="x",
        description=None,
        variables={"a": 1},
        is_default=False,
        tags=["smoke"],
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.create_data_set(payload, current_user=None, db=db))
    assert exc.value.status_code == 500


def test_get_update_delete_data_set_branches():
    db = DummyDb()
    db.execute_one.return_value = {"id": "ds1", "template_id": "t1", "name": "set"}
    result = asyncio.run(api_module.get_data_set("ds1", db=db))
    assert result["data"]["id"] == "ds1"

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_data_set("missing", db=db))
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc2:
        asyncio.run(api_module.update_data_set("ds1", DataSetUpdate(), db=db))
    assert exc2.value.status_code == 400

    db.execute_one.return_value = {"id": "ds1", "name": "new", "variables": {"x": 1}, "is_default": False, "tags": [], "updated_at": datetime.utcnow()}
    upd = asyncio.run(api_module.update_data_set("ds1", DataSetUpdate(variables={"x": 1}), db=db))
    assert upd["success"] is True
    args = db.execute_one.await_args.args
    assert json.dumps({"x": 1}) in args

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc3:
        asyncio.run(api_module.update_data_set("missing", DataSetUpdate(name="x"), db=db))
    assert exc3.value.status_code == 404

    db.execute_one.return_value = {"id": "ds1"}
    assert asyncio.run(api_module.delete_data_set("ds1", db=db))["success"] is True

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc4:
        asyncio.run(api_module.delete_data_set("missing", db=db))
    assert exc4.value.status_code == 404


def test_list_test_data_setups_with_filters_and_casting():
    db = DummyDb()
    db.execute_one.return_value = {"id": "proj-1"}
    db.fetch.return_value = [
        {
            "id": "s1",
            "project_id": "proj-1",
            "name": "setup",
            "description": None,
            "execution_order": 1,
            "template_id": "t1",
            "data_set_id": "ds1",
            "custom_variables": {},
            "output_variables": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "template_name": "tmpl",
            "template_category": "cat",
            "data_set_name": "default",
        }
    ]

    result = asyncio.run(
        api_module.list_test_data_setups(project_id=None, template_id="t1", is_active=True, current_user=None, db=db)
    )
    assert result["success"] is True
    assert result["count"] == 1
    setup = result["data"][0]
    assert setup["id"] == "s1"
    assert setup["project_id"] == "proj-1"
    assert setup["template_id"] == "t1"
    assert setup["data_set_id"] == "ds1"


def test_list_test_data_setups_raises_500_on_error():
    db = DummyDb()
    db.execute_one.return_value = {"id": "proj-1"}
    db.fetch.side_effect = Exception("db")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.list_test_data_setups(project_id=None, current_user=None, db=db))
    assert exc.value.status_code == 500


def test_create_test_data_setup_serializes_payloads():
    db = DummyDb()
    db.execute_one.side_effect = [
        {"id": "user-1"},
        {
            "id": "s1",
            "project_id": "proj-explicit",
            "name": "Setup",
            "description": "desc",
            "execution_order": 0,
            "template_id": "t1",
            "data_set_id": "ds1",
            "custom_variables": {"a": 1},
            "output_variables": [{"name": "user_id", "source": "$.id", "transform": None}],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        },
    ]

    payload = SetupCreateModel(
        project_id="proj-explicit",
        name="Setup",
        description="desc",
        execution_order=0,
        template_id="t1",
        data_set_id="ds1",
        custom_variables={"a": 1},
        output_variables=[{"name": "user_id", "source": "$.id"}],
        is_active=True,
    )

    result = asyncio.run(api_module.create_test_data_setup(payload, current_user=None, db=db))
    assert result["success"] is True
    args = db.execute_one.await_args.args
    assert args[1] == "proj-explicit"
    assert json.loads(args[7]) == {"a": 1}
    assert json.loads(args[8])[0]["name"] == "user_id"


def test_create_test_data_setup_raises_500_on_error():
    db = DummyDb()
    db.execute_one.side_effect = Exception("insert failed")

    payload = SetupCreateModel(
        project_id="proj-explicit",
        name="Setup",
        description="desc",
        execution_order=0,
        template_id="t1",
        data_set_id="ds1",
        custom_variables={"a": 1},
        output_variables=[{"name": "user_id", "source": "$.id"}],
        is_active=True,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.create_test_data_setup(payload, current_user=None, db=db))
    assert exc.value.status_code == 500


def test_get_update_delete_test_data_setup_branches():
    db = DummyDb()
    db.execute_one.return_value = {
        "id": "s1",
        "project_id": "proj-1",
        "template_id": "t1",
        "data_set_id": "ds1",
    }
    result = asyncio.run(api_module.get_test_data_setup("s1", db=db))
    assert result["data"]["id"] == "s1"

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_test_data_setup("missing", db=db))
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc2:
        asyncio.run(api_module.update_test_data_setup("s1", SetupUpdateModel(), db=db))
    assert exc2.value.status_code == 400

    db.execute_one.return_value = {
        "id": "s1",
        "name": "Updated",
        "execution_order": 2,
        "is_active": False,
        "updated_at": datetime.utcnow(),
    }
    upd = asyncio.run(
        api_module.update_test_data_setup(
            "s1",
            SetupUpdateModel(custom_variables={"x": 1}, output_variables=[{"name": "n", "source": "$.a"}]),
            db=db,
        )
    )
    assert upd["success"] is True
    args = db.execute_one.await_args.args
    assert json.dumps({"x": 1}) in args

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc3:
        asyncio.run(api_module.update_test_data_setup("missing", SetupUpdateModel(name="x"), db=db))
    assert exc3.value.status_code == 404

    db.execute_one.return_value = {"id": "s1"}
    assert asyncio.run(api_module.delete_test_data_setup("s1", db=db))["success"] is True

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc4:
        asyncio.run(api_module.delete_test_data_setup("missing", db=db))
    assert exc4.value.status_code == 404


def test_prompt_setup_linking_endpoints():
    db = DummyDb()
    db.fetch.return_value = [
        {
            "id": "l1",
            "prompt_id": "p1",
            "setup_id": "s1",
            "execution_order": 0,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "setup_name": "Setup",
            "template_name": "Template",
            "category": "user",
        }
    ]
    listed = asyncio.run(api_module.get_prompt_data_setups("p1", db=db))
    assert listed["success"] is True
    assert listed["count"] == 1
    assert listed["data"][0]["setup_id"] == "s1"

    db.execute_one.return_value = {
        "id": "l1",
        "prompt_id": "p1",
        "setup_id": "s1",
        "execution_order": 1,
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    payload = LinkSetupToPromptRequest(prompt_id="p1", setup_id="s1", execution_order=1, is_active=True)
    linked = asyncio.run(api_module.link_setup_to_prompt("p1", payload, db=db))
    assert linked["success"] is True
    assert linked["data"]["id"] == "l1"

    db.execute_one.return_value = {"id": "l1"}
    unlinked = asyncio.run(api_module.unlink_setup_from_prompt("p1", "s1", db=db))
    assert unlinked["success"] is True

    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.unlink_setup_from_prompt("p1", "s1", db=db))
    assert exc.value.status_code == 404


def test_prompt_link_endpoints_error_paths():
    db = DummyDb()
    db.fetch.side_effect = Exception("db")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_prompt_data_setups("p1", db=db))
    assert exc.value.status_code == 500

    db = DummyDb()
    db.execute_one.side_effect = Exception("db")
    payload = LinkSetupToPromptRequest(prompt_id="p1", setup_id="s1")
    with pytest.raises(HTTPException) as exc2:
        asyncio.run(api_module.link_setup_to_prompt("p1", payload, db=db))
    assert exc2.value.status_code == 500


def test_unlink_setup_from_prompt_raises_500_on_error():
    db = DummyDb()
    db.execute_one.side_effect = Exception("db")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.unlink_setup_from_prompt("p1", "s1", db=db))
    assert exc.value.status_code == 500


def test_execution_history_list_and_detail():
    db = DummyDb()
    db.fetch.return_value = [
        {
            "id": "h1",
            "setup_id": "s1",
            "template_id": "t1",
            "request_url": "u",
            "request_method": "POST",
            "response_status": 201,
            "extracted_variables": {"id": "1"},
            "duration_ms": 12,
            "success": True,
            "error_message": None,
            "executed_at": datetime.utcnow(),
            "executed_by": "user-1",
            "setup_name": "Setup",
            "template_name": "Template",
        }
    ]

    hist = asyncio.run(
        api_module.get_execution_history(setup_id="s1", template_id="t1", success=True, limit=10, offset=5, db=db)
    )
    assert hist["success"] is True
    assert hist["count"] == 1
    row = hist["data"][0]
    assert row["id"] == "h1"
    assert row["setup_id"] == "s1"
    assert row["template_id"] == "t1"
    assert row["executed_by"] == "user-1"

    args = db.fetch.await_args.args
    assert args[-2] == 10
    assert args[-1] == 5

    db.execute_one.return_value = {"id": "h1", "setup_id": "s1", "template_id": "t1"}
    detail = asyncio.run(api_module.get_execution_history_detail("h1", db=db))
    assert detail["success"] is True
    assert detail["data"]["id"] == "h1"


def test_execution_history_error_paths():
    db = DummyDb()
    db.fetch.side_effect = Exception("db")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.get_execution_history(db=db))
    assert exc.value.status_code == 500

    db = DummyDb()
    db.execute_one.return_value = None
    with pytest.raises(HTTPException) as exc2:
        asyncio.run(api_module.get_execution_history_detail("missing", db=db))
    assert exc2.value.status_code == 404

    db = DummyDb()
    db.execute_one.side_effect = Exception("db")
    with pytest.raises(HTTPException) as exc3:
        asyncio.run(api_module.get_execution_history_detail("h1", db=db))
    assert exc3.value.status_code == 500


def test_execute_test_data_setup_handles_empty_result_list(monkeypatch):
    db = DummyDb()

    async def fake_get_user_id(current_user, db_obj):
        return "user-1"

    class FakeService:
        def __init__(self, db_obj):
            self.db_obj = db_obj

        async def execute_setups_for_prompt(self, prompt_id, variable_overrides=None, executed_by=None):
            return True, {"seed": "v"}, []

    monkeypatch.setattr(api_module, "get_user_id", fake_get_user_id)
    monkeypatch.setattr(api_module, "ApiTestDataService", FakeService)

    request = ExecuteSetupRequest(prompt_id="p-1", variable_overrides={"seed": "v"})
    response = asyncio.run(api_module.execute_test_data_setup(request, current_user=None, db=db))

    assert response["success"] is True
    assert response["data"]["total_setups"] == 0
    assert response["data"]["successful_setups"] == 0
    assert response["data"]["failed_setups"] == 0
    assert response["data"]["combined_variables"] == {"seed": "v"}


def test_execute_test_data_setup_raises_500_on_service_failure(monkeypatch):
    db = DummyDb()

    async def fake_get_user_id(current_user, db_obj):
        return "user-1"

    class FakeService:
        def __init__(self, db_obj):
            self.db_obj = db_obj

        async def execute_setup(self, setup_id, variable_overrides=None, executed_by=None, dry_run=False):
            raise RuntimeError("execution failed")

    monkeypatch.setattr(api_module, "get_user_id", fake_get_user_id)
    monkeypatch.setattr(api_module, "ApiTestDataService", FakeService)

    request = ExecuteSetupRequest(setup_id="s1")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api_module.execute_test_data_setup(request, current_user=None, db=db))
    assert exc.value.status_code == 500

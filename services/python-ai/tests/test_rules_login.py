from rules import plan_for

def test_login_flow_has_expected_steps():
    plan = plan_for("login")
    steps = [a.name for a in plan]
    assert steps[:2] == ["open_url", "type_css"]
    assert "click_css" in steps
    assert "assert_title_contains" in steps

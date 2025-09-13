from rules import plan_for

def names(plan):
    return [a.name for a in plan]

def test_open_example_defaults():
    plan = plan_for("open example")
    assert names(plan)[0] == "open_url"
    assert any(a.name == "assert_title_contains" for a in plan)
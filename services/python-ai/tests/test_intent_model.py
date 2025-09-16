from intent.model import IntentModel

def test_login_intent():
    im = IntentModel()
    assert im.predict_intent("please log in") == "LOGIN"

def test_open_with_url():
    im = IntentModel()
    p = "open https://example.com"
    assert im.predict_intent(p) == "OPEN"
    assert im.extract_url(p) == "https://example.com"

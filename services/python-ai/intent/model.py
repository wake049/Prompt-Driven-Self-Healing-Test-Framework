import re, pathlib
from typing import Literal, Optional
from joblib import load

Intent = Literal["LOGIN", "OPEN", "VERIFY_TITLE", "UNKNOWN"]

_URL_RE = re.compile(r"(https?://\S+)", re.I)

class IntentModel:
    def __init__(self, path: str | None = None):
        p = pathlib.Path(path or "models/intent_model.joblib")
        self.pipe = load(p)

    def predict_intent(self, text: str) -> Intent:
        label = self.pipe.predict([text])[0]
        return label  # type: ignore

    def extract_url(self, text: str) -> Optional[str]:
        m = _URL_RE.search(text)
        return m.group(1) if m else None

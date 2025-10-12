import json, os
from datetime import datetime, timezone
from typing import Dict, Optional, List, Tuple
from core.config import REVIEW_STORAGE_PATH
from schemas.review_item import ReviewItem, ReviewStatus

def _iso_utc(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    # normalize to ...Z
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

class ReviewStorage:
    def __init__(self, path: str = REVIEW_STORAGE_PATH):
        self.path = path
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        if not os.path.exists(self.path):
            with open(self.path, "w") as f:
                json.dump({}, f)

    def _load(self) -> Dict[str, dict]:
        try:
            with open(self.path, "r") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            with open(self.path, "w") as f:
                json.dump({}, f)
            return {}

    def _save(self, data: Dict[str, dict]) -> None:
        with open(self.path, "w") as f:
            json.dump(data, f, indent=2)

    # ------- CRUD -------

    def get(self, review_id: str) -> Optional[ReviewItem]:
        data = self._load()
        raw = data.get(review_id)
        return ReviewItem(**raw) if raw else None

    def add(self, item: ReviewItem) -> ReviewItem:
        data = self._load()
        # ensure normalized timestamps
        payload = item.model_dump()
        if isinstance(payload.get("created_at"), str) is False:
            payload["created_at"] = _iso_utc()
        data[item.id] = payload
        self._save(data)
        return ReviewItem(**payload)

    def update(self, review_id: str, fields: dict) -> Optional[ReviewItem]:
        data = self._load()
        if review_id not in data:
            return None
        data[review_id].update(fields)
        # normalize updated_at
        data[review_id]["updated_at"] = fields.get("updated_at") or _iso_utc()
        self._save(data)
        return ReviewItem(**data[review_id])

    def delete(self, review_id: str) -> bool:
        data = self._load()
        existed = data.pop(review_id, None) is not None
        if existed:
            self._save(data)
        return existed

    # ------- Queries -------

    def list_pending(self, limit: int = 50, page: int = 1) -> List[ReviewItem]:
        data = self._load()
        rows: List[ReviewItem] = []
        for v in data.values():
            try:
                if v.get("status") == ReviewStatus.pending.value or v.get("status") == "pending":
                    rows.append(ReviewItem(**v))
            except Exception:
                continue
        # newest first
        rows.sort(key=lambda r: (r.created_at or datetime.min), reverse=True)
        start = max(page - 1, 0) * limit
        return rows[start : start + limit]

    def stats(self) -> Dict[str, int]:
        data = self._load()
        totals = {"total": 0, "pending": 0, "approved": 0, "rejected": 0, "verified_fail": 0}
        for v in data.values():
            totals["total"] += 1
            s = (v.get("status") or "").lower()
            if s in totals:
                totals[s] += 1
        return totals


# singleton
review_storage = ReviewStorage()

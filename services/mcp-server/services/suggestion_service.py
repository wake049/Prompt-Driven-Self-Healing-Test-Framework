# services/suggestion_service.py
from __future__ import annotations
from typing import List, Tuple
import json

from core.config import (
    AI_PROVIDER,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    SUGGESTION_MAX_ALTS,
    SUGGESTION_TEMPERATURE,
)
from schemas.review_item import SuggestRequest, SuggestResponse, SuggestAlternative

def _heuristic_variants(old_locator: str | None, limit: int) -> List[SuggestAlternative]:
    if not old_locator:
        return []

    base = old_locator.strip()
    out: List[SuggestAlternative] = []

    if base.startswith("css="):
        sel = base[4:]
        variants = [sel]
        if "#" in sel:
            # id variant
            variants.append(sel.replace("#", "[id=") + "]")
        if "." in sel:
            # class token contains
            variants.append(sel.replace(".", "[class~=") + "]")
        for v in variants:
            out.append(SuggestAlternative(
                selector=f"css={v}",
                confidence=0.55,
                ai_reasoning="Heuristic variant from base CSS selector."
            ))

    elif base.startswith("xpath="):
        sel = base[6:]
        variants = []
        if sel.startswith("//"):
            variants.append(sel.replace("//", "//*", 1))
        variants.append(sel + "[not(@disabled)]")
        variants.append(sel + "[normalize-space(text())!='']")
        for v in variants:
            out.append(SuggestAlternative(
                selector=f"xpath={v}",
                confidence=0.50,
                ai_reasoning="Heuristic variant from base XPath."
            ))
    else:
        # treat as raw css
        out.append(SuggestAlternative(
            selector=f"css={base}",
            confidence=0.50,
            ai_reasoning="Wrapped raw locator as CSS."
        ))

    return out[:limit]

# ---------- OpenAI provider (optional) ----------

def _openai_suggest(req: SuggestRequest, limit: int) -> List[SuggestAlternative]:
    """
    Calls OpenAI to propose CSS/XPath alternatives.
    Returns [] if not configured or if an error occurs (caller will fall back to heuristics).
    """
    if not OPENAI_API_KEY:
        return []

    try:
        # Lazy import so the rest of the server doesn't require openai installed to run
        from openai import OpenAI  # type: ignore
        client = OpenAI(api_key=OPENAI_API_KEY)

        system = (
            "You are a test-automation locator expert. "
            "Given a page context and a failing locator, propose robust alternatives. "
            "Prefer stable attributes (data-*, aria-*, id), avoid brittle absolute XPaths, "
            "and return at most the requested number of items. "
            "Output strict JSON with fields: selector, confidence, ai_reasoning."
        )
        user = {
            "page": req.page,
            "old_locator": req.old_locator,
            "dom_snippet": req.dom_snippet[:50_000] if req.dom_snippet else None,  # cap long DOMs
            "screenshot_path": req.screenshot_path,
            "max_alternatives": limit
        }

        prompt = (
            "Propose up to {k} alternate selectors for the element.\n"
            "- If CSS is viable, prefer CSS.\n"
            "- If XPath is necessary, use short, robust expressions with normalize-space and role/aria.\n"
            "- Include a short reasoning.\n"
            "Respond ONLY with a JSON array of objects: "
            '[{"selector":"...","confidence":0.0-1.0,"ai_reasoning":"..."}]'
        ).format(k=limit)

        # Responses API (JSON mode) or Chat Completions—choose one
        # We'll use responses.create with JSON output
        completion = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user) + "\n\n" + prompt},
            ],
            temperature=SUGGESTION_TEMPERATURE,
        )

        # Extract text
        content = completion.output_text  # unified accessor
        data = json.loads(content)
        alts: List[SuggestAlternative] = []
        if isinstance(data, list):
            for item in data[:limit]:
                try:
                    alts.append(SuggestAlternative(
                        selector=item["selector"],
                        confidence=float(item.get("confidence", 0.6)),
                        ai_reasoning=item.get("ai_reasoning", "LLM rationale.")
                    ))
                except Exception:
                    continue
        return alts
    except Exception:
        # On any error, silently fall back (caller will add heuristics)
        return []

# ---------- Public API ----------

class LocatorSuggestor:
    def suggest(self, req: SuggestRequest, max_alts: int | None = None) -> SuggestResponse:
        limit = max_alts or req.max_alternatives or SUGGESTION_MAX_ALTS

        # 1) Try provider (if configured)
        llm_alts: List[SuggestAlternative] = []
        if AI_PROVIDER == "openai":
            llm_alts = _openai_suggest(req, limit)

        # 2) Heuristic safety net
        need = max(0, limit - len(llm_alts))
        heuristics = _heuristic_variants(req.old_locator, need) if need else []

        # 3) Return combined (LLM first, then heuristics)
        return SuggestResponse(alternatives=(llm_alts + heuristics)[:limit])
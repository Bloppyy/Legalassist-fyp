"""
ML-based court direction parser using the fine-tuned HuggingFace NER model
(bert-base-multilingual-cased fine-tuned on annotated Malaysian arahan).

Loads training/model-best/ at startup if it exists; returns None when the
model is unavailable so the caller falls back to the rule-based parser.

Entity labels produced by the model:
    NEXT_COURT_DATE   → next_court_date (ISO YYYY-MM-DD string)
    COURT_NAME        → court_name
    PARTY             → parties[]
    REQUIRED_ACTION   → required_actions[]
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from dateutil import parser as dateutil_parser

from models.schemas import DirectionParseResponse

MODEL_PATH = Path(__file__).parent.parent / "training" / "model-best"

_BM_MONTHS = {
    "januari": "january", "februari": "february", "mac": "march",
    "april": "april", "mei": "may", "jun": "june",
    "julai": "july", "ogos": "august", "september": "september",
    "oktober": "october", "november": "november", "disember": "december",
}


@lru_cache(maxsize=1)
def _load_pipeline():
    if not MODEL_PATH.exists():
        print("[ml_parser] No fine-tuned model at training/model-best/ — ML parser disabled.")
        return None
    try:
        from transformers import pipeline
        ner = pipeline(
            "ner",
            model=str(MODEL_PATH),
            tokenizer=str(MODEL_PATH),
            aggregation_strategy="simple",
            device=-1,  # CPU
        )
        print(f"[ml_parser] Fine-tuned model loaded from {MODEL_PATH}")
        return ner
    except Exception as e:
        print(f"[ml_parser] WARNING: could not load fine-tuned model — {e}")
        return None


def _normalise_bm(text: str) -> str:
    import re
    for bm, en in _BM_MONTHS.items():
        text = re.sub(r'\b' + bm + r'\b', en, text, flags=re.IGNORECASE)
    return text


def _parse_date(text: str) -> Optional[str]:
    try:
        d = dateutil_parser.parse(_normalise_bm(text), dayfirst=True).date()
        if d.year >= 2020:
            return d.isoformat()
    except Exception:
        pass
    return None


def _confidence_from_entities(
    has_date: bool, has_court: bool, party_count: int, action_count: int
) -> float:
    score = 0.0
    if has_date:   score += 0.35
    if has_court:  score += 0.30
    score += min(0.20, party_count * 0.05)
    score += min(0.15, action_count * 0.05)
    return round(min(score, 1.0), 2)


def _entities_to_response(entities: list[dict]) -> DirectionParseResponse:
    """Pure conversion: raw NER pipeline output -> structured fields.
    Shared by production predict() and the CV harness so both measure
    identical post-processing, not two independently-written versions."""
    next_court_date: Optional[str] = None
    court_name: Optional[str] = None
    parties: list[str] = []
    required_actions: list[str] = []
    seen_parties: set[str] = set()
    seen_actions: set[str] = set()

    for ent in entities:
        label = ent.get("entity_group") or ent.get("entity", "")
        for prefix in ("B-", "I-"):
            if label.startswith(prefix):
                label = label[len(prefix):]
        span_text = ent.get("word", "").strip()

        if label == "NEXT_COURT_DATE" and next_court_date is None:
            parsed = _parse_date(span_text)
            if parsed:
                next_court_date = parsed
        elif label == "COURT_NAME" and court_name is None:
            court_name = span_text
        elif label == "PARTY":
            key = span_text.lower()
            if key not in seen_parties and len(span_text) > 2:
                parties.append(span_text)
                seen_parties.add(key)
        elif label == "REQUIRED_ACTION":
            key = span_text.lower()
            if key not in seen_actions and len(span_text) > 10:
                required_actions.append(span_text)
                seen_actions.add(key)

    confidence = _confidence_from_entities(
        has_date=next_court_date is not None, has_court=court_name is not None,
        party_count=len(parties), action_count=len(required_actions),
    )
    return DirectionParseResponse(
        next_court_date=next_court_date, required_actions=required_actions[:10],
        parties=parties[:10], court_name=court_name, confidence=confidence,
        parser_used="ml",
    )


def predict(text: str) -> Optional[DirectionParseResponse]:
    """Production entry point — behavior unchanged."""
    ner = _load_pipeline()
    if ner is None:
        return None
    try:
        entities = ner(text)
    except Exception as e:
        print(f"[ml_parser] Inference error: {e}")
        return None
    return _entities_to_response(entities)


def predict_with_pipeline(text: str, ner_pipeline) -> Optional[DirectionParseResponse]:
    """Same conversion as predict(), against an arbitrary already-loaded
    pipeline instead of the cached model-best/ singleton. Needed because
    @lru_cache on _load_pipeline() means predict() can only ever serve one
    fixed model — the CV harness needs a different model per fold."""
    try:
        entities = ner_pipeline(text)
    except Exception as e:
        print(f"[ml_parser] CV inference error: {e}")
        return None
    return _entities_to_response(entities)


def is_available() -> bool:
    return _load_pipeline() is not None

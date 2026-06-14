"""
ML-based court direction parser using the fine-tuned spaCy transformer model.

Loads training/model-best/ at startup (if it exists).
Returns None when the model is unavailable so the caller can fall back to the
rule-based parser without any error propagation.

Entity labels produced by the model:
    NEXT_COURT_DATE   → next_court_date (ISO string)
    COURT_NAME        → court_name
    PARTY             → parties[]
    REQUIRED_ACTION   → required_actions[]
"""

from __future__ import annotations

from datetime import date
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
def _load_model():
    if not MODEL_PATH.exists():
        print("[ml_parser] No fine-tuned model found at training/model-best/ — ML parser disabled.")
        return None
    try:
        import spacy
        nlp = spacy.load(str(MODEL_PATH))
        print(f"[ml_parser] Fine-tuned model loaded from {MODEL_PATH}")
        return nlp
    except Exception as e:
        print(f"[ml_parser] WARNING: could not load fine-tuned model — {e}")
        return None


def _normalise_bm(text: str) -> str:
    import re
    for bm, en in _BM_MONTHS.items():
        text = re.sub(r'\b' + bm + r'\b', en, text, flags=re.IGNORECASE)
    return text


def _parse_date(text: str) -> Optional[str]:
    """Try to parse a date string and return ISO YYYY-MM-DD, or None on failure."""
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
    if has_date:
        score += 0.35
    if has_court:
        score += 0.30
    score += min(0.20, party_count * 0.05)
    score += min(0.15, action_count * 0.05)
    return round(min(score, 1.0), 2)


def predict(text: str) -> Optional[DirectionParseResponse]:
    """
    Run the fine-tuned NER model on text.
    Returns a DirectionParseResponse with parser_used='ml', or None if the
    model is not available (signals the caller to use the rule-based fallback).
    """
    nlp = _load_model()
    if nlp is None:
        return None

    doc = nlp(text)

    next_court_date: Optional[str] = None
    court_name: Optional[str] = None
    parties: list[str] = []
    required_actions: list[str] = []
    seen_parties: set[str] = set()
    seen_actions: set[str] = set()

    for ent in doc.ents:
        label = ent.label_
        span_text = ent.text.strip()

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
        has_date=next_court_date is not None,
        has_court=court_name is not None,
        party_count=len(parties),
        action_count=len(required_actions),
    )

    return DirectionParseResponse(
        next_court_date=next_court_date,
        required_actions=required_actions[:10],
        parties=parties[:10],
        court_name=court_name,
        confidence=confidence,
        parser_used="ml",
    )


def is_available() -> bool:
    return _load_model() is not None

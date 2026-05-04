"""
Court Direction Parser for Malaysian civil litigation arahan documents.
Extracts: next_court_date, required_actions, parties, court_name, confidence.
Handles mixed Bahasa Malaysia / English text.
"""

import re
from datetime import date
from functools import lru_cache
from typing import Optional

import spacy
from dateutil import parser as dateutil_parser

from models.schemas import DirectionParseResponse

# ---------------------------------------------------------------------------
# BM month names → English for dateutil
# ---------------------------------------------------------------------------

_BM_MONTHS = {
    "januari": "january", "februari": "february", "mac": "march",
    "april": "april", "mei": "may", "jun": "june",
    "julai": "july", "ogos": "august", "september": "september",
    "oktober": "october", "november": "november", "disember": "december",
}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

_COURT_PATTERN = re.compile(
    r"\b(?:High Court|Mahkamah Tinggi|Sessions Court|Mahkamah Sesyen"
    r"|Magistrate(?:'s)? Court|Mahkamah Majistret|Court of Appeal"
    r"|Mahkamah Rayuan|Federal Court|Mahkamah Persekutuan)\b"
    r"(?:[,\s]+(?:Shah Alam|Kuala Lumpur|Johor Bahru|George Town|Ipoh"
    r"|Kota Kinabalu|Kuching|Alor Setar|Kota Bharu|Melaka|Seremban"
    r"|Kuantan|Kangar|Kuala Terengganu|Putrajaya|[A-Z][a-z]+))?",
    re.IGNORECASE,
)

_PARTY_PATTERN = re.compile(
    r"\b(?:Plaintiff|Plaintif|Defendant|Defendan|Applicant|Pemohon"
    r"|Respondent|Responden|Perayu|Appellant)\s*[:\-]?\s*([A-Z][^\n,;.(]{2,50})",
    re.IGNORECASE,
)

_ACTION_PATTERN = re.compile(
    r"[^.!?\n]*\b(?:file|serve|attend|submit|comply|pay|respond|reply|appear"
    r"|mengemukakan|hadir|memfailkan|menyampaikan|serahkan|kemukakan"
    r"|laksanakan|bayar|jawab|hadiri)\b[^.!?\n]*[.!?]?",
    re.IGNORECASE,
)

# Matches "15 January 2025", "15/01/2025", "15-01-2025"
_DATE_PATTERN = re.compile(
    r"\b\d{1,2}[/\-]\d{1,2}[/\-]\d{4}\b"
    r"|\b\d{1,2}\s+(?:januari|februari|mac|april|mei|jun|julai|ogos"
    r"|setembro|oktober|november|disember"
    r"|january|february|march|april|may|june|july|august"
    r"|september|october|november|december)\s+\d{4}\b",
    re.IGNORECASE,
)


@lru_cache(maxsize=1)
def _load_nlp():
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        print("[direction_parser] WARNING: en_core_web_sm not found. Run: python -m spacy download en_core_web_sm")
        return spacy.blank("en")


def _normalize_bm_months(text: str) -> str:
    for bm, en in _BM_MONTHS.items():
        text = re.sub(r'\b' + bm + r'\b', en, text, flags=re.IGNORECASE)
    return text


def _extract_dates(text: str) -> list[date]:
    normalized = _normalize_bm_months(text)
    nlp = _load_nlp()
    doc = nlp(normalized)

    dates: list[date] = []
    seen: set[date] = set()

    for ent in doc.ents:
        if ent.label_ == "DATE":
            try:
                parsed = dateutil_parser.parse(ent.text, dayfirst=True)
                d = parsed.date()
                if d not in seen and d.year >= 2020:
                    dates.append(d)
                    seen.add(d)
            except Exception:
                pass

    for match in _DATE_PATTERN.finditer(normalized):
        try:
            parsed = dateutil_parser.parse(match.group(), dayfirst=True)
            d = parsed.date()
            if d not in seen and d.year >= 2020:
                dates.append(d)
                seen.add(d)
        except Exception:
            pass

    return dates


def _pick_next_court_date(dates: list[date]) -> Optional[date]:
    today = date.today()
    future = [d for d in dates if d >= today]
    if future:
        return min(future)
    return max(dates) if dates else None


def _extract_court_name(text: str) -> Optional[str]:
    match = _COURT_PATTERN.search(text)
    return match.group().strip() if match else None


def _extract_parties(text: str) -> list[str]:
    parties: list[str] = []
    seen: set[str] = set()

    for match in _PARTY_PATTERN.finditer(text):
        name = match.group(1).strip()
        name = re.sub(r'[\d\s]+$', '', name).strip()
        if name and name not in seen and len(name) > 2 and name[0].isupper():
            parties.append(name)
            seen.add(name)

    if not parties:
        nlp = _load_nlp()
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ == "PERSON" and ent.text not in seen:
                parties.append(ent.text)
                seen.add(ent.text)

    return parties[:10]


def _extract_required_actions(text: str) -> list[str]:
    actions: list[str] = []
    seen: set[str] = set()

    for match in _ACTION_PATTERN.finditer(text):
        action = re.sub(r'\s+', ' ', match.group().strip())
        normalized = action.lower()
        if action and normalized not in seen and len(action) > 10:
            actions.append(action)
            seen.add(normalized)

    return actions[:10]


def _score_confidence(
    court_name: Optional[str],
    next_court_date: Optional[date],
    parties: list[str],
    actions: list[str],
) -> float:
    score = 0.0
    if court_name:
        score += 0.30
    if next_court_date:
        score += 0.35
    if parties:
        score += min(0.20, len(parties) * 0.05)
    if actions:
        score += min(0.15, len(actions) * 0.05)
    return round(min(score, 1.0), 2)


def parse_direction(text: str) -> DirectionParseResponse:
    """
    Parse a Malaysian court direction arahan.
    Returns structured fields to pre-populate a case stage form.
    """
    dates = _extract_dates(text)
    next_court_date = _pick_next_court_date(dates)
    court_name = _extract_court_name(text)
    parties = _extract_parties(text)
    required_actions = _extract_required_actions(text)
    confidence = _score_confidence(court_name, next_court_date, parties, required_actions)

    return DirectionParseResponse(
        next_court_date=next_court_date.isoformat() if next_court_date else None,
        required_actions=required_actions,
        parties=parties,
        court_name=court_name,
        confidence=confidence,
    )

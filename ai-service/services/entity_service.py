"""
Entity extraction service for Malaysian civil litigation documents.

Uses spaCy for standard NLP entities (PERSON, ORG, DATE, MONEY, GPE)
and adds custom regex-based extractors for Malaysian legal patterns
(IC numbers, case numbers, court names, law firm references).
"""

import re
import spacy
from functools import lru_cache
from models.schemas import ExtractedEntity, EntityResponse

# ---------------------------------------------------------------------------
# Malaysian legal regex patterns
# ---------------------------------------------------------------------------

CUSTOM_PATTERNS: list[dict] = [
    {
        "label": "IC_NUMBER",
        "pattern": r"\b\d{6}-\d{2}-\d{4}\b",
        "confidence": 0.99,
    },
    {
        # Malaysian civil case format: e.g. BA-22NCvC-123-05/2024, WA-24BNCvC-1234-2023
        "label": "CASE_NUMBER",
        "pattern": r"\b[A-Z]{1,4}-\d{1,2}[A-Za-z]*-\d{1,5}[-/]\d{4}\b",
        "confidence": 0.97,
    },
    {
        # Monetary amounts: RM 1,000.00 / RM1,000 / Ringgit Malaysia
        "label": "MONETARY_AMOUNT",
        "pattern": r"\bRM\s?[\d,]+(?:\.\d{2})?\b",
        "confidence": 0.96,
    },
    {
        "label": "COURT_NAME",
        "pattern": (
            r"\b(?:High Court|Mahkamah Tinggi|Sessions Court|Mahkamah Sesyen"
            r"|Magistrate(?:'s)? Court|Mahkamah Majistret|Court of Appeal"
            r"|Mahkamah Rayuan|Federal Court|Mahkamah Persekutuan)\b"
        ),
        "confidence": 0.98,
    },
    {
        # Malaysian state names — useful for jurisdiction
        "label": "MALAYSIAN_STATE",
        "pattern": (
            r"\b(?:Selangor|Kuala Lumpur|Johor|Penang|Perak|Sabah|Sarawak"
            r"|Kedah|Kelantan|Melaka|Negeri Sembilan|Pahang|Perlis"
            r"|Terengganu|Putrajaya|Labuan)\b"
        ),
        "confidence": 0.93,
    },
    {
        # Common Malaysian law firm suffixes
        "label": "LAW_FIRM",
        "pattern": r"\b\w[\w\s&,\.]+(?:Advocates?|Solicitors?|Peguam[cara]*|& Co\.?|LLP)\b",
        "confidence": 0.85,
    },
    {
        # Malaysian land title references
        "label": "LAND_TITLE",
        "pattern": r"\b(?:GM|HS\(D\)|HS\(M\)|GRN|EMR|CT|NT)\s*\d+[,\s]+(?:Lot|PT)\s*\d+\b",
        "confidence": 0.95,
    },
]


@lru_cache(maxsize=1)
def _load_nlp():
    """Load spaCy model once and cache it. Falls back to blank model if not installed."""
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        # Blank model — custom patterns still work, standard NER is unavailable
        print("[entity_service] WARNING: en_core_web_sm not found. Run: python -m spacy download en_core_web_sm")
        return spacy.blank("en")


def _extract_custom_entities(content: str) -> list[ExtractedEntity]:
    """Run regex patterns for Malaysian legal entities."""
    entities: list[ExtractedEntity] = []

    for rule in CUSTOM_PATTERNS:
        for match in re.finditer(rule["pattern"], content, re.IGNORECASE):
            entities.append(
                ExtractedEntity(
                    text=match.group(),
                    label=rule["label"],
                    start=match.start(),
                    end=match.end(),
                    confidence=rule["confidence"],
                )
            )

    return entities


def _extract_spacy_entities(content: str) -> list[ExtractedEntity]:
    """Run spaCy NER for standard entities (PERSON, ORG, DATE, MONEY, GPE)."""
    nlp = _load_nlp()
    doc = nlp(content)

    keep_labels = {"PERSON", "ORG", "DATE", "MONEY", "GPE", "LAW"}
    entities: list[ExtractedEntity] = []

    for ent in doc.ents:
        if ent.label_ in keep_labels:
            entities.append(
                ExtractedEntity(
                    text=ent.text,
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char,
                    confidence=0.80,  # spaCy doesn't expose per-entity scores in sm model
                )
            )

    return entities


def _deduplicate(entities: list[ExtractedEntity]) -> list[ExtractedEntity]:
    """
    Remove overlapping entities, preferring the one with higher confidence.
    Custom (higher confidence) entities take priority over spaCy entities.
    """
    entities_sorted = sorted(entities, key=lambda e: (-e.confidence, e.start))
    result: list[ExtractedEntity] = []

    for candidate in entities_sorted:
        overlaps = any(
            not (candidate.end <= kept.start or candidate.start >= kept.end)
            for kept in result
        )
        if not overlaps:
            result.append(candidate)

    return sorted(result, key=lambda e: e.start)


def extract_entities(content: str) -> EntityResponse:
    """
    Extract all legal entities from a document.
    Combines spaCy NER and custom Malaysian legal regex patterns,
    then deduplicates overlapping spans.
    """
    custom = _extract_custom_entities(content)
    standard = _extract_spacy_entities(content)
    all_entities = _deduplicate(custom + standard)

    return EntityResponse(
        entities=all_entities,
        entity_count=len(all_entities),
    )

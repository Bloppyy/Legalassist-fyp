"""
Template matcher — identifies which document type a given text most closely resembles.

Uses a keyword-density scoring approach: each document type has a set of
distinctive keywords/phrases. The type with the highest weighted match
score wins.

This is intentionally simple and fast — no vector similarity required.
For a more advanced approach, spaCy's Doc similarity or sentence-transformers
could replace this in a future iteration.
"""

from models.schemas import TemplateMatch, TemplateMatchResponse

# ---------------------------------------------------------------------------
# Signature keyword sets per document type
# Each keyword has a weight (higher = more distinctive of that type)
# ---------------------------------------------------------------------------

TEMPLATE_SIGNATURES: dict[str, dict] = {
    "writ_of_summons": {
        "label": "Writ of Summons",
        "keywords": {
            "writ of summons": 3.0,
            "writ saman": 3.0,
            "plaintiff": 2.0,
            "defendant": 2.0,
            "endorsement of claim": 2.5,
            "you are hereby commanded": 2.5,
            "enter an appearance": 2.0,
            "judgment may be given": 1.5,
            "registrar": 1.0,
            "sealed": 1.0,
        },
    },
    "statement_of_claim": {
        "label": "Statement of Claim",
        "keywords": {
            "statement of claim": 3.0,
            "pernyataan tuntutan": 3.0,
            "at all material times": 2.0,
            "the plaintiff avers": 2.0,
            "wherefore the plaintiff": 2.5,
            "breach of contract": 1.5,
            "cause of action": 1.5,
            "the defendant failed": 1.5,
            "general damages": 1.5,
            "special damages": 1.5,
        },
    },
    "affidavit": {
        "label": "Affidavit",
        "keywords": {
            "affidavit": 3.0,
            "afidavit": 3.0,
            "make oath": 3.0,
            "solemnly affirm": 3.0,
            "i am the": 1.5,
            "to the best of my knowledge": 2.0,
            "commissioner for oaths": 2.5,
            "pesuruhjaya sumpah": 2.5,
            "exhibit": 1.5,
            "deponent": 2.0,
        },
    },
    "letter_of_demand": {
        "label": "Letter of Demand",
        "keywords": {
            "letter of demand": 3.0,
            "surat tuntutan": 3.0,
            "we act for": 2.5,
            "we are instructed": 2.5,
            "our client": 2.0,
            "anak guam kami": 2.0,
            "demand that you": 2.0,
            "without further notice": 2.0,
            "legal proceedings": 1.5,
            "take immediate steps": 1.5,
        },
    },
    "memorandum_of_appearance": {
        "label": "Memorandum of Appearance",
        "keywords": {
            "memorandum of appearance": 4.0,
            "enter an appearance": 3.0,
            "address for service": 2.5,
            "the defendant": 1.5,
            "solicitor for the defendant": 2.5,
            "i intend to defend": 2.0,
        },
    },
}


def _score_document(content: str, signatures: dict) -> float:
    """
    Score document content against a signature keyword set.
    Returns a normalised score between 0 and 1.
    """
    lower = content.lower()
    total_weight = sum(signatures["keywords"].values())
    matched_weight = 0.0

    for keyword, weight in signatures["keywords"].items():
        if keyword in lower:
            matched_weight += weight

    return round(matched_weight / total_weight, 4) if total_weight > 0 else 0.0


def _get_matched_sections(content: str, signatures: dict) -> list[str]:
    """Return list of keyword field names that were found."""
    lower = content.lower()
    return [kw for kw in signatures["keywords"] if kw in lower]


def match_template(content: str) -> TemplateMatchResponse:
    """
    Score the content against all known document types and return
    ranked matches with similarity scores.
    """
    matches: list[TemplateMatch] = []

    for doc_type, sig in TEMPLATE_SIGNATURES.items():
        score = _score_document(content, sig)
        matched_sections = _get_matched_sections(content, sig)

        matches.append(
            TemplateMatch(
                document_type=doc_type,
                similarity_score=score,
                matched_sections=matched_sections,
            )
        )

    matches.sort(key=lambda m: m.similarity_score, reverse=True)

    best_match = matches[0].document_type if matches and matches[0].similarity_score > 0.05 else None

    return TemplateMatchResponse(
        best_match=best_match,
        matches=matches,
    )

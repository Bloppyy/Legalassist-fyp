"""
Document type classifier using sentence-transformer cosine similarity.

Compares the uploaded document embedding against representative embeddings for
each document type and returns ranked confidence scores. Auto-selects if the
top confidence is ≥ 0.8.
"""

from __future__ import annotations

import numpy as np
from functools import lru_cache

from models.schemas import ClassificationResponse, ClassificationScore
from services.ml_models import get_sentence_model

DOC_TYPE_LABELS: dict[str, str] = {
    "writ_of_summons": "Writ of Summons",
    "statement_of_claim": "Statement of Claim",
    "affidavit": "Affidavit",
    "letter_of_demand": "Letter of Demand",
    "memorandum_of_appearance": "Memorandum of Appearance",
}

# Representative text for each document type — the classifier scores semantic
# similarity between the submitted document and these passages.
DOC_TYPE_DESCRIPTIONS: dict[str, str] = {
    "writ_of_summons": (
        "Writ of Summons filed in the High Court of Malaya by the Plaintiff against "
        "the Defendant. Plaintiff claims relief damages judgment. Solicitors for the "
        "Plaintiff. Civil suit number case number. Relief sought declaration order."
    ),
    "statement_of_claim": (
        "Statement of Claim by the Plaintiff against the Defendant. Background facts "
        "at all material times. Cause of action breach of contract negligence. "
        "Wherefore the Plaintiff claims judgment damages interest costs. Numbered "
        "paragraphs setting out the claim."
    ),
    "affidavit": (
        "Affidavit sworn before Commissioner for Oaths. I the deponent make oath and "
        "say solemnly affirm. Identity card IC number MyKad. Exhibit marked document "
        "shown. Pesuruhjaya Sumpah bersumpah mengaku benar."
    ),
    "letter_of_demand": (
        "Letter of Demand. We act for and on behalf of our client. We are instructed "
        "to demand the sum of Ringgit Malaysia RM. Within 14 days legal action "
        "proceedings without further notice. Yours faithfully Advocates Solicitors."
    ),
    "memorandum_of_appearance": (
        "Memorandum of Appearance. The Defendant enters appearance. Address for "
        "service of the Defendant. Solicitors for the Defendant. Civil suit number "
        "case number High Court Malaya."
    ),
}

AUTO_SELECT_THRESHOLD = 0.8


@lru_cache(maxsize=1)
def _get_type_embeddings():
    """Cache the document type embeddings so they are only computed once."""
    model = get_sentence_model()
    if model is None:
        return None, list(DOC_TYPE_LABELS.keys())

    keys = list(DOC_TYPE_DESCRIPTIONS.keys())
    texts = [DOC_TYPE_DESCRIPTIONS[k] for k in keys]
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings, keys


def _cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    denom = np.linalg.norm(vec_a) * np.linalg.norm(vec_b)
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)


def classify(content: str) -> ClassificationResponse:
    """
    Classify the document type by comparing its embedding against type embeddings.
    Returns ranked scores. auto_selected=True when top confidence ≥ 0.8.
    """
    model = get_sentence_model()
    type_embeddings, keys = _get_type_embeddings()

    if model is None or type_embeddings is None:
        fallback_type = "writ_of_summons"
        return ClassificationResponse(
            predicted_type=fallback_type,
            label=DOC_TYPE_LABELS[fallback_type],
            confidence=0.0,
            auto_selected=False,
            all_scores=[
                ClassificationScore(
                    document_type=k,
                    label=DOC_TYPE_LABELS[k],
                    confidence=0.0,
                )
                for k in keys
            ],
        )

    doc_embedding = model.encode(content, convert_to_numpy=True)

    scores: list[ClassificationScore] = []
    for i, key in enumerate(keys):
        sim = round(_cosine_similarity(doc_embedding, type_embeddings[i]), 4)
        scores.append(ClassificationScore(
            document_type=key,
            label=DOC_TYPE_LABELS[key],
            confidence=sim,
        ))

    scores.sort(key=lambda s: s.confidence, reverse=True)
    top = scores[0]

    return ClassificationResponse(
        predicted_type=top.document_type,
        label=top.label,
        confidence=top.confidence,
        auto_selected=top.confidence >= AUTO_SELECT_THRESHOLD,
        all_scores=scores,
    )

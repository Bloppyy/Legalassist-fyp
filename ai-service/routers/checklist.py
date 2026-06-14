"""
Checklist item matching endpoint.

Semantically matches parsed arahan required_actions against pending case
checklist item titles using the shared sentence transformer.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

from services.ml_models import get_sentence_model

router = APIRouter(prefix="/checklist", tags=["Checklist Matching"])

MATCH_THRESHOLD = 0.6


class ChecklistItem(BaseModel):
    id: str
    title: str


class ChecklistMatchRequest(BaseModel):
    required_actions: list[str]
    checklist_items: list[ChecklistItem]


class ActionMatch(BaseModel):
    action: str
    best_match_id: str | None
    best_match_title: str | None
    score: float


class ChecklistMatchResponse(BaseModel):
    matches: list[ActionMatch]
    threshold: float = MATCH_THRESHOLD


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


@router.post("/match", response_model=ChecklistMatchResponse)
def match_checklist_items(request: ChecklistMatchRequest):
    """
    For each required action from a parsed arahan, find the most semantically
    similar pending checklist item. Returns the best match and its score.
    Only matches with score ≥ 0.6 are considered meaningful.
    """
    if not request.required_actions or not request.checklist_items:
        return ChecklistMatchResponse(matches=[])

    model = get_sentence_model()
    if model is None:
        return ChecklistMatchResponse(matches=[
            ActionMatch(action=a, best_match_id=None, best_match_title=None, score=0.0)
            for a in request.required_actions
        ])

    action_texts = request.required_actions
    item_texts   = [item.title for item in request.checklist_items]

    action_embeddings = model.encode(action_texts, convert_to_numpy=True)
    item_embeddings   = model.encode(item_texts,   convert_to_numpy=True)

    matches: list[ActionMatch] = []
    for i, action in enumerate(action_texts):
        best_score = -1.0
        best_idx   = -1
        for j in range(len(item_embeddings)):
            score = _cosine(action_embeddings[i], item_embeddings[j])
            if score > best_score:
                best_score = score
                best_idx   = j

        if best_idx >= 0 and best_score >= MATCH_THRESHOLD:
            matched_item = request.checklist_items[best_idx]
            matches.append(ActionMatch(
                action=action,
                best_match_id=matched_item.id,
                best_match_title=matched_item.title,
                score=round(best_score, 4),
            ))
        else:
            matches.append(ActionMatch(
                action=action,
                best_match_id=None,
                best_match_title=None,
                score=round(max(best_score, 0.0), 4),
            ))

    return ChecklistMatchResponse(matches=matches)

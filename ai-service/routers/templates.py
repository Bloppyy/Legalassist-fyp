from fastapi import APIRouter
from models.schemas import TemplateMatchRequest, TemplateMatchResponse
from services.template_matcher import match_template

router = APIRouter(prefix="/templates", tags=["Template Matching"])


@router.post("/match", response_model=TemplateMatchResponse)
def template_match(request: TemplateMatchRequest):
    """
    Identify which document type a given text most closely resembles.

    Returns a ranked list of document types with similarity scores (0–1).
    The `best_match` field gives the top result if score > 0.05, otherwise null.

    Useful for auto-detecting the document type before running a compliance check.
    """
    return match_template(request.content)

from fastapi import APIRouter
from models.schemas import EntityRequest, EntityResponse
from services.entity_service import extract_entities

router = APIRouter(prefix="/entities", tags=["Entity Extraction"])


@router.post("/extract", response_model=EntityResponse)
def entity_extract(request: EntityRequest):
    """
    Extract legal entities from a document.

    Returns named entities including:
    - Malaysian-specific: IC_NUMBER, CASE_NUMBER, MONETARY_AMOUNT, COURT_NAME,
      MALAYSIAN_STATE, LAW_FIRM, LAND_TITLE
    - spaCy standard: PERSON, ORG, DATE, MONEY, GPE, LAW
    """
    return extract_entities(request.content)

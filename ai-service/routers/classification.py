from fastapi import APIRouter
from models.schemas import ClassificationRequest, ClassificationResponse
from services.classifier import classify

router = APIRouter(prefix="/classify", tags=["Document Classification"])


@router.post("", response_model=ClassificationResponse)
def classify_document(request: ClassificationRequest):
    """
    Classify the document type using sentence-transformer cosine similarity.

    Returns the predicted document type and a confidence score (0–1).
    When confidence ≥ 0.8 the result is safe to auto-apply (auto_selected=true).
    """
    return classify(request.content)

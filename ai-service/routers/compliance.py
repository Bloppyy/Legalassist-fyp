from fastapi import APIRouter
from models.schemas import (
    ComplianceRequest,
    ComplianceResponse,
    SimilarityComplianceResponse,
)
from services.compliance_service import check_compliance, DOCUMENT_RULES
from services.similarity_scorer import check_similarity

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.post("/check", response_model=ComplianceResponse)
def compliance_check(request: ComplianceRequest):
    """
    Check a document for compliance issues against Malaysian civil litigation standards.

    Returns a list of flagged errors/warnings with confidence scores.
    The `issues` array is suitable for storing directly in `documents.errors_flagged` (jsonb).
    """
    return check_compliance(request.content, request.document_type)


@router.post("/check-similarity", response_model=SimilarityComplianceResponse)
def compliance_check_similarity(request: ComplianceRequest):
    """
    Score a document's compliance using sentence-transformer cosine similarity.

    Returns per-section similarity scores (0–1) and flags sections below the
    threshold. A section score of 1.0 means the submitted content is semantically
    identical to the expected template section; 0.0 means no semantic overlap.
    """
    return check_similarity(request.content, request.document_type)


@router.get("/document-types")
def list_document_types():
    """
    Return all supported document types and their human-readable labels.
    Use these values as `document_type` in the compliance check request.
    """
    return {
        "document_types": [
            {"key": key, "label": value["label"]}
            for key, value in DOCUMENT_RULES.items()
        ]
    }

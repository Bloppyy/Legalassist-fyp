from fastapi import APIRouter
from models.schemas import ComplianceRequest, ComplianceResponse
from services.compliance_service import check_compliance, DOCUMENT_RULES

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.post("/check", response_model=ComplianceResponse)
def compliance_check(request: ComplianceRequest):
    """
    Check a document for compliance issues against Malaysian civil litigation standards.

    Returns a list of flagged errors/warnings with confidence scores.
    The `issues` array is suitable for storing directly in `documents.errors_flagged` (jsonb).
    """
    return check_compliance(request.content, request.document_type)


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

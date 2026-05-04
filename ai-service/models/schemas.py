from pydantic import BaseModel, Field
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Compliance check
# ---------------------------------------------------------------------------

class ComplianceRequest(BaseModel):
    content: str = Field(..., description="Raw text content of the document")
    document_type: str = Field(..., description="Type of document, e.g. 'writ_of_summons', 'affidavit'")


class ComplianceError(BaseModel):
    field: str = Field(..., description="The field or section that has an issue")
    issue: str = Field(..., description="Human-readable description of the issue")
    severity: str = Field(..., description="'error' for blocking issues, 'warning' for advisory")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score (0–1)")


class ComplianceResponse(BaseModel):
    compliant: bool = Field(..., description="True only if zero errors are found")
    document_type: str
    issues: list[ComplianceError]
    issue_count: int
    confidence: float = Field(..., description="Overall confidence of the check (0–1)")


# ---------------------------------------------------------------------------
# Entity extraction
# ---------------------------------------------------------------------------

class EntityRequest(BaseModel):
    content: str = Field(..., description="Raw text content of the document")


class ExtractedEntity(BaseModel):
    text: str = Field(..., description="The matched entity text")
    label: str = Field(..., description="Entity label, e.g. 'PERSON', 'DATE', 'IC_NUMBER'")
    start: int = Field(..., description="Character start offset in the document")
    end: int = Field(..., description="Character end offset in the document")
    confidence: float = Field(..., ge=0.0, le=1.0)


class EntityResponse(BaseModel):
    entities: list[ExtractedEntity]
    entity_count: int


# ---------------------------------------------------------------------------
# Template matching
# ---------------------------------------------------------------------------

class TemplateMatchRequest(BaseModel):
    content: str = Field(..., description="Raw text content of the document to match against templates")


class TemplateMatch(BaseModel):
    document_type: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    matched_sections: list[str]


class TemplateMatchResponse(BaseModel):
    best_match: Optional[str] = Field(None, description="document_type of the highest scoring match")
    matches: list[TemplateMatch]


# ---------------------------------------------------------------------------
# Court direction parser
# ---------------------------------------------------------------------------

class DirectionParseRequest(BaseModel):
    text: str = Field(..., description="Extracted text from the arahan document")


class DirectionParseResponse(BaseModel):
    next_court_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD or null")
    required_actions: list[str] = Field(default_factory=list)
    parties: list[str] = Field(default_factory=list)
    court_name: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)

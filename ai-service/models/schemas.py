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
# Similarity-based compliance (sentence transformer)
# ---------------------------------------------------------------------------

class SectionScore(BaseModel):
    section: str
    label: str
    score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity to template section (0–1)")
    compliant: bool


class SimilarityComplianceResponse(BaseModel):
    document_type: str
    overall_score: float = Field(..., ge=0.0, le=1.0)
    compliant: bool
    sections: list[SectionScore]
    threshold: float = Field(default=0.45, description="Score below which a section is flagged")


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
    parser_used: str = Field(default="rule_based", description="'rule_based' or 'ml'")


# ---------------------------------------------------------------------------
# Document classification
# ---------------------------------------------------------------------------

class ClassificationRequest(BaseModel):
    content: str = Field(..., description="Raw text content of the document to classify")


class ClassificationScore(BaseModel):
    document_type: str
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class ClassificationResponse(BaseModel):
    predicted_type: str
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    auto_selected: bool = Field(..., description="True if confidence ≥ 0.8 — safe to auto-apply")
    all_scores: list[ClassificationScore]


# ---------------------------------------------------------------------------
# Parser evaluation (precision / recall / F1)
# ---------------------------------------------------------------------------

class EvalGroundTruth(BaseModel):
    next_court_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD")
    court_name: Optional[str] = None
    parties: list[str] = Field(default_factory=list)
    required_actions: list[str] = Field(default_factory=list)


class FieldMetrics(BaseModel):
    precision: float = Field(..., ge=0.0, le=1.0)
    recall: float = Field(..., ge=0.0, le=1.0)
    f1: float = Field(..., ge=0.0, le=1.0)
    predicted: Any = Field(None, description="What the parser returned for this field")
    ground_truth: Any = Field(None, description="Ground truth value")


class ParserEvalResult(BaseModel):
    parser: str
    fields: dict[str, FieldMetrics]
    overall_f1: float


class EvaluationRequest(BaseModel):
    text: str
    ground_truth: EvalGroundTruth


class EvaluationResponse(BaseModel):
    rule_based: ParserEvalResult
    ml: Optional[ParserEvalResult] = None
    ml_available: bool


# ---------------------------------------------------------------------------
# Aggregate evaluation (batch run against all annotated_arahan files)
# ---------------------------------------------------------------------------

class AggregateFieldMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    support: int = Field(..., description="Number of documents where ground truth had this field")


class AggregateParserResult(BaseModel):
    parser: str
    document_count: int
    fields: dict[str, AggregateFieldMetrics]
    macro_f1: float


class AggregateEvaluationResponse(BaseModel):
    available: bool
    rule_based: Optional[AggregateParserResult] = None
    ml: Optional[AggregateParserResult] = None
    ml_available: bool = False
    evaluated_at: Optional[str] = None
    document_count: int = 0
    message: Optional[str] = None

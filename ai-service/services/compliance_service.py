"""
Compliance checking service for Malaysian civil litigation documents.

Each document type has a set of required fields/sections. The checker
scans the document text for their presence and returns a list of flagged
errors with severity and confidence scores.
"""

import re
from models.schemas import ComplianceError, ComplianceResponse

# ---------------------------------------------------------------------------
# Document type definitions
# Each entry maps a document_type key to its human label and required checks.
# A "check" is a dict with:
#   field       – name shown in the error report
#   patterns    – list of regex patterns; ANY match = field is present
#   required    – if True, absence is an 'error'; if False, a 'warning'
#   severity    – 'error' or 'warning'
#   confidence  – how confident the rule is when triggered
# ---------------------------------------------------------------------------

DOCUMENT_RULES: dict[str, dict] = {
    "writ_of_summons": {
        "label": "Writ of Summons",
        "checks": [
            {
                "field": "plaintiff_details",
                "patterns": [r"plaintiff", r"plaintif"],
                "severity": "error",
                "confidence": 0.95,
            },
            {
                "field": "defendant_details",
                "patterns": [r"defendant", r"defendan"],
                "severity": "error",
                "confidence": 0.95,
            },
            {
                "field": "case_number",
                "patterns": [r"\b[A-Z]{1,4}-?\d{1,2}[A-Za-z]*-\d+[-/]\d{4}\b", r"case no", r"kes no"],
                "severity": "error",
                "confidence": 0.90,
            },
            {
                "field": "court_name",
                "patterns": [
                    r"high court", r"mahkamah tinggi",
                    r"sessions court", r"mahkamah sesyen",
                    r"magistrate", r"majistret",
                ],
                "severity": "error",
                "confidence": 0.92,
            },
            {
                "field": "claim_amount",
                "patterns": [r"rm\s*[\d,]+", r"ringgit", r"sum of", r"amount of"],
                "severity": "warning",
                "confidence": 0.85,
            },
            {
                "field": "relief_sought",
                "patterns": [r"relief", r"remedy", r"order", r"declarati"],
                "severity": "warning",
                "confidence": 0.80,
            },
            {
                "field": "solicitor_details",
                "patterns": [r"solicitor", r"peguam", r"advocate", r"counsel"],
                "severity": "warning",
                "confidence": 0.85,
            },
        ],
    },

    "statement_of_claim": {
        "label": "Statement of Claim",
        "checks": [
            {
                "field": "plaintiff_details",
                "patterns": [r"plaintiff", r"plaintif"],
                "severity": "error",
                "confidence": 0.95,
            },
            {
                "field": "defendant_details",
                "patterns": [r"defendant", r"defendan"],
                "severity": "error",
                "confidence": 0.95,
            },
            {
                "field": "background_facts",
                "patterns": [r"on or about", r"at all material", r"at all times", r"the plaintiff"],
                "severity": "error",
                "confidence": 0.88,
            },
            {
                "field": "legal_basis",
                "patterns": [
                    r"breach of contract", r"negligence", r"breach of duty",
                    r"cause of action", r"liable", r"liability",
                ],
                "severity": "error",
                "confidence": 0.90,
            },
            {
                "field": "relief_sought",
                "patterns": [r"wherefore", r"the plaintiff claims", r"relief", r"damages"],
                "severity": "error",
                "confidence": 0.90,
            },
            {
                "field": "numbered_paragraphs",
                "patterns": [r"^\s*\d+\.\s", r"^\s*\(\d+\)\s"],
                "severity": "warning",
                "confidence": 0.75,
            },
        ],
    },

    "affidavit": {
        "label": "Affidavit",
        "checks": [
            {
                "field": "deponent_name",
                "patterns": [r"i,\s+[A-Z]", r"saya,\s+[A-Z]", r"deponent"],
                "severity": "error",
                "confidence": 0.92,
            },
            {
                "field": "ic_number",
                "patterns": [r"\d{6}-\d{2}-\d{4}", r"mykad", r"identity card", r"no. k/p"],
                "severity": "error",
                "confidence": 0.95,
            },
            {
                "field": "sworn_statement",
                "patterns": [
                    r"make oath", r"solemnly (affirm|declare)",
                    r"bersumpah", r"mengaku benar",
                ],
                "severity": "error",
                "confidence": 0.93,
            },
            {
                "field": "commissioner_for_oaths",
                "patterns": [
                    r"commissioner for oaths", r"pesuruhjaya sumpah",
                    r"sworn before", r"affirmed before",
                ],
                "severity": "error",
                "confidence": 0.90,
            },
            {
                "field": "exhibit_references",
                "patterns": [r"exhibit\s+[A-Z]-?\d*", r"ekshibit\s+[A-Z]-?\d*"],
                "severity": "warning",
                "confidence": 0.80,
            },
        ],
    },

    "letter_of_demand": {
        "label": "Letter of Demand",
        "checks": [
            {
                "field": "recipient_details",
                "patterns": [r"dear\s+(sir|madam|mr|ms|encik|puan|tuan)", r"to\s*:", r"kepada"],
                "severity": "error",
                "confidence": 0.90,
            },
            {
                "field": "our_client_reference",
                "patterns": [r"our client", r"anak guam kami", r"we act for", r"we are instructed"],
                "severity": "error",
                "confidence": 0.92,
            },
            {
                "field": "demand_amount",
                "patterns": [r"rm\s*[\d,]+", r"ringgit", r"sum of", r"amount"],
                "severity": "error",
                "confidence": 0.92,
            },
            {
                "field": "payment_deadline",
                "patterns": [
                    r"\d+\s+days?", r"within\s+\d+",
                    r"before\s+\d{1,2}\s+\w+\s+\d{4}",
                    r"hari\s+dari",
                ],
                "severity": "error",
                "confidence": 0.88,
            },
            {
                "field": "legal_action_warning",
                "patterns": [
                    r"legal (action|proceedings)", r"without further notice",
                    r"tindakan undang-undang", r"court proceedings",
                ],
                "severity": "warning",
                "confidence": 0.85,
            },
            {
                "field": "firm_signature_block",
                "patterns": [r"yours (faithfully|sincerely|truly)", r"yang benar", r"advocates"],
                "severity": "warning",
                "confidence": 0.82,
            },
        ],
    },

    "memorandum_of_appearance": {
        "label": "Memorandum of Appearance",
        "checks": [
            {
                "field": "defendant_name",
                "patterns": [r"defendant", r"defendan"],
                "severity": "error",
                "confidence": 0.95,
            },
            {
                "field": "case_number",
                "patterns": [r"\b[A-Z]{1,4}-?\d{1,2}[A-Za-z]*-\d+[-/]\d{4}\b", r"case no", r"kes no"],
                "severity": "error",
                "confidence": 0.92,
            },
            {
                "field": "solicitor_details",
                "patterns": [r"solicitor", r"peguam", r"advocate"],
                "severity": "error",
                "confidence": 0.90,
            },
            {
                "field": "address_for_service",
                "patterns": [r"address for service", r"alamat untuk servis", r"whose address"],
                "severity": "error",
                "confidence": 0.88,
            },
        ],
    },

    "general": {
        "label": "General Legal Document",
        "checks": [
            {
                "field": "party_details",
                "patterns": [r"plaintiff|defendant|claimant|respondent|appellant"],
                "severity": "warning",
                "confidence": 0.80,
            },
            {
                "field": "date",
                "patterns": [
                    r"\d{1,2}\s+\w+\s+\d{4}",
                    r"\d{1,2}/\d{1,2}/\d{4}",
                    r"dated\s+this",
                ],
                "severity": "warning",
                "confidence": 0.85,
            },
            {
                "field": "signature_block",
                "patterns": [r"signed", r"signature", r"yours", r"yang benar"],
                "severity": "warning",
                "confidence": 0.75,
            },
        ],
    },
}

GENERIC_QUALITY_CHECKS = [
    {
        "field": "document_length",
        "min_words": 30,
        "issue": "Document appears too short — likely incomplete",
        "severity": "error",
        "confidence": 0.98,
    },
    {
        "field": "date_present",
        "patterns": [
            r"\d{1,2}\s+(?:january|february|march|april|may|june|july|august|"
            r"september|october|november|december)\s+\d{4}",
            r"\d{1,2}/\d{1,2}/\d{4}",
            r"dated",
        ],
        "issue": "No date found in document",
        "severity": "warning",
        "confidence": 0.88,
    },
]


def _text_contains(text: str, patterns: list[str]) -> bool:
    """Return True if any pattern matches anywhere in the lowercased text."""
    lower = text.lower()
    for pattern in patterns:
        if re.search(pattern, lower, re.MULTILINE | re.IGNORECASE):
            return True
    return False


def check_compliance(content: str, document_type: str) -> ComplianceResponse:
    """
    Check a document for compliance issues.

    Falls back to 'general' rules if document_type is not recognised.
    """
    rules = DOCUMENT_RULES.get(document_type, DOCUMENT_RULES["general"])
    issues: list[ComplianceError] = []

    # --- Document-type-specific field checks ---
    for check in rules["checks"]:
        if not _text_contains(content, check["patterns"]):
            issues.append(
                ComplianceError(
                    field=check["field"],
                    issue=f"Required field '{check['field'].replace('_', ' ')}' not found in document",
                    severity=check["severity"],
                    confidence=check["confidence"],
                )
            )

    # --- Generic quality checks ---
    word_count = len(content.split())
    min_words = GENERIC_QUALITY_CHECKS[0]["min_words"]
    if word_count < min_words:
        issues.append(
            ComplianceError(
                field="document_length",
                issue=f"Document has only {word_count} words (minimum {min_words} expected)",
                severity="error",
                confidence=0.98,
            )
        )

    date_check = GENERIC_QUALITY_CHECKS[1]
    if not _text_contains(content, date_check["patterns"]):
        issues.append(
            ComplianceError(
                field=date_check["field"],
                issue=date_check["issue"],
                severity=date_check["severity"],
                confidence=date_check["confidence"],
            )
        )

    # Overall confidence = average of triggered rule confidences, or 1.0 if clean
    overall_confidence = (
        1.0
        if not issues
        else round(sum(i.confidence for i in issues) / len(issues), 3)
    )

    return ComplianceResponse(
        compliant=len(issues) == 0,
        document_type=document_type,
        issues=issues,
        issue_count=len(issues),
        confidence=overall_confidence,
    )

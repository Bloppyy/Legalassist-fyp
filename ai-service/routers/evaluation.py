"""
Parser evaluation endpoints.

POST /evaluate-parser          — evaluate both parsers on a single document
POST /evaluate-parser/run-batch — batch-evaluate across all annotated_arahan files
GET  /evaluate-parser/aggregate — return last stored batch results
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from models.schemas import (
    AggregateEvaluationResponse,
    AggregateFieldMetrics,
    AggregateParserResult,
    EvaluationRequest,
    EvaluationResponse,
    FieldMetrics,
    ParserEvalResult,
)
from services import direction_parser, ml_parser

router = APIRouter(prefix="/evaluate-parser", tags=["Parser Evaluation"])

ANNOTATED_DIR = Path(__file__).parent.parent / "training" / "annotated_arahan"
RESULTS_FILE  = Path(__file__).parent.parent / "training" / "evaluation_results" / "results.json"


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def _normalise(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    return text.strip().lower()


def _scalar_metrics(predicted: Optional[str], ground_truth: Optional[str]) -> FieldMetrics:
    """Precision/recall/F1 for a single-value field."""
    p_norm = _normalise(predicted)
    g_norm = _normalise(ground_truth)

    if g_norm is None and p_norm is None:
        return FieldMetrics(precision=1.0, recall=1.0, f1=1.0, predicted=predicted, ground_truth=ground_truth)
    if g_norm is None:
        return FieldMetrics(precision=0.0, recall=1.0, f1=0.0, predicted=predicted, ground_truth=ground_truth)
    if p_norm is None:
        return FieldMetrics(precision=1.0, recall=0.0, f1=0.0, predicted=predicted, ground_truth=ground_truth)

    match = 1.0 if p_norm == g_norm else 0.0
    return FieldMetrics(precision=match, recall=match, f1=match, predicted=predicted, ground_truth=ground_truth)


def _list_metrics(predicted: list[str], ground_truth: list[str]) -> FieldMetrics:
    """Set-based precision/recall/F1 for list fields. Uses partial-string matching."""
    if not ground_truth and not predicted:
        return FieldMetrics(precision=1.0, recall=1.0, f1=1.0, predicted=predicted, ground_truth=ground_truth)

    def _matches(pred: str, truths: list[str]) -> bool:
        p = pred.lower()
        return any(p in t.lower() or t.lower() in p for t in truths)

    tp = sum(1 for p in predicted if _matches(p, ground_truth))
    fp = len(predicted) - tp
    fn = sum(1 for g in ground_truth if not _matches(g, predicted))

    precision = tp / (tp + fp) if (tp + fp) > 0 else (1.0 if not predicted else 0.0)
    recall    = tp / (tp + fn) if (tp + fn) > 0 else (1.0 if not ground_truth else 0.0)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return FieldMetrics(
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        predicted=predicted,
        ground_truth=ground_truth,
    )


def _evaluate_response(response, ground_truth) -> dict[str, FieldMetrics]:
    return {
        "next_court_date": _scalar_metrics(response.next_court_date, ground_truth.next_court_date),
        "court_name":      _scalar_metrics(response.court_name, ground_truth.court_name),
        "parties":         _list_metrics(response.parties, ground_truth.parties),
        "required_actions": _list_metrics(response.required_actions, ground_truth.required_actions),
    }


def _overall_f1(fields: dict[str, FieldMetrics]) -> float:
    f1s = [m.f1 for m in fields.values()]
    return round(sum(f1s) / len(f1s), 4) if f1s else 0.0


# ---------------------------------------------------------------------------
# Single-document evaluation
# ---------------------------------------------------------------------------

@router.post("", response_model=EvaluationResponse)
def evaluate_parser(request: EvaluationRequest):
    """
    Evaluate both parsers on a single document against provided ground truth.
    Returns per-field precision/recall/F1 for the rule-based parser and (if
    available) the ML parser.
    """
    rule_response = direction_parser.parse_direction(request.text)
    rule_fields   = _evaluate_response(rule_response, request.ground_truth)

    ml_result: Optional[ParserEvalResult] = None
    ml_available = ml_parser.is_available()

    if ml_available:
        ml_response = ml_parser.predict(request.text)
        if ml_response is not None:
            ml_fields = _evaluate_response(ml_response, request.ground_truth)
            ml_result = ParserEvalResult(
                parser="ml",
                fields=ml_fields,
                overall_f1=_overall_f1(ml_fields),
            )

    return EvaluationResponse(
        rule_based=ParserEvalResult(
            parser="rule_based",
            fields=rule_fields,
            overall_f1=_overall_f1(rule_fields),
        ),
        ml=ml_result,
        ml_available=ml_available,
    )


# ---------------------------------------------------------------------------
# Batch evaluation
# ---------------------------------------------------------------------------

def _run_batch_evaluation() -> dict:
    files = sorted(ANNOTATED_DIR.glob("*.json"))
    if not files:
        return {"available": False, "message": "No annotated files found.", "document_count": 0}

    # Accumulator: field → list of (precision, recall, f1) per doc where support > 0
    field_names = ["next_court_date", "court_name", "parties", "required_actions"]
    rb_acc: dict[str, list[tuple[float, float, float]]] = {f: [] for f in field_names}
    ml_acc: dict[str, list[tuple[float, float, float]]] = {f: [] for f in field_names}
    ml_available = ml_parser.is_available()

    processed = 0
    for fpath in files:
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
        except Exception:
            continue

        text = data.get("text", "")
        labels = data.get("labels", {})
        if not text:
            continue

        from models.schemas import EvalGroundTruth
        gt = EvalGroundTruth(
            next_court_date=labels.get("next_court_date"),
            court_name=labels.get("court_name"),
            parties=labels.get("parties", []),
            required_actions=labels.get("required_actions", []),
        )

        rb_resp   = direction_parser.parse_direction(text)
        rb_fields = _evaluate_response(rb_resp, gt)
        for field, metrics in rb_fields.items():
            rb_acc[field].append((metrics.precision, metrics.recall, metrics.f1))

        if ml_available:
            ml_resp = ml_parser.predict(text)
            if ml_resp:
                ml_fields = _evaluate_response(ml_resp, gt)
                for field, metrics in ml_fields.items():
                    ml_acc[field].append((metrics.precision, metrics.recall, metrics.f1))

        processed += 1

    def _aggregate(acc: dict[str, list[tuple[float, float, float]]]) -> dict[str, AggregateFieldMetrics]:
        result = {}
        for field, vals in acc.items():
            if not vals:
                result[field] = AggregateFieldMetrics(precision=0.0, recall=0.0, f1=0.0, support=0)
            else:
                result[field] = AggregateFieldMetrics(
                    precision=round(sum(v[0] for v in vals) / len(vals), 4),
                    recall=round(sum(v[1] for v in vals) / len(vals), 4),
                    f1=round(sum(v[2] for v in vals) / len(vals), 4),
                    support=len(vals),
                )
        return result

    rb_agg   = _aggregate(rb_acc)
    macro_rb = round(sum(m.f1 for m in rb_agg.values()) / len(rb_agg), 4) if rb_agg else 0.0

    rb_result = AggregateParserResult(
        parser="rule_based",
        document_count=processed,
        fields=rb_agg,
        macro_f1=macro_rb,
    )

    ml_result = None
    if ml_available and any(ml_acc[f] for f in field_names):
        ml_agg   = _aggregate(ml_acc)
        macro_ml = round(sum(m.f1 for m in ml_agg.values()) / len(ml_agg), 4) if ml_agg else 0.0
        ml_result = AggregateParserResult(
            parser="ml",
            document_count=processed,
            fields=ml_agg,
            macro_f1=macro_ml,
        )

    return {
        "available": True,
        "rule_based": rb_result.model_dump(),
        "ml": ml_result.model_dump() if ml_result else None,
        "ml_available": ml_available,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "document_count": processed,
        "message": None,
    }


@router.post("/run-batch", response_model=AggregateEvaluationResponse)
def run_batch_evaluation():
    """
    Run evaluation across all annotated arahan files and persist the results.
    This can take several seconds — call on demand, not on every request.
    """
    if not ANNOTATED_DIR.exists():
        raise HTTPException(status_code=404, detail="annotated_arahan directory not found")

    result = _run_batch_evaluation()

    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, default=str)

    return AggregateEvaluationResponse(**result)


@router.get("/aggregate", response_model=AggregateEvaluationResponse)
def get_aggregate_evaluation():
    """
    Return the last stored batch evaluation results.
    Returns available=false if no batch has been run yet.
    """
    if not RESULTS_FILE.exists():
        return AggregateEvaluationResponse(
            available=False,
            ml_available=ml_parser.is_available(),
            message="No evaluation results yet. POST /evaluate-parser/run-batch to compute.",
        )

    try:
        data = json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
        return AggregateEvaluationResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read results: {e}")

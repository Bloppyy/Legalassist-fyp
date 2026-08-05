#!/usr/bin/env python3
"""
Leave-one-base-group-out cross-validation for the arahan NER parser.
Fixes the evaluation leakage in the original pipeline (ML was evaluated on
documents it trained on — see evaluation_results/results.json, 2026-06-18,
document_count=17 covering both train and "test", 1.0/1.0/1.0 scores on
3 of 4 fields as the tell).

5 folds, one per base example. Each fold's test set = that base example +
its own 2 augmented variants (3 docs), never seen in that fold's training.
arahan_aug_011/012 (cv_excluded=True) are always in training, never in test.
Rule-based is evaluated once on the same 15 evaluable documents used for the
pooled ML result, so both columns in the report's comparison table share an
identical N.

Run backfill_lineage.py first. Never touches training/model-best/ or
training/model-last/ — writes only to training/cv_models/ (scratch).

Usage:
    cd ai-service/training
    python cv_evaluate.py
    python cv_evaluate.py --epochs 15
"""
from __future__ import annotations
import argparse, json, random, shutil, sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from train_parser import load_annotations, run_training, DEFAULT_EPOCHS
from services import direction_parser
from services import ml_parser as ml_parser_module
from routers.evaluation import _evaluate_response, _aggregate
from models.schemas import EvalGroundTruth

CV_MODELS_DIR = Path(__file__).parent / "cv_models"
RESULTS_FILE  = Path(__file__).parent / "evaluation_results" / "cv_results.json"


def _ground_truth(ann: dict) -> EvalGroundTruth:
    labels = ann.get("labels", {})
    return EvalGroundTruth(
        next_court_date=labels.get("next_court_date"), court_name=labels.get("court_name"),
        parties=labels.get("parties", []), required_actions=labels.get("required_actions", []),
    )


def run_cv(epochs: int):
    all_docs = load_annotations()
    evaluable = [d for d in all_docs if not d.get("cv_excluded", False)]
    train_only = [d for d in all_docs if d.get("cv_excluded", False)]
    groups = sorted({d["group_id"] for d in evaluable if d.get("group_id")})

    if len(groups) < 2:
        sys.exit("group_id/cv_excluded missing on documents — run backfill_lineage.py first.")

    print(f"Evaluable: {len(evaluable)} across {len(groups)} groups")
    print(f"Train-only (excluded from every test fold): {[d['document_id'] for d in train_only]}\n")

    if CV_MODELS_DIR.exists():
        shutil.rmtree(CV_MODELS_DIR)
    CV_MODELS_DIR.mkdir(parents=True)

    ml_predictions: dict[str, dict] = {}
    fold_macro_f1s: list[float] = []

    for i, held_out in enumerate(groups, start=1):
        test_docs  = [d for d in evaluable if d["group_id"] == held_out]
        train_docs = [d for d in evaluable if d["group_id"] != held_out] + train_only
        print(f"--- Fold {i}/{len(groups)}: held out {held_out} "
              f"({len(test_docs)} test, {len(train_docs)} train) ---")

        random.shuffle(train_docs)
        dev_cut = max(1, int(len(train_docs) * 0.15))
        inner_dev, inner_train = train_docs[:dev_cut], train_docs[dev_cut:]

        fold_dir = CV_MODELS_DIR / f"fold_{i}"
        best_f1 = run_training(inner_train, inner_dev, fold_dir, epochs, verbose=True)
        print(f"Fold {i} best inner-dev F1: {best_f1:.3f}")

        from transformers import pipeline
        ner = pipeline("ner", model=str(fold_dir), tokenizer=str(fold_dir),
                       aggregation_strategy="simple", device=-1)

        fold_metrics = {f: [] for f in ("next_court_date", "court_name", "parties", "required_actions")}
        for doc in test_docs:
            resp = ml_parser_module.predict_with_pipeline(doc["text"], ner)
            if resp is None:
                continue
            fields = _evaluate_response(resp, _ground_truth(doc))
            ml_predictions[doc["document_id"]] = fields
            for f, m in fields.items():
                fold_metrics[f].append(m.f1)

        fold_macro = sum(sum(v) / len(v) for v in fold_metrics.values() if v) / len(fold_metrics)
        fold_macro_f1s.append(fold_macro)
        print(f"Fold {i} test macro F1: {fold_macro:.3f}\n")
        del ner

    ml_acc = {f: [] for f in ("next_court_date", "court_name", "parties", "required_actions")}
    for fields in ml_predictions.values():
        for f, m in fields.items():
            ml_acc[f].append((m.precision, m.recall, m.f1))
    ml_agg = _aggregate(ml_acc)
    ml_macro = round(sum(m.f1 for m in ml_agg.values()) / len(ml_agg), 4)

    rb_acc = {f: [] for f in ("next_court_date", "court_name", "parties", "required_actions")}
    for doc in evaluable:
        fields = _evaluate_response(direction_parser.parse_direction(doc["text"]), _ground_truth(doc))
        for f, m in fields.items():
            rb_acc[f].append((m.precision, m.recall, m.f1))
    rb_agg = _aggregate(rb_acc)
    rb_macro = round(sum(m.f1 for m in rb_agg.values()) / len(rb_agg), 4)

    mean_f1 = round(sum(fold_macro_f1s) / len(fold_macro_f1s), 4)
    std_f1 = round((sum((x - mean_f1) ** 2 for x in fold_macro_f1s) / len(fold_macro_f1s)) ** 0.5, 4)

    result = {
        "method": "leave-one-base-group-out cross-validation",
        "n_groups": len(groups),
        "n_evaluable_documents": len(evaluable),
        "train_only_document_ids": [d["document_id"] for d in train_only],
        "rule_based": {"parser": "rule_based", "document_count": len(evaluable),
                       "fields": {f: m.model_dump() for f, m in rb_agg.items()}, "macro_f1": rb_macro},
        "ml_pooled": {"parser": "ml", "document_count": len(ml_predictions),
                      "fields": {f: m.model_dump() for f, m in ml_agg.items()}, "macro_f1": ml_macro,
                      "note": "Out-of-fold predictions pooled across 5 folds — no document evaluated by a model it trained on."},
        "ml_per_fold_macro_f1": fold_macro_f1s,
        "ml_mean_fold_f1": mean_f1,
        "ml_std_fold_f1": std_f1,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_FILE.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")

    print("=" * 60)
    print(f"Rule-based macro F1 (N={len(evaluable)}): {rb_macro}")
    print(f"ML pooled macro F1  (N={len(ml_predictions)}): {ml_macro}")
    print(f"ML per-fold: {fold_macro_f1s}  ->  mean {mean_f1} ± std {std_f1}")
    print(f"Saved to {RESULTS_FILE}")
    print("cv_models/ has 5 scratch checkpoints — safe to delete, does NOT touch training/model-best/.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    run_cv(ap.parse_args().epochs)

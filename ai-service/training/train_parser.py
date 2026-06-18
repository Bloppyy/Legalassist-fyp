#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys; sys.stdout.reconfigure(encoding="utf-8", errors="replace")
"""
Fine-tune bert-base-multilingual-cased for Malaysian court direction (arahan) NER
using HuggingFace transformers - no spaCy transformer pipeline required.

Prerequisites:
    pip install transformers torch   (already satisfied)

Usage:
    python train_parser.py                 # train with all annotated arahan
    python train_parser.py --epochs 20     # override epoch count
    python train_parser.py --eval-only     # evaluate existing model without retraining

Entity labels:
    NEXT_COURT_DATE   — the next court hearing date
    COURT_NAME        — the issuing court name
    PARTY             — plaintiff / defendant / applicant names
    REQUIRED_ACTION   — directed action sentences

Output:
    training/model-best/   — best checkpoint (highest dev entity F1)
    training/model-last/   — final epoch checkpoint
"""

import argparse
import json
import random
import sys
from pathlib import Path

TRAINING_DIR = Path(__file__).parent / "annotated_arahan"
MODEL_BEST   = Path(__file__).parent / "model-best"
MODEL_LAST   = Path(__file__).parent / "model-last"

TRANSFORMER_MODEL = "bert-base-multilingual-cased"
DEFAULT_EPOCHS    = 15
LEARNING_RATE     = 5e-5
MAX_LENGTH        = 512   # truncation limit — actual texts are 50-100 tokens

# BIO label scheme
LABELS = [
    "O",
    "B-NEXT_COURT_DATE", "I-NEXT_COURT_DATE",
    "B-COURT_NAME",      "I-COURT_NAME",
    "B-PARTY",           "I-PARTY",
    "B-REQUIRED_ACTION", "I-REQUIRED_ACTION",
]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
ID2LABEL = {i: l for i, l in enumerate(LABELS)}

FIELD_TO_ENTITY = {
    "next_court_date":  "NEXT_COURT_DATE",
    "court_name":       "COURT_NAME",
    "parties":          "PARTY",
    "required_actions": "REQUIRED_ACTION",
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_annotations() -> list[dict]:
    files = sorted(TRAINING_DIR.glob("*.json"))
    if not files:
        sys.exit(f"No annotation files in {TRAINING_DIR}. Run seed_annotations.py first.")

    docs = []
    skipped = 0
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            spans = data.get("spans", {})
            has_spans = (
                spans.get("next_court_date") is not None
                or spans.get("court_name") is not None
                or len(spans.get("parties", [])) > 0
                or len(spans.get("required_actions", [])) > 0
            )
            if has_spans:
                docs.append(data)
            else:
                skipped += 1
        except Exception as e:
            print(f"Warning: could not load {f.name}: {e}")

    print(f"Loaded {len(docs)} annotated documents ({skipped} skipped - no spans).")
    return docs


def get_char_spans(annotation: dict) -> list[tuple[int, int, str]]:
    """Extract (char_start, char_end, entity_type) from annotation spans."""
    spans = annotation.get("spans", {})
    char_spans = []
    for field in ("next_court_date", "court_name"):
        s = spans.get(field)
        if s:
            char_spans.append((s["start"], s["end"], FIELD_TO_ENTITY[field]))
    for field in ("parties", "required_actions"):
        for s in spans.get(field, []):
            char_spans.append((s["start"], s["end"], FIELD_TO_ENTITY[field]))
    return char_spans


# ---------------------------------------------------------------------------
# Tokenization and BIO label alignment
# ---------------------------------------------------------------------------

def tokenize_and_align(tokenizer, text: str, char_spans: list[tuple[int, int, str]]) -> dict:
    """
    Tokenize text and align character-level span labels to subword tokens.
    Returns dict with input_ids, attention_mask, token_type_ids, labels.
    Special tokens and padding get label -100 (ignored in loss).
    """
    encoding = tokenizer(
        text,
        return_offsets_mapping=True,
        truncation=True,
        max_length=MAX_LENGTH,
        padding=False,          # no padding — process actual length only (batch size = 1)
        return_tensors=None,
    )

    offset_mapping = encoding.pop("offset_mapping")
    sequence_ids  = encoding.sequence_ids() if hasattr(encoding, "sequence_ids") else None
    token_labels  = []

    for i, (tok_start, tok_end) in enumerate(offset_mapping):
        # Special / padding tokens
        is_special = (sequence_ids[i] is None) if sequence_ids is not None else (tok_start == 0 and tok_end == 0)
        if is_special:
            token_labels.append(-100)
            continue

        label_id = LABEL2ID["O"]
        for span_start, span_end, entity_type in char_spans:
            # Token overlaps with span?
            if tok_start >= span_start and tok_end <= span_end:
                bio_prefix = "B-" if tok_start == span_start else "I-"
                label_id = LABEL2ID[bio_prefix + entity_type]
                break

        token_labels.append(label_id)

    encoding["labels"] = token_labels
    return encoding


# ---------------------------------------------------------------------------
# Entity-level F1 (no external library required)
# ---------------------------------------------------------------------------

def _extract_entities(bio_seq: list[str]) -> set[tuple[int, int, str]]:
    entities: set[tuple[int, int, str]] = set()
    cur = None
    for i, tag in enumerate(bio_seq):
        if tag.startswith("B-"):
            if cur:
                entities.add(cur)
            cur = (i, i, tag[2:])
        elif tag.startswith("I-") and cur and tag[2:] == cur[2]:
            cur = (cur[0], i, cur[2])
        else:
            if cur:
                entities.add(cur)
            cur = None
    if cur:
        entities.add(cur)
    return entities


def entity_f1(pred_bio: list[str], true_bio: list[str]) -> float:
    pe = _extract_entities(pred_bio)
    te = _extract_entities(true_bio)
    tp = len(pe & te)
    precision = tp / len(pe) if pe else 0.0
    recall    = tp / len(te) if te else 0.0
    return (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0


# ---------------------------------------------------------------------------
# Evaluation pass
# ---------------------------------------------------------------------------

def evaluate_model(model, tokenizer, data: list[dict]) -> float:
    import torch
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for ann in data:
            enc = tokenize_and_align(tokenizer, ann["text"], get_char_spans(ann))
            raw_labels = enc.pop("labels")
            inputs = {k: torch.tensor([v]) for k, v in enc.items()}
            logits = model(**inputs).logits[0]
            preds  = logits.argmax(-1).tolist()
            for pred, lbl in zip(preds, raw_labels):
                if lbl != -100:
                    all_preds.append(ID2LABEL.get(pred, "O"))
                    all_labels.append(ID2LABEL.get(lbl, "O"))
    return entity_f1(all_preds, all_labels)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(epochs: int):
    import torch
    from transformers import AutoTokenizer, AutoModelForTokenClassification

    annotations = load_annotations()
    if len(annotations) < 2:
        sys.exit(
            f"Need at least 2 annotated documents with spans (have {len(annotations)}).\n"
            f"Run python seed_annotations.py && python augment.py first."
        )

    random.shuffle(annotations)
    split      = max(1, int(len(annotations) * 0.8))
    train_data = annotations[:split]
    dev_data   = annotations[split:] or annotations[:1]

    print(f"Transformer : {TRANSFORMER_MODEL}")
    print(f"Train docs  : {len(train_data)}  |  Dev docs: {len(dev_data)}")
    print(f"Epochs      : {epochs}\n")
    print("Downloading / loading tokenizer + model weights...")

    tokenizer = AutoTokenizer.from_pretrained(TRANSFORMER_MODEL)
    model = AutoModelForTokenClassification.from_pretrained(
        TRANSFORMER_MODEL,
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        ignore_mismatched_sizes=True,
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)

    best_f1 = -1.0
    print("-" * 60)

    for epoch in range(1, epochs + 1):
        model.train()
        random.shuffle(train_data)
        epoch_loss = 0.0

        for ann in train_data:
            enc = tokenize_and_align(tokenizer, ann["text"], get_char_spans(ann))
            labels = torch.tensor([enc.pop("labels")])
            inputs = {k: torch.tensor([v]) for k, v in enc.items()}

            outputs = model(**inputs, labels=labels)
            loss = outputs.loss

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()

        avg_loss = epoch_loss / len(train_data)
        f1 = evaluate_model(model, tokenizer, dev_data)
        flag = "  <-- best" if f1 > best_f1 else ""
        print(f"Epoch {epoch:>3}/{epochs}  loss={avg_loss:>7.4f}  dev_F1={f1:.3f}{flag}")

        if f1 > best_f1:
            best_f1 = f1
            MODEL_BEST.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(MODEL_BEST)
            tokenizer.save_pretrained(MODEL_BEST)

    MODEL_LAST.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(MODEL_LAST)
    tokenizer.save_pretrained(MODEL_LAST)

    print("-" * 60)
    print(f"Training complete.  Best dev F1: {best_f1:.3f}")
    print(f"Best model saved to : {MODEL_BEST}")
    print()
    print("Next steps:")
    print("  1. Restart ai-service (ml_parser auto-loads from model-best/)")
    print("  2. POST /evaluate-parser/run-batch to compute P/R/F1")
    print("  3. View /admin/parser-stats for the rule-based vs ML comparison table")


# ---------------------------------------------------------------------------
# Evaluate only (requires trained model)
# ---------------------------------------------------------------------------

def evaluate_only():
    import torch
    from transformers import AutoTokenizer, AutoModelForTokenClassification

    if not MODEL_BEST.exists():
        sys.exit(f"No trained model at {MODEL_BEST}. Run training first.")

    annotations = load_annotations()
    if not annotations:
        sys.exit("No annotations to evaluate.")

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_BEST))
    model     = AutoModelForTokenClassification.from_pretrained(str(MODEL_BEST))

    f1 = evaluate_model(model, tokenizer, annotations)
    print(f"\nEvaluation on all {len(annotations)} annotated documents:")
    print(f"  Entity F1: {f1:.3f}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Fine-tune multilingual BERT for arahan NER")
    ap.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    ap.add_argument("--eval-only", action="store_true")
    args = ap.parse_args()

    if args.eval_only:
        evaluate_only()
    else:
        train(args.epochs)

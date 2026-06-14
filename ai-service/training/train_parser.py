#!/usr/bin/env python3
"""
Fine-tune multilingual BERT for Malaysian court direction (arahan) NER
using spaCy's transformer pipeline.

Prerequisites:
    pip install spacy-transformers torch

Usage:
    python train_parser.py                 # train with all annotated arahan
    python train_parser.py --epochs 15     # override epoch count
    python train_parser.py --eval-only     # evaluate existing model without retraining

Entity labels extracted:
    NEXT_COURT_DATE   — the next court hearing date
    COURT_NAME        — the issuing court
    PARTY             — plaintiff / defendant / applicant names
    REQUIRED_ACTION   — directed action sentences

Output:
    training/model-best/      — best checkpoint (highest dev F1)
    training/model-last/      — final epoch checkpoint
"""

import argparse
import json
import random
import sys
from pathlib import Path

TRAINING_DIR = Path(__file__).parent / "annotated_arahan"
MODEL_BEST   = Path(__file__).parent / "model-best"
MODEL_LAST   = Path(__file__).parent / "model-last"

ENTITY_LABELS = ["NEXT_COURT_DATE", "COURT_NAME", "PARTY", "REQUIRED_ACTION"]

LABEL_MAP = {
    "next_court_date":  "NEXT_COURT_DATE",
    "court_name":       "COURT_NAME",
    "parties":          "PARTY",
    "required_actions": "REQUIRED_ACTION",
}

TRANSFORMER_MODEL = "bert-base-multilingual-cased"
DEFAULT_EPOCHS    = 12
BATCH_SIZE        = 2   # small batches for limited data
DROPOUT           = 0.2


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_annotations() -> list[dict]:
    files = sorted(TRAINING_DIR.glob("*.json"))
    if not files:
        sys.exit(f"No annotation files in {TRAINING_DIR}. Run annotate.py first.")

    docs = []
    skipped = 0
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            spans = data.get("spans", {})
            # Require at least one span annotation for NER training
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

    print(f"Loaded {len(docs)} annotated documents ({skipped} skipped — no spans).")
    return docs


def to_spacy_entities(annotation: dict) -> list[tuple[int, int, str]]:
    """Convert annotation JSON spans to spaCy (start, end, label) tuples."""
    entities: list[tuple[int, int, str]] = []
    spans = annotation.get("spans", {})

    # Single spans
    for field in ("next_court_date", "court_name"):
        span = spans.get(field)
        if span:
            entities.append((span["start"], span["end"], LABEL_MAP[field]))

    # List spans
    for field in ("parties", "required_actions"):
        for span in spans.get(field, []):
            entities.append((span["start"], span["end"], LABEL_MAP[field]))

    # Remove overlapping spans (keep first)
    entities.sort(key=lambda e: e[0])
    clean = []
    last_end = -1
    for start, end, label in entities:
        if start >= last_end:
            clean.append((start, end, label))
            last_end = end

    return clean


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def build_nlp():
    """Create a blank spaCy pipeline with transformer + NER."""
    import spacy
    try:
        import spacy_transformers  # noqa: F401
    except ImportError:
        sys.exit(
            "spacy-transformers not installed.\n"
            "Run:  pip install spacy-transformers torch\n"
            "Note: requires ~2–5 GB disk for model weights."
        )

    nlp = spacy.blank("en")

    transformer_config = {
        "model": {
            "@architectures": "spacy-transformers.TransformerModel.v3",
            "name": TRANSFORMER_MODEL,
            "tokenizer_config": {"use_fast": True},
            "transformer_config": {},
            "mixed_precision": False,
            "grad_scaler_config": {},
        }
    }
    nlp.add_pipe("transformer", config=transformer_config)

    ner_config = {
        "model": {
            "@architectures": "spacy.TransitionBasedParser.v2",
            "state_type": "ner",
            "extra_state_tokens": False,
            "hidden_width": 64,
            "maxout_pieces": 2,
            "use_upper": True,
            "nO": None,
            "tok2vec": {
                "@architectures": "spacy-transformers.TransformerListener.v1",
                "grad_factor": 1.0,
                "upstream": "transformer",
                "pooling": {"@layers": "reduce_mean.v1"},
            },
        }
    }
    ner = nlp.add_pipe("ner", last=True, config=ner_config)
    for label in ENTITY_LABELS:
        ner.add_label(label)

    return nlp


def make_examples(nlp, data: list[dict]):
    """Convert annotation dicts to spaCy Example objects."""
    import spacy
    from spacy.training import Example

    examples = []
    for ann in data:
        text = ann["text"]
        entities = to_spacy_entities(ann)
        doc = nlp.make_doc(text)
        try:
            example = Example.from_dict(doc, {"entities": entities})
            examples.append(example)
        except Exception as e:
            print(f"  Warning: skipping {ann['document_id']} — {e}")
    return examples


def train(epochs: int):
    import spacy
    from spacy.util import minibatch, compounding

    annotations = load_annotations()
    if len(annotations) < 2:
        sys.exit(
            f"Need at least 2 annotated documents with spans.\n"
            f"Currently have {len(annotations)}. Add more annotations with annotate.py."
        )

    random.shuffle(annotations)
    split = max(1, int(len(annotations) * 0.8))
    train_data = annotations[:split]
    dev_data   = annotations[split:] or annotations[:1]

    print(f"Train: {len(train_data)} docs | Dev: {len(dev_data)} docs")
    print(f"Transformer: {TRANSFORMER_MODEL}")
    print(f"Epochs: {epochs}\n")

    nlp = build_nlp()
    optimizer = nlp.initialize(lambda: make_examples(nlp, train_data))

    best_f1 = -1.0
    for epoch in range(1, epochs + 1):
        random.shuffle(train_data)
        losses: dict = {}
        examples = make_examples(nlp, train_data)

        for batch in minibatch(examples, size=compounding(BATCH_SIZE, 8, 1.001)):
            nlp.update(batch, drop=DROPOUT, sgd=optimizer, losses=losses)

        # Evaluate on dev set
        dev_examples = make_examples(nlp, dev_data)
        scores = nlp.evaluate(dev_examples)
        f1 = round(scores.get("ents_f", 0.0), 3)
        prec = round(scores.get("ents_p", 0.0), 3)
        rec  = round(scores.get("ents_r", 0.0), 3)
        ner_loss = round(losses.get("ner", 0.0), 2)

        flag = "  ← best" if f1 > best_f1 else ""
        print(f"Epoch {epoch:>3}/{epochs}  loss={ner_loss:>8.2f}  "
              f"P={prec:.3f}  R={rec:.3f}  F1={f1:.3f}{flag}")

        if f1 > best_f1:
            best_f1 = f1
            MODEL_BEST.mkdir(parents=True, exist_ok=True)
            nlp.to_disk(MODEL_BEST)

    # Save final checkpoint
    MODEL_LAST.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(MODEL_LAST)

    print(f"\n{'─'*60}")
    print(f"Training complete.  Best dev F1: {best_f1:.3f}")
    print(f"Best model saved to : {MODEL_BEST}")
    print(f"Last model saved to : {MODEL_LAST}")
    print()
    print("Next steps:")
    print("  1. Restart ai-service — ml_parser will load the fine-tuned model automatically")
    print("  2. Run POST /evaluate-parser/run-batch to compute evaluation metrics")
    print("  3. View results on /admin/parser-stats")


# ---------------------------------------------------------------------------
# Evaluate only
# ---------------------------------------------------------------------------

def evaluate_only():
    import spacy

    if not MODEL_BEST.exists():
        sys.exit(f"No trained model at {MODEL_BEST}. Run training first.")

    annotations = load_annotations()
    if not annotations:
        sys.exit("No annotations to evaluate.")

    nlp = spacy.load(str(MODEL_BEST))
    from spacy.training import Example

    examples = make_examples(nlp, annotations)
    scores = nlp.evaluate(examples)

    print(f"\nEvaluation on ALL {len(annotations)} annotated documents:")
    print(f"  Precision : {scores.get('ents_p', 0):.3f}")
    print(f"  Recall    : {scores.get('ents_r', 0):.3f}")
    print(f"  F1        : {scores.get('ents_f', 0):.3f}")

    per_type = scores.get("ents_per_type", {})
    if per_type:
        print(f"\n  Per-label breakdown:")
        for label, m in per_type.items():
            print(f"    {label:<22} P={m['p']:.3f}  R={m['r']:.3f}  F={m['f']:.3f}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Fine-tune transformer NER for arahan parsing")
    ap.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS,
                    help=f"Training epochs (default: {DEFAULT_EPOCHS})")
    ap.add_argument("--eval-only", action="store_true",
                    help="Evaluate existing model without retraining")
    args = ap.parse_args()

    if args.eval_only:
        evaluate_only()
    else:
        train(args.epochs)

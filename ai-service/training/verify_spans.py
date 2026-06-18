#!/usr/bin/env python3
"""Quick sanity check — verifies all span offsets match the actual text."""
import json
from pathlib import Path

TRAINING_DIR = Path(__file__).parent / "annotated_arahan"
errors = 0
for f in sorted(TRAINING_DIR.glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    text = d["text"]
    spans = d.get("spans", {})
    for field in ("next_court_date", "court_name"):
        s = spans.get(field)
        if s:
            extracted = text[s["start"]:s["end"]]
            if extracted != s["text"]:
                print(f"MISMATCH {f.name} {field}: expected {s['text']!r}, got {extracted!r}")
                errors += 1
    for field in ("parties", "required_actions"):
        for i, s in enumerate(spans.get(field, [])):
            extracted = text[s["start"]:s["end"]]
            if extracted != s["text"]:
                print(f"MISMATCH {f.name} {field}[{i}]: expected {s['text']!r}, got {extracted!r}")
                errors += 1

total = len(list(TRAINING_DIR.glob("*.json")))
if errors == 0:
    print(f"All {total} annotation files verified OK — all span offsets are correct.")
else:
    print(f"{errors} mismatches found in {total} files.")

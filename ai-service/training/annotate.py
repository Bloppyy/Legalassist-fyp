#!/usr/bin/env python3
"""
Annotation CLI for Malaysian court direction (arahan) documents.

Usage:
    python annotate.py <path-to-arahan-file>      # PDF, Word, or plain text
    python annotate.py --list                      # List annotated files
    python annotate.py --stats                     # Show annotation coverage

Output: training/annotated_arahan/<document_id>.json

Ground truth JSON format:
    {
      "document_id": "arahan_001",
      "source_file": "arahan_001.pdf",
      "text": "...",
      "labels": {
        "next_court_date": "2024-03-15",
        "court_name": "High Court Kuala Lumpur",
        "parties": ["Ahmad Bin Ali", "XYZ Sdn Bhd"],
        "required_actions": ["File witness statements within 14 days"]
      },
      "spans": {
        "next_court_date": {"start": 120, "end": 131, "text": "15/03/2024"},
        "court_name":      {"start": 45,  "end": 72,  "text": "High Court Kuala Lumpur"},
        "parties":         [{"start": 89, "end": 101, "text": "Ahmad Bin Ali"}],
        "required_actions":[{"start": 200,"end": 252, "text": "File witness statements within 14 days"}]
      },
      "annotated_by": "user",
      "annotated_at": "2025-01-15T10:30:00"
    }
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "annotated_arahan"

# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def extract_text(filepath: Path) -> str:
    suffix = filepath.suffix.lower()

    if suffix == ".txt":
        return filepath.read_text(encoding="utf-8", errors="replace")

    if suffix in (".docx", ".doc"):
        try:
            import mammoth
            with open(filepath, "rb") as f:
                result = mammoth.extract_raw_text(f)
            return result.value
        except ImportError:
            sys.exit("mammoth not installed. Run: pip install mammoth")

    if suffix == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(filepath) as pdf:
                return "\n".join(p.extract_text() or "" for p in pdf.pages)
        except ImportError:
            try:
                import pypdf
                reader = pypdf.PdfReader(str(filepath))
                return "\n".join(p.extract_text() or "" for p in reader.pages)
            except ImportError:
                sys.exit("No PDF parser found. Run: pip install pdfplumber  OR  pip install pypdf")

    sys.exit(f"Unsupported file type: {suffix}")


# ---------------------------------------------------------------------------
# Span detection
# ---------------------------------------------------------------------------

def find_span(text: str, fragment: str) -> dict | None:
    """Find the first occurrence of fragment in text, return {start, end, text}."""
    if not fragment:
        return None
    idx = text.lower().find(fragment.lower())
    if idx == -1:
        # Try whitespace-collapsed match
        collapsed_frag = re.sub(r'\s+', ' ', fragment).strip().lower()
        collapsed_text = re.sub(r'\s+', ' ', text).lower()
        idx = collapsed_text.find(collapsed_frag)
        if idx == -1:
            return None
    end = idx + len(fragment)
    return {"start": idx, "end": end, "text": text[idx:end]}


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

RESET = "\033[0m"
BOLD  = "\033[1m"
CYAN  = "\033[36m"
GREEN = "\033[32m"
YELLOW= "\033[33m"


def hr():
    print("\n" + "─" * 70)


def prompt(question: str, hint: str = "") -> str:
    if hint:
        print(f"  {YELLOW}({hint}){RESET}")
    return input(f"  {CYAN}▶ {question}{RESET} ").strip()


def prompt_list(question: str, hint: str = "") -> list[str]:
    """Prompt for a newline-separated list. Empty line ends input."""
    print(f"\n  {BOLD}{question}{RESET}")
    if hint:
        print(f"  {YELLOW}({hint}){RESET}")
    print(f"  {YELLOW}(Enter each item on its own line. Empty line to finish){RESET}")
    items = []
    i = 1
    while True:
        val = input(f"  {CYAN}  {i}> {RESET}").strip()
        if not val:
            break
        items.append(val)
        i += 1
    return items


def show_text_preview(text: str, chars: int = 3000):
    hr()
    print(f"{BOLD}Document Text (first {chars} characters):{RESET}")
    hr()
    print(text[:chars])
    if len(text) > chars:
        print(f"\n  {YELLOW}... [{len(text) - chars} more characters not shown]{RESET}")
    hr()


# ---------------------------------------------------------------------------
# Main annotation flow
# ---------------------------------------------------------------------------

def annotate_file(filepath: Path):
    print(f"\n{BOLD}{CYAN}LegalAssist Arahan Annotation Tool{RESET}")
    print(f"  File: {filepath.name}")

    text = extract_text(filepath)
    if not text.strip():
        sys.exit("No text extracted from file.")

    show_text_preview(text)

    doc_id_default = re.sub(r'[^a-zA-Z0-9_-]', '_', filepath.stem)[:40]
    doc_id = prompt(f"Document ID (default: {doc_id_default})", "short identifier, no spaces") or doc_id_default

    out_path = OUTPUT_DIR / f"{doc_id}.json"
    if out_path.exists():
        overwrite = prompt(f"'{doc_id}.json' already exists. Overwrite? (y/N)")
        if overwrite.lower() != 'y':
            sys.exit("Aborted.")

    labels: dict = {}
    spans: dict  = {}

    # ── next_court_date ──────────────────────────────────────────────────────
    hr()
    print(f"\n{BOLD}[1/4] NEXT COURT DATE{RESET}")
    date_val = prompt("What is the next court date?", "YYYY-MM-DD format, or press Enter if absent")
    if date_val:
        # validate
        try:
            from datetime import date
            datetime.strptime(date_val, "%Y-%m-%d")
        except ValueError:
            print(f"  {YELLOW}Warning: '{date_val}' is not YYYY-MM-DD format — saved as-is{RESET}")
        labels["next_court_date"] = date_val
        date_text = prompt("Paste the EXACT text in the document for this date (for span detection)", "e.g. '15/03/2024' or '15 Mac 2024'")
        if date_text:
            span = find_span(text, date_text)
            if span:
                spans["next_court_date"] = span
                print(f"  {GREEN}✓ Span found at chars {span['start']}–{span['end']}{RESET}")
            else:
                print(f"  {YELLOW}⚠ Text not found in document. Span not recorded.{RESET}")
    else:
        labels["next_court_date"] = None

    # ── court_name ───────────────────────────────────────────────────────────
    hr()
    print(f"\n{BOLD}[2/4] COURT NAME{RESET}")
    court_val = prompt("What is the court name?", "e.g. 'High Court Shah Alam' or press Enter if absent")
    if court_val:
        labels["court_name"] = court_val
        court_text = prompt("Paste the EXACT text in the document for the court name (for span)", "or press Enter to skip span")
        if court_text:
            span = find_span(text, court_text)
            if span:
                spans["court_name"] = span
                print(f"  {GREEN}✓ Span found at chars {span['start']}–{span['end']}{RESET}")
            else:
                print(f"  {YELLOW}⚠ Text not found in document. Span not recorded.{RESET}")
    else:
        labels["court_name"] = None

    # ── parties ──────────────────────────────────────────────────────────────
    hr()
    print(f"\n{BOLD}[3/4] PARTIES{RESET}")
    parties = prompt_list("Enter party names (plaintiff, defendant, applicant, etc.)", "one per line, full name as it appears")
    labels["parties"] = parties
    spans["parties"] = []
    if parties:
        print(f"  {YELLOW}For each party, paste their EXACT name from the document for span detection.{RESET}")
        for party in parties:
            ptext = prompt(f"  Exact text for '{party}' in document", "Enter to use the name as-is")
            ptext = ptext or party
            span = find_span(text, ptext)
            if span:
                spans["parties"].append(span)
                print(f"    {GREEN}✓ Found at chars {span['start']}–{span['end']}{RESET}")
            else:
                print(f"    {YELLOW}⚠ Not found in document — span skipped{RESET}")

    # ── required_actions ─────────────────────────────────────────────────────
    hr()
    print(f"\n{BOLD}[4/4] REQUIRED ACTIONS{RESET}")
    actions = prompt_list("Enter required actions from the direction", "full sentences from the arahan, e.g. 'File witness statements by 15 March 2024'")
    labels["required_actions"] = actions
    spans["required_actions"] = []
    if actions:
        print(f"  {YELLOW}For each action, paste the EXACT sentence from the document.{RESET}")
        for action in actions:
            atext = prompt(f"  Exact text for action {actions.index(action)+1}", "Enter to use the action text as-is")
            atext = atext or action
            span = find_span(text, atext)
            if span:
                spans["required_actions"].append(span)
                print(f"    {GREEN}✓ Found at chars {span['start']}–{span['end']}{RESET}")
            else:
                print(f"    {YELLOW}⚠ Not found in document — span skipped{RESET}")

    # ── Save ─────────────────────────────────────────────────────────────────
    annotation = {
        "document_id": doc_id,
        "source_file": filepath.name,
        "text": text,
        "labels": labels,
        "spans": spans,
        "annotated_by": os.environ.get("USER", os.environ.get("USERNAME", "unknown")),
        "annotated_at": datetime.utcnow().isoformat(),
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(annotation, f, ensure_ascii=False, indent=2)

    hr()
    span_count = (
        (1 if spans.get("next_court_date") else 0)
        + (1 if spans.get("court_name") else 0)
        + len(spans.get("parties", []))
        + len(spans.get("required_actions", []))
    )
    print(f"\n{GREEN}{BOLD}✓ Annotation saved:{RESET} {out_path}")
    print(f"  Labels: {list(k for k, v in labels.items() if v)}")
    print(f"  Spans recorded: {span_count}")
    print()


# ---------------------------------------------------------------------------
# List / stats
# ---------------------------------------------------------------------------

def list_annotations():
    files = sorted(OUTPUT_DIR.glob("*.json"))
    if not files:
        print("No annotations found in", OUTPUT_DIR)
        return
    print(f"\n{'ID':<30} {'Court date':<14} {'Court':<8} {'Parties':<9} {'Actions':<9} {'Spans'}")
    print("─" * 90)
    for f in files:
        try:
            data = json.loads(f.read_text())
            lbl = data.get("labels", {})
            spn = data.get("spans", {})
            span_count = (
                (1 if spn.get("next_court_date") else 0)
                + (1 if spn.get("court_name") else 0)
                + len(spn.get("parties", []))
                + len(spn.get("required_actions", []))
            )
            print(
                f"{data['document_id']:<30} "
                f"{'✓' if lbl.get('next_court_date') else '—':<14}"
                f"{'✓' if lbl.get('court_name') else '—':<8}"
                f"{len(lbl.get('parties',[])):<9}"
                f"{len(lbl.get('required_actions',[])):<9}"
                f"{span_count}"
            )
        except Exception as e:
            print(f"{f.name:<30} ERROR: {e}")
    print(f"\nTotal: {len(files)} annotation(s)")


def show_stats():
    files = list(OUTPUT_DIR.glob("*.json"))
    if not files:
        print("No annotations found.")
        return

    total = len(files)
    has_date = has_court = 0
    party_counts = []
    action_counts = []
    span_counts = []

    for f in files:
        data = json.loads(f.read_text())
        lbl = data.get("labels", {})
        spn = data.get("spans", {})
        if lbl.get("next_court_date"):
            has_date += 1
        if lbl.get("court_name"):
            has_court += 1
        party_counts.append(len(lbl.get("parties", [])))
        action_counts.append(len(lbl.get("required_actions", [])))
        sc = (
            (1 if spn.get("next_court_date") else 0)
            + (1 if spn.get("court_name") else 0)
            + len(spn.get("parties", []))
            + len(spn.get("required_actions", []))
        )
        span_counts.append(sc)

    print(f"\nAnnotation Statistics ({total} documents)")
    print(f"  next_court_date present : {has_date}/{total} ({round(has_date/total*100)}%)")
    print(f"  court_name present      : {has_court}/{total} ({round(has_court/total*100)}%)")
    print(f"  avg parties per doc     : {sum(party_counts)/total:.1f}")
    print(f"  avg actions per doc     : {sum(action_counts)/total:.1f}")
    print(f"  avg spans per doc       : {sum(span_counts)/total:.1f}")
    print(f"  docs with ≥1 span       : {sum(1 for s in span_counts if s > 0)}/{total}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Annotate arahan documents for NLP training")
    parser.add_argument("file", nargs="?", help="Path to arahan document (PDF, Word, or .txt)")
    parser.add_argument("--list", action="store_true", help="List all annotated files")
    parser.add_argument("--stats", action="store_true", help="Show annotation statistics")
    args = parser.parse_args()

    if args.list:
        list_annotations()
    elif args.stats:
        show_stats()
    elif args.file:
        annotate_file(Path(args.file))
    else:
        parser.print_help()

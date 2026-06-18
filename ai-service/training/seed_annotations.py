#!/usr/bin/env python3
"""
Creates annotation JSON files for the 5 client-provided arahan examples.
Run this once to seed the annotated_arahan/ directory before training.

Usage:
    cd ai-service/training
    python seed_annotations.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "annotated_arahan"
OUTPUT_DIR.mkdir(exist_ok=True)

ANNOTATED_BY = "seed_script"
ANNOTATED_AT = datetime.now(timezone.utc).isoformat()


def find_span(text: str, fragment: str) -> dict | None:
    if not fragment:
        return None
    idx = text.find(fragment)
    if idx == -1:
        idx = text.lower().find(fragment.lower())
    if idx == -1:
        print(f"  WARNING: span text not found in document: '{fragment[:60]}...'")
        return None
    end = idx + len(fragment)
    return {"start": idx, "end": end, "text": text[idx:end]}


def make_annotation(doc_id: str, text: str, labels: dict, span_texts: dict) -> dict:
    """Build annotation dict from label values and the exact span substrings to find."""
    spans: dict = {}

    # Single-value spans
    for field in ("next_court_date", "court_name"):
        frag = span_texts.get(field)
        spans[field] = find_span(text, frag) if frag else None

    # List spans
    for field in ("parties", "required_actions"):
        spans[field] = []
        for frag in span_texts.get(field, []):
            s = find_span(text, frag)
            if s:
                spans[field].append(s)

    return {
        "document_id": doc_id,
        "source_file": f"{doc_id}.txt",
        "text": text,
        "labels": labels,
        "spans": spans,
        "annotated_by": ANNOTATED_BY,
        "annotated_at": ANNOTATED_AT,
    }


def save(annotation: dict):
    path = OUTPUT_DIR / f"{annotation['document_id']}.json"
    if path.exists():
        print(f"  Skipping {path.name} — already exists.")
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump(annotation, f, ensure_ascii=False, indent=2)
    span_count = (
        (1 if annotation["spans"].get("next_court_date") else 0)
        + (1 if annotation["spans"].get("court_name") else 0)
        + len(annotation["spans"].get("parties", []))
        + len(annotation["spans"].get("required_actions", []))
    )
    print(f"  Saved {path.name}  ({span_count} spans)")


# ---------------------------------------------------------------------------
# The 5 base arahan examples (verbatim from client — generic/template-style)
# ---------------------------------------------------------------------------

ARAHAN = [
    {
        "id": "arahan_base_001",
        "text": (
            "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini "
            "dan serahkan kepada Plaintif pada hari yang sama. Pengurusan kes seterusnya "
            "ditetapkan pada 14.06.2026 untuk mengemaskini status pemfailan."
        ),
        "labels": {
            "next_court_date": "2026-06-14",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini "
                "dan serahkan kepada Plaintif pada hari yang sama."
            ],
        },
        "span_texts": {
            "next_court_date": "14.06.2026",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini "
                "dan serahkan kepada Plaintif pada hari yang sama."
            ],
        },
    },
    {
        "id": "arahan_base_002",
        "text": (
            "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari "
            "tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama. Pengurusan "
            "kes seterusnya ditetapkan pada 12.07.2026 untuk mengemaskini pemfailan dan "
            "untuk arahan-arahan pra-perbicaraan."
        ),
        "labels": {
            "next_court_date": "2026-07-12",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari "
                "tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama."
            ],
        },
        "span_texts": {
            "next_court_date": "12.07.2026",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari "
                "tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama."
            ],
        },
    },
    {
        "id": "arahan_base_003",
        "text": (
            "Pliding ditutup. Pengurusan kes pra bicara (Aturan 34 kaedah 2 KKM 2012): "
            "Sila failkan: 1) Ikatan Pliding 2) Ikatan Dokumen 3) Fakta-fakta yang Diakui "
            "4) Isu-isu untuk Dibicarakan 5) Senarai Saksi. Pengurusan kes ditangguhkan "
            "ke tarikh 13.08.2026 pada masa 9:00AM untuk melengkapkan dokumen pra perbicaraan."
        ),
        "labels": {
            "next_court_date": "2026-08-13",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Sila failkan: 1) Ikatan Pliding 2) Ikatan Dokumen 3) Fakta-fakta yang Diakui "
                "4) Isu-isu untuk Dibicarakan 5) Senarai Saksi."
            ],
        },
        "span_texts": {
            "next_court_date": "13.08.2026",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Sila failkan: 1) Ikatan Pliding 2) Ikatan Dokumen 3) Fakta-fakta yang Diakui "
                "4) Isu-isu untuk Dibicarakan 5) Senarai Saksi."
            ],
        },
    },
    {
        "id": "arahan_base_004",
        "text": (
            "Dokumen pra-perbicaraan adalah lengkap. Tarikh-tarikh perbicaraan adalah "
            "ditetapkan pada 22.03.2027 hingga 26.03.2027. Pihak-pihak sila failkan "
            "pernyataan saksi 2 minggu sebelum perbicaraan."
        ),
        "labels": {
            "next_court_date": "2027-03-22",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Pihak-pihak sila failkan pernyataan saksi 2 minggu sebelum perbicaraan."
            ],
        },
        "span_texts": {
            "next_court_date": "22.03.2027",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Pihak-pihak sila failkan pernyataan saksi 2 minggu sebelum perbicaraan."
            ],
        },
    },
    {
        "id": "arahan_base_005",
        "text": (
            "Pihak-pihak untuk memfailkan hujahan bertulis dan ikatan autoriti sebelum "
            "atau pada 12.06.2027. Nota prosiding hendaklah difailkan sebelum 30.06.2027. "
            "Keputusan ditetapkan pada 15.07.2027. Pihak-pihak perlu hadir secara fizikal."
        ),
        "labels": {
            "next_court_date": "2027-07-15",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Pihak-pihak untuk memfailkan hujahan bertulis dan ikatan autoriti sebelum "
                "atau pada 12.06.2027."
            ],
        },
        "span_texts": {
            "next_court_date": "15.07.2027",
            "court_name": None,
            "parties": [],
            "required_actions": [
                "Pihak-pihak untuk memfailkan hujahan bertulis dan ikatan autoriti sebelum "
                "atau pada 12.06.2027."
            ],
        },
    },
]


def main():
    print(f"Seeding {len(ARAHAN)} base arahan annotations...\n")
    for entry in ARAHAN:
        annotation = make_annotation(
            doc_id=entry["id"],
            text=entry["text"],
            labels=entry["labels"],
            span_texts=entry["span_texts"],
        )
        save(annotation)
    print(f"\nDone. Files written to: {OUTPUT_DIR}")
    print("Run 'python augment.py' next to generate synthetic variations.")


if __name__ == "__main__":
    main()

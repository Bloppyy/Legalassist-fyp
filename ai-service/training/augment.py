#!/usr/bin/env python3
"""
Generates 12 synthetic arahan variations by modifying the 5 base examples:
varying dates, court names, party names, durations, and stage types.

Run after seed_annotations.py to reach ~17 total training examples.

Usage:
    cd ai-service/training
    python augment.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "annotated_arahan"
OUTPUT_DIR.mkdir(exist_ok=True)

ANNOTATED_BY = "augment_script"
ANNOTATED_AT = datetime.now(timezone.utc).isoformat()


def find_span(text: str, fragment: str) -> dict | None:
    if not fragment:
        return None
    idx = text.find(fragment)
    if idx == -1:
        idx = text.lower().find(fragment.lower())
    if idx == -1:
        print(f"  WARNING: span not found: '{fragment[:60]}'")
        return None
    end = idx + len(fragment)
    return {"start": idx, "end": end, "text": text[idx:end]}


def make_annotation(doc_id: str, text: str, labels: dict, span_texts: dict) -> dict:
    spans: dict = {}
    for field in ("next_court_date", "court_name"):
        frag = span_texts.get(field)
        spans[field] = find_span(text, frag) if frag else None
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
# 12 augmented arahan — systematic variations of the 5 base examples
# ---------------------------------------------------------------------------

AUGMENTED = [
    # ── Defence direction variants ─────────────────────────────────────────

    {
        "id": "arahan_aug_001",
        # Base 001 + court name + new date
        "text": (
            "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini "
            "dan serahkan kepada Plaintif pada hari yang sama. Pengurusan kes seterusnya "
            "ditetapkan pada 21.07.2026 di Mahkamah Tinggi Shah Alam untuk mengemaskini "
            "status pemfailan."
        ),
        "labels": {
            "next_court_date": "2026-07-21",
            "court_name": "Mahkamah Tinggi Shah Alam",
            "parties": [],
            "required_actions": [
                "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini "
                "dan serahkan kepada Plaintif pada hari yang sama."
            ],
        },
        "span_texts": {
            "next_court_date": "21.07.2026",
            "court_name": "Mahkamah Tinggi Shah Alam",
            "parties": [],
            "required_actions": [
                "Defendan diarahkan untuk memfailkan Pembelaan 14 hari dari tarikh hari ini "
                "dan serahkan kepada Plaintif pada hari yang sama."
            ],
        },
    },
    {
        "id": "arahan_aug_002",
        # Base 001 + party names + court + 7-day variant
        "text": (
            "Defendan SYARIKAT MAJU SDN BHD diarahkan untuk memfailkan Pembelaan dalam "
            "tempoh 7 hari dari tarikh hari ini dan serahkan kepada Plaintif AHMAD BIN "
            "HASSAN pada hari yang sama. Pengurusan kes di Mahkamah Sesyen Petaling Jaya "
            "seterusnya ditetapkan pada 05.08.2026."
        ),
        "labels": {
            "next_court_date": "2026-08-05",
            "court_name": "Mahkamah Sesyen Petaling Jaya",
            "parties": ["SYARIKAT MAJU SDN BHD", "AHMAD BIN HASSAN"],
            "required_actions": [
                "Defendan SYARIKAT MAJU SDN BHD diarahkan untuk memfailkan Pembelaan dalam "
                "tempoh 7 hari dari tarikh hari ini dan serahkan kepada Plaintif AHMAD BIN "
                "HASSAN pada hari yang sama."
            ],
        },
        "span_texts": {
            "next_court_date": "05.08.2026",
            "court_name": "Mahkamah Sesyen Petaling Jaya",
            "parties": ["SYARIKAT MAJU SDN BHD", "AHMAD BIN HASSAN"],
            "required_actions": [
                "Defendan SYARIKAT MAJU SDN BHD diarahkan untuk memfailkan Pembelaan dalam "
                "tempoh 7 hari dari tarikh hari ini dan serahkan kepada Plaintif AHMAD BIN "
                "HASSAN pada hari yang sama."
            ],
        },
    },

    # ── Reply to Defence variants ──────────────────────────────────────────

    {
        "id": "arahan_aug_003",
        # Base 002 + court name + new date
        "text": (
            "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari "
            "tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama. Pengurusan "
            "kes seterusnya di Mahkamah Tinggi Johor Bahru ditetapkan pada 15.08.2026 untuk "
            "mengemaskini pemfailan dan untuk arahan-arahan pra-perbicaraan."
        ),
        "labels": {
            "next_court_date": "2026-08-15",
            "court_name": "Mahkamah Tinggi Johor Bahru",
            "parties": [],
            "required_actions": [
                "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari "
                "tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama."
            ],
        },
        "span_texts": {
            "next_court_date": "15.08.2026",
            "court_name": "Mahkamah Tinggi Johor Bahru",
            "parties": [],
            "required_actions": [
                "Plaintif diarahkan untuk memfailkan Jawapan kepada Pembelaan 14 hari dari "
                "tarikh hari ini dan serahkan kepada Defendan pada tarikh yang sama."
            ],
        },
    },
    {
        "id": "arahan_aug_004",
        # Base 002 + party names + court + new date
        "text": (
            "Plaintif NURUL HIDAYAH BINTI RAZALI diarahkan untuk memfailkan Jawapan kepada "
            "Pembelaan dalam masa 14 hari dan serahkan kepada Defendan BUMI INDAH SDN BHD "
            "pada tarikh yang sama. Pengurusan kes seterusnya ditetapkan pada 10.09.2026 "
            "di Mahkamah Tinggi Kuala Lumpur."
        ),
        "labels": {
            "next_court_date": "2026-09-10",
            "court_name": "Mahkamah Tinggi Kuala Lumpur",
            "parties": ["NURUL HIDAYAH BINTI RAZALI", "BUMI INDAH SDN BHD"],
            "required_actions": [
                "Plaintif NURUL HIDAYAH BINTI RAZALI diarahkan untuk memfailkan Jawapan kepada "
                "Pembelaan dalam masa 14 hari dan serahkan kepada Defendan BUMI INDAH SDN BHD "
                "pada tarikh yang sama."
            ],
        },
        "span_texts": {
            "next_court_date": "10.09.2026",
            "court_name": "Mahkamah Tinggi Kuala Lumpur",
            "parties": ["NURUL HIDAYAH BINTI RAZALI", "BUMI INDAH SDN BHD"],
            "required_actions": [
                "Plaintif NURUL HIDAYAH BINTI RAZALI diarahkan untuk memfailkan Jawapan kepada "
                "Pembelaan dalam masa 14 hari dan serahkan kepada Defendan BUMI INDAH SDN BHD "
                "pada tarikh yang sama."
            ],
        },
    },

    # ── Pre-trial bundle variants ──────────────────────────────────────────

    {
        "id": "arahan_aug_005",
        # Base 003 + court name + shorter bundle list + new date
        "text": (
            "Pliding ditutup. Pengurusan kes pra bicara (Aturan 34 KKM 2012): Pihak-pihak "
            "diarahkan untuk memfailkan: 1) Ikatan Pliding 2) Ikatan Dokumen 3) Fakta-fakta "
            "yang Diakui 4) Isu-isu untuk Dibicarakan. Tarikh pengurusan kes berikutnya "
            "ditetapkan pada 20.09.2026 di Mahkamah Tinggi Kuala Lumpur."
        ),
        "labels": {
            "next_court_date": "2026-09-20",
            "court_name": "Mahkamah Tinggi Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Pihak-pihak diarahkan untuk memfailkan: 1) Ikatan Pliding 2) Ikatan Dokumen "
                "3) Fakta-fakta yang Diakui 4) Isu-isu untuk Dibicarakan."
            ],
        },
        "span_texts": {
            "next_court_date": "20.09.2026",
            "court_name": "Mahkamah Tinggi Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Pihak-pihak diarahkan untuk memfailkan: 1) Ikatan Pliding 2) Ikatan Dokumen "
                "3) Fakta-fakta yang Diakui 4) Isu-isu untuk Dibicarakan."
            ],
        },
    },
    {
        "id": "arahan_aug_006",
        # Base 003 — rephrased opening + full bundle list + court + new date
        "text": (
            "Peringkat pliding ditutup. Mahkamah mengarahkan pihak-pihak untuk mengemukakan "
            "Ikatan Pliding, Ikatan Dokumen Bersama (Bahagian A, B dan C), Fakta Diakui dan "
            "Isu-isu untuk Dibicarakan sebelum atau pada 02.10.2026. Pengurusan kes "
            "ditetapkan di Mahkamah Tinggi Shah Alam pada tarikh tersebut."
        ),
        "labels": {
            "next_court_date": "2026-10-02",
            "court_name": "Mahkamah Tinggi Shah Alam",
            "parties": [],
            "required_actions": [
                "Mahkamah mengarahkan pihak-pihak untuk mengemukakan Ikatan Pliding, Ikatan "
                "Dokumen Bersama (Bahagian A, B dan C), Fakta Diakui dan Isu-isu untuk "
                "Dibicarakan sebelum atau pada 02.10.2026."
            ],
        },
        "span_texts": {
            "next_court_date": "02.10.2026",
            "court_name": "Mahkamah Tinggi Shah Alam",
            "parties": [],
            "required_actions": [
                "Mahkamah mengarahkan pihak-pihak untuk mengemukakan Ikatan Pliding, Ikatan "
                "Dokumen Bersama (Bahagian A, B dan C), Fakta Diakui dan Isu-isu untuk "
                "Dibicarakan sebelum atau pada 02.10.2026."
            ],
        },
    },

    # ── Trial date fixing variants ─────────────────────────────────────────

    {
        "id": "arahan_aug_007",
        # Base 004 + court name + new dates
        "text": (
            "Dokumen pra-perbicaraan telah lengkap. Tarikh-tarikh perbicaraan ditetapkan "
            "pada 10.04.2027 hingga 14.04.2027 di Mahkamah Tinggi Shah Alam. Pihak-pihak "
            "diarahkan untuk memfailkan Pernyataan Saksi 2 minggu sebelum perbicaraan."
        ),
        "labels": {
            "next_court_date": "2027-04-10",
            "court_name": "Mahkamah Tinggi Shah Alam",
            "parties": [],
            "required_actions": [
                "Pihak-pihak diarahkan untuk memfailkan Pernyataan Saksi 2 minggu sebelum "
                "perbicaraan."
            ],
        },
        "span_texts": {
            "next_court_date": "10.04.2027",
            "court_name": "Mahkamah Tinggi Shah Alam",
            "parties": [],
            "required_actions": [
                "Pihak-pihak diarahkan untuk memfailkan Pernyataan Saksi 2 minggu sebelum "
                "perbicaraan."
            ],
        },
    },
    {
        "id": "arahan_aug_008",
        # Base 004 — Mahkamah Sesyen + single trial date + attendance action
        "text": (
            "Semua dokumen pra-perbicaraan adalah memuaskan. Tarikh perbicaraan ditetapkan "
            "pada 08.05.2027 hingga 12.05.2027 di Mahkamah Sesyen Kuala Lumpur. Saksi-saksi "
            "dan peguam pihak-pihak sila hadir pada tarikh tersebut."
        ),
        "labels": {
            "next_court_date": "2027-05-08",
            "court_name": "Mahkamah Sesyen Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Saksi-saksi dan peguam pihak-pihak sila hadir pada tarikh tersebut."
            ],
        },
        "span_texts": {
            "next_court_date": "08.05.2027",
            "court_name": "Mahkamah Sesyen Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Saksi-saksi dan peguam pihak-pihak sila hadir pada tarikh tersebut."
            ],
        },
    },

    # ── Post-trial direction variants ──────────────────────────────────────

    {
        "id": "arahan_aug_009",
        # Base 005 + court name + rephrased + new dates
        "text": (
            "Perbicaraan telah tamat. Pihak-pihak diarahkan untuk memfailkan hujahan "
            "bertulis dan ikatan autoriti di Mahkamah Tinggi Kuala Lumpur sebelum atau "
            "pada 30.08.2027. Keputusan akan disampaikan pada 15.09.2027."
        ),
        "labels": {
            "next_court_date": "2027-09-15",
            "court_name": "Mahkamah Tinggi Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Pihak-pihak diarahkan untuk memfailkan hujahan bertulis dan ikatan autoriti "
                "di Mahkamah Tinggi Kuala Lumpur sebelum atau pada 30.08.2027."
            ],
        },
        "span_texts": {
            "next_court_date": "15.09.2027",
            "court_name": "Mahkamah Tinggi Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Pihak-pihak diarahkan untuk memfailkan hujahan bertulis dan ikatan autoriti "
                "di Mahkamah Tinggi Kuala Lumpur sebelum atau pada 30.08.2027."
            ],
        },
    },
    {
        "id": "arahan_aug_010",
        # Base 005 — Mahkamah Rayuan variant + physical attendance note
        "text": (
            "Mahkamah telah mendengar hujahan lisan pihak-pihak. Hujahan bertulis dan ikatan "
            "autoriti hendaklah difailkan pada atau sebelum 20.09.2027. Keputusan ditetapkan "
            "pada 25.10.2027 di Mahkamah Rayuan Kuala Lumpur. Pihak-pihak perlu hadir secara "
            "fizikal."
        ),
        "labels": {
            "next_court_date": "2027-10-25",
            "court_name": "Mahkamah Rayuan Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Hujahan bertulis dan ikatan autoriti hendaklah difailkan pada atau sebelum "
                "20.09.2027."
            ],
        },
        "span_texts": {
            "next_court_date": "25.10.2027",
            "court_name": "Mahkamah Rayuan Kuala Lumpur",
            "parties": [],
            "required_actions": [
                "Hujahan bertulis dan ikatan autoriti hendaklah difailkan pada atau sebelum "
                "20.09.2027."
            ],
        },
    },

    # ── New stage types ────────────────────────────────────────────────────

    {
        "id": "arahan_aug_011",
        # Memorandum of Appearance direction — party names + court + date
        "text": (
            "Defendan WORLD TECH SDN BHD diarahkan untuk memfailkan Memorandum Kehadiran "
            "dalam tempoh 14 hari dari tarikh serahan writ dan serahkan kepada Plaintif "
            "LEE AH KOW. Pengurusan kes pertama di Mahkamah Tinggi Ipoh ditetapkan pada "
            "18.06.2026."
        ),
        "labels": {
            "next_court_date": "2026-06-18",
            "court_name": "Mahkamah Tinggi Ipoh",
            "parties": ["WORLD TECH SDN BHD", "LEE AH KOW"],
            "required_actions": [
                "Defendan WORLD TECH SDN BHD diarahkan untuk memfailkan Memorandum Kehadiran "
                "dalam tempoh 14 hari dari tarikh serahan writ dan serahkan kepada Plaintif "
                "LEE AH KOW."
            ],
        },
        "span_texts": {
            "next_court_date": "18.06.2026",
            "court_name": "Mahkamah Tinggi Ipoh",
            "parties": ["WORLD TECH SDN BHD", "LEE AH KOW"],
            "required_actions": [
                "Defendan WORLD TECH SDN BHD diarahkan untuk memfailkan Memorandum Kehadiran "
                "dalam tempoh 14 hari dari tarikh serahan writ dan serahkan kepada Plaintif "
                "LEE AH KOW."
            ],
        },
    },
    {
        "id": "arahan_aug_012",
        # Witness statement direction — court name + date + two-date structure
        "text": (
            "Pernyataan saksi-saksi hendaklah difailkan dan diserahkan kepada pihak-pihak "
            "bertentangan sebelum atau pada 01.02.2027. Pengurusan kes seterusnya ditetapkan "
            "pada 15.02.2027 di Mahkamah Majistret Petaling Jaya untuk memastikan semua "
            "dokumen telah difailkan."
        ),
        "labels": {
            "next_court_date": "2027-02-15",
            "court_name": "Mahkamah Majistret Petaling Jaya",
            "parties": [],
            "required_actions": [
                "Pernyataan saksi-saksi hendaklah difailkan dan diserahkan kepada pihak-pihak "
                "bertentangan sebelum atau pada 01.02.2027."
            ],
        },
        "span_texts": {
            "next_court_date": "15.02.2027",
            "court_name": "Mahkamah Majistret Petaling Jaya",
            "parties": [],
            "required_actions": [
                "Pernyataan saksi-saksi hendaklah difailkan dan diserahkan kepada pihak-pihak "
                "bertentangan sebelum atau pada 01.02.2027."
            ],
        },
    },
]


def main():
    print(f"Generating {len(AUGMENTED)} augmented arahan annotations...\n")
    for entry in AUGMENTED:
        annotation = make_annotation(
            doc_id=entry["id"],
            text=entry["text"],
            labels=entry["labels"],
            span_texts=entry["span_texts"],
        )
        save(annotation)
    print(f"\nDone. Files written to: {OUTPUT_DIR}")
    print(
        "Total annotated_arahan/ should now contain 17 files "
        "(5 base + 12 augmented).\n"
        "Run 'python train_parser.py' to fine-tune the ML parser."
    )


if __name__ == "__main__":
    main()

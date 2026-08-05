#!/usr/bin/env python3
"""
One-off backfill: records which base example (if any) each annotated_arahan
document was derived from, reconstructed from augment.py's comments
(2026-06-18 session). Run once before cv_evaluate.py. Idempotent — safe to
re-run.

aug_011 and aug_012 are synthetic scenarios with no client-derived base
(Memorandum of Appearance / Witness Statement — invented, not client-
provided; see augment.py comment "# New stage types"). Decision: kept in
training only, source_id=null, cv_excluded=True, so their exclusion from
every CV test fold is enforced by the data itself, not by a hardcoded list
buried in the harness.
"""
import json
from pathlib import Path

DIR = Path(__file__).parent / "annotated_arahan"

LINEAGE = {
    "arahan_base_001": None, "arahan_base_002": None, "arahan_base_003": None,
    "arahan_base_004": None, "arahan_base_005": None,
    "arahan_aug_001": "arahan_base_001", "arahan_aug_002": "arahan_base_001",
    "arahan_aug_003": "arahan_base_002", "arahan_aug_004": "arahan_base_002",
    "arahan_aug_005": "arahan_base_003", "arahan_aug_006": "arahan_base_003",
    "arahan_aug_007": "arahan_base_004", "arahan_aug_008": "arahan_base_004",
    "arahan_aug_009": "arahan_base_005", "arahan_aug_010": "arahan_base_005",
    "arahan_aug_011": "EXCLUDE", "arahan_aug_012": "EXCLUDE",
}


def group_id_for(doc_id, source_id):
    if source_id == "EXCLUDE":
        return None
    return doc_id if source_id is None else source_id


def main():
    for doc_id, source_id in LINEAGE.items():
        path = DIR / f"{doc_id}.json"
        if not path.exists():
            print(f"  SKIP (not found): {path.name}"); continue
        data = json.loads(path.read_text(encoding="utf-8"))
        data["source_id"] = None if source_id == "EXCLUDE" else source_id
        data["group_id"] = group_id_for(doc_id, source_id)
        data["cv_excluded"] = (source_id == "EXCLUDE")
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  {path.name}: group_id={data['group_id']}, cv_excluded={data['cv_excluded']}")


if __name__ == "__main__":
    main()

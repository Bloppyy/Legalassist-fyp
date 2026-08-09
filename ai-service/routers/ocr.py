"""
OCR text-layer endpoint. Adds an invisible, searchable text layer to a
scanned/flattened PDF via ocrmypdf (Tesseract + Ghostscript). Does not
alter the visible page — this stays self-hosted specifically to avoid
sending real client documents to a third-party OCR API.
"""
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/add-text-layer")
async def add_text_layer(file: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = Path(tmpdir) / "input.pdf"
        out_path = Path(tmpdir) / "output.pdf"
        in_path.write_bytes(await file.read())

        # --skip-text: pages that already have real text are left untouched
        # and do not error — only image-only pages get OCR'd. This also
        # means a mixed PDF (some real-text pages, some scanned) is handled
        # correctly without special-casing "already has text" as an error.
        result = subprocess.run(
            ["ocrmypdf", "--skip-text", "--language", "eng+msa",
             str(in_path), str(out_path)],
            capture_output=True, text=True, timeout=120,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f"OCR failed (exit {result.returncode}): {result.stderr[-500:]}"
            )

        return Response(content=out_path.read_bytes(), media_type="application/pdf")

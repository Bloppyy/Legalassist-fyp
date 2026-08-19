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


@router.post("/compress")
async def compress_pdf(file: UploadFile = File(...)):
    """
    Reduce PDF file size using Ghostscript's ebook preset. Downsamples images
    to 150 dpi and strips duplicate font data. Does not alter text or vector
    content — scanned images may lose some quality; acceptable for e-filing
    where the 50 MB limit matters more than print resolution.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = Path(tmpdir) / "input.pdf"
        out_path = Path(tmpdir) / "output.pdf"
        in_path.write_bytes(await file.read())

        result = subprocess.run(
            [
                "gs", "-dBATCH", "-dNOPAUSE", "-dQUIET",
                "-sDEVICE=pdfwrite",
                "-dPDFSETTINGS=/ebook",   # 150 dpi images; good balance for e-filing
                "-dCompatibilityLevel=1.4",
                f"-sOutputFile={out_path}",
                str(in_path),
            ],
            capture_output=True, text=True, timeout=120,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f"Compression failed (exit {result.returncode}): {result.stderr[-500:]}"
            )

        compressed = out_path.read_bytes()
        # Ghostscript occasionally produces a larger output than input (e.g. a
        # PDF that is already well-compressed). Return the smaller of the two.
        original = in_path.read_bytes()
        return Response(
            content=compressed if len(compressed) < len(original) else original,
            media_type="application/pdf",
        )

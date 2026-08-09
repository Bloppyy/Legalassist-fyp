FROM python:3.11-slim

# tesseract-ocr: OCR engine. tesseract-ocr-msa: Malay language pack — arahan
# are bilingual BM/EN, English-only would misread Malay text. ghostscript:
# ocrmypdf's PDF rasterization/reassembly dependency.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-msa \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port $PORT

const pdfParse = require('pdf-parse');
const { PDFDocument, PDFName } = require('pdf-lib');

// Annotation subtypes that are structural/navigation — not user reviewer marks.
// These are safe to ignore: court e-filing systems only care about comments,
// highlights, stamps, and handwritten marks — not hyperlinks or form fields.
const SYSTEM_ANNOT_SUBTYPES = new Set(['/Link', '/Widget', '/Popup']);

const validateFilingPdf = async (buffer) => {
  const size_mb = Math.round((buffer.length / (1024 * 1024)) * 10) / 10;
  const size_ok = size_mb <= 50;

  let pdf_copyable = false;
  try {
    const parsed = await pdfParse(buffer);
    const numPages = parsed.numpages || 1;
    // 10 non-whitespace chars/page: detects any real text layer.
    // 50 was too aggressive — a short BM legal document or a PDF with
    // an OCR text layer on a sparse page would fail the higher threshold.
    const avgCharsPerPage = (parsed.text || '').replace(/\s/g, '').length / numPages;
    pdf_copyable = avgCharsPerPage >= 10;
  } catch {
    // Parsing failure → treat as not copyable
  }

  let has_annotations = false;
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    outer: for (const page of pdfDoc.getPages()) {
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) continue;
      try {
        const annotsArray = pdfDoc.context.lookup(annotsRef);
        for (const item of (annotsArray.array ?? [])) {
          const dict = pdfDoc.context.lookup(item);
          const subtype = dict?.get?.(PDFName.of('Subtype'))?.toString?.() ?? '';
          if (SYSTEM_ANNOT_SUBTYPES.has(subtype)) continue;
          // Skip invisible (bit 1) or hidden (bit 2) annotations — OCR tools
          // embed invisible text-box annotations for the text layer.
          const flags = dict?.get?.(PDFName.of('F'))?.asNumber?.() ?? 0;
          if (flags & 3) continue;
          has_annotations = true;
          break outer;
        }
      } catch {
        // Can't inspect individual annotations — fall back to presence check
        has_annotations = true;
        break;
      }
    }
  } catch {
    // pdf-lib failure → assume clean
  }

  return {
    size_mb,
    size_ok,
    pdf_copyable,
    copyable_ok: pdf_copyable,
    has_annotations,
    annotations_ok: !has_annotations,
    checked_at: new Date().toISOString(),
  };
};

const stripAnnotations = async (buffer) => {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  for (const page of pdfDoc.getPages()) {
    page.node.delete(PDFName.of('Annots'));
  }
  return Buffer.from(await pdfDoc.save());
};

module.exports = { validateFilingPdf, stripAnnotations };

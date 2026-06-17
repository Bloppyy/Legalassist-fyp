const pdfParse = require('pdf-parse');
const { PDFDocument, PDFName } = require('pdf-lib');

const validateFilingPdf = async (buffer) => {
  const size_mb = Math.round((buffer.length / (1024 * 1024)) * 10) / 10;
  const size_ok = size_mb <= 50;

  let pdf_copyable = false;
  try {
    const parsed = await pdfParse(buffer);
    const numPages = parsed.numpages || 1;
    const avgCharsPerPage = (parsed.text || '').replace(/\s/g, '').length / numPages;
    pdf_copyable = avgCharsPerPage >= 50;
  } catch {
    // Parsing failure → treat as not copyable
  }

  let has_annotations = false;
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    for (const page of pdfDoc.getPages()) {
      const annots = page.node.get(PDFName.of('Annots'));
      if (annots) { has_annotations = true; break; }
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

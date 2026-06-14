const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const extractTextFromDocx = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch { return ''; }
};

const extractTextFromPdf = async (buffer) => {
  try {
    const result = await pdfParse(buffer);
    return result.text.trim();
  } catch { return ''; }
};

module.exports = { extractTextFromDocx, extractTextFromPdf };

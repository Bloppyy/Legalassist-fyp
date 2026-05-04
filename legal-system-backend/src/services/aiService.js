require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Internal helper — POST to the Python FastAPI AI service.
 */
const post = async (path, body) => {
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error (${response.status}): ${text}`);
  }

  return response.json();
};

/**
 * Check a document's compliance against Malaysian legal standards.
 * @param {string} content - Raw document text
 * @param {string} documentType - e.g. 'contract', 'affidavit'
 * @returns {{ compliant: boolean, issues: Array, confidence: number }}
 */
const checkCompliance = async (content, documentType) => {
  return post('/compliance/check', { content, document_type: documentType });
};

/**
 * Extract legal entities from a document (parties, dates, clauses).
 * @param {string} content - Raw document text
 * @returns {{ entities: Array }}
 */
const extractEntities = async (content) => {
  return post('/entities/extract', { content });
};

/**
 * Find templates similar to a given document.
 * @param {string} content - Raw document text
 * @returns {{ matches: Array }}
 */
const matchTemplate = async (content) => {
  return post('/templates/match', { content });
};

/**
 * Parse a Malaysian court direction (arahan) document.
 * @param {string} text - Extracted text from the arahan file
 * @returns {{ next_court_date, required_actions, parties, court_name, confidence }}
 */
const parseDirection = async (text) => {
  return post('/parse-direction', { text });
};

module.exports = { checkCompliance, extractEntities, matchTemplate, parseDirection };

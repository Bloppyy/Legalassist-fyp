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
 * @returns {{ next_court_date, required_actions, parties, court_name, confidence, parser_used }}
 */
const parseDirection = async (text) => {
  return post('/parse-direction', { text });
};

/**
 * Classify a document's type using sentence-transformer similarity.
 * @param {string} content - Raw document text
 * @returns {{ predicted_type, label, confidence, auto_selected, all_scores }}
 */
const classifyDocument = async (content) => {
  return post('/classify', { content });
};

/**
 * Check compliance using sentence-transformer similarity scoring (per-section scores).
 * @param {string} content - Raw document text
 * @param {string} documentType - e.g. 'affidavit'
 * @returns {{ document_type, overall_score, compliant, sections, threshold }}
 */
const similarityCheckCompliance = async (content, documentType) => {
  return post('/compliance/check-similarity', { content, document_type: documentType });
};

/**
 * Evaluate both parsers on a single document against ground truth.
 * @param {string} text - Arahan document text
 * @param {object} groundTruth - { next_court_date, court_name, parties, required_actions }
 * @returns {{ rule_based, ml, ml_available }}
 */
const evaluateParser = async (text, groundTruth) => {
  return post('/evaluate-parser', { text, ground_truth: groundTruth });
};

/**
 * Trigger a batch evaluation run across all annotated arahan files.
 * @returns {AggregateEvaluationResponse}
 */
const runBatchEvaluation = async () => {
  const response = await fetch(`${AI_SERVICE_URL}/evaluate-parser/run-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error (${response.status}): ${text}`);
  }
  return response.json();
};

/**
 * Retrieve the last stored batch evaluation results.
 * @returns {AggregateEvaluationResponse}
 */
const getAggregateEvaluation = async () => {
  const response = await fetch(`${AI_SERVICE_URL}/evaluate-parser/aggregate`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error (${response.status}): ${text}`);
  }
  return response.json();
};

/**
 * Match parsed arahan required_actions against pending case checklist item titles.
 * @param {string[]} required_actions
 * @param {{ id: string, title: string }[]} checklist_items
 * @returns {{ matches: Array<{ action, best_match_id, best_match_title, score }> }}
 */
const matchChecklistItems = async (required_actions, checklist_items) => {
  return post('/checklist/match', { required_actions, checklist_items });
};

module.exports = {
  checkCompliance,
  extractEntities,
  matchTemplate,
  parseDirection,
  classifyDocument,
  similarityCheckCompliance,
  evaluateParser,
  runBatchEvaluation,
  getAggregateEvaluation,
  matchChecklistItems,
};

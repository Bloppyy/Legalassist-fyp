const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { runBatchEvaluation, getAggregateEvaluation } = require('../services/aiService');
const createError = require('http-errors');

// GET /api/evaluation/aggregate — return last stored results (admin only)
router.get('/aggregate', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = await getAggregateEvaluation();
    res.json({ success: true, data });
  } catch (err) {
    next(createError(502, `AI service unavailable: ${err.message}`));
  }
});

// POST /api/evaluation/run-batch — trigger batch evaluation (admin only)
router.post('/run-batch', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = await runBatchEvaluation();
    res.json({ success: true, data });
  } catch (err) {
    next(createError(502, `AI service unavailable: ${err.message}`));
  }
});

module.exports = router;

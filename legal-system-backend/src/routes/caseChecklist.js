const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/checklistController');

// Mounted at /api/cases/:caseId/checklist  (mergeParams: true)
const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', c.getCaseChecklist);

router.post(
  '/apply-template',
  authorize('associate', 'partner', 'admin'),
  [body('template_id').isUUID().withMessage('template_id must be a UUID')],
  validate,
  c.applyTemplate
);

router.post(
  '/items',
  authorize('associate', 'partner', 'admin'),
  [body('title').notEmpty().withMessage('title is required')],
  validate,
  c.addCaseItem
);

router.patch(
  '/items/:itemId',
  [
    body('status').optional().isIn(['pending', 'done', 'skipped']).withMessage('status must be pending, done, or skipped'),
    body('title').optional().notEmpty(),
  ],
  validate,
  c.updateCaseItem
);

router.delete('/items/:itemId', authorize('associate', 'partner', 'admin'), c.deleteCaseItem);

router.post(
  '/match-direction',
  authorize('associate', 'partner', 'admin'),
  [body('required_actions').isArray().withMessage('required_actions must be an array')],
  validate,
  c.matchDirection
);

module.exports = router;

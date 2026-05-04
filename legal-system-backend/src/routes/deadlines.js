const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const deadlinesController = require('../controllers/deadlinesController');

const router = Router();

router.use(authenticate);

// GET /api/deadlines?case_id=&upcoming=true
router.get('/', deadlinesController.getAll);

// GET /api/deadlines/:id
router.get('/:id', deadlinesController.getOne);

// POST /api/deadlines
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('title is required'),
    body('court_name').notEmpty().withMessage('court_name is required'),
    body('deadline_date').isDate().withMessage('deadline_date must be a valid date (YYYY-MM-DD)'),
    body('case_id').optional().isUUID().withMessage('case_id must be a valid UUID'),
    body('remarks').optional().isString(),
  ],
  validate,
  deadlinesController.create
);

// PUT /api/deadlines/:id
router.put(
  '/:id',
  [
    body('title').optional().notEmpty().withMessage('title must not be empty'),
    body('court_name').optional().notEmpty().withMessage('court_name must not be empty'),
    body('deadline_date').optional().isDate().withMessage('deadline_date must be a valid date (YYYY-MM-DD)'),
    body('is_completed').optional().isBoolean().withMessage('is_completed must be a boolean'),
  ],
  validate,
  deadlinesController.update
);

// PATCH /api/deadlines/:id/toggle-complete
router.patch('/:id/toggle-complete', deadlinesController.toggleComplete);

// DELETE /api/deadlines/:id
router.delete('/:id', deadlinesController.remove);

module.exports = router;

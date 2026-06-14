const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize, STAFF } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/deadlinesController');

const router = Router();

const ASSOCIATE_PLUS = ['associate', 'partner', 'admin'];
const CATEGORIES = [
  'internal_drafting', 'client_update', 'file_review', 'document_retention',
  'billing', 'trust_accounting', 'cle', 'insurance', 'other',
];

router.use(authenticate);

router.get('/', authorize(...STAFF), ctrl.getAll);
router.get('/:id', authorize(...STAFF), ctrl.getOne);

router.post(
  '/',
  authorize(...ASSOCIATE_PLUS),
  [
    body('title').notEmpty().withMessage('title is required'),
    body('deadline_date').isDate().withMessage('deadline_date must be YYYY-MM-DD'),
    body('court_name').optional({ nullable: true }).isString(),
    body('case_id').optional({ nullable: true }).isUUID().withMessage('case_id must be a valid UUID'),
    body('remarks').optional({ nullable: true }).isString(),
    body('category').optional({ nullable: true }).isIn(CATEGORIES).withMessage('Invalid category'),
    body('buffer_days').optional({ nullable: true }).isInt({ min: 0 }),
    body('actual_deadline_date').optional({ nullable: true }).isDate(),
  ],
  validate,
  ctrl.create
);

router.put(
  '/:id',
  authorize(...ASSOCIATE_PLUS),
  [
    body('title').optional().notEmpty(),
    body('deadline_date').optional().isDate(),
    body('court_name').optional({ nullable: true }).isString(),
    body('is_completed').optional().isBoolean(),
    body('category').optional({ nullable: true }).isIn(CATEGORIES),
    body('buffer_days').optional({ nullable: true }).isInt({ min: 0 }),
    body('actual_deadline_date').optional({ nullable: true }).isDate(),
  ],
  validate,
  ctrl.update
);

router.patch('/:id/toggle-complete', authorize(...STAFF), ctrl.toggleComplete);
router.delete('/:id', authorize(...ASSOCIATE_PLUS), ctrl.remove);

module.exports = router;

const { Router } = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authenticate, authorize, STAFF } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/caseStagesController');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const ASSOCIATE_PLUS = ['associate', 'partner', 'admin'];
const STAGE_TYPES = ['court_appearance', 'court_direction', 'meeting', 'filing_deadline', 'year_end_review', 'other'];

router.use(authenticate);

// GET /api/case-stages/stats — admin only (must be before /:id routes)
router.get('/stats', authorize('admin'), ctrl.getStats);

// GET /api/case-stages?case_id=:id — all staff can view
router.get('/', authorize(...STAFF), ctrl.getAll);

// POST /api/case-stages — associate+ only
router.post(
  '/',
  authorize(...ASSOCIATE_PLUS),
  [
    body('case_id').isUUID().withMessage('case_id must be a valid UUID'),
    body('stage_type').isIn(STAGE_TYPES).withMessage('Invalid stage_type'),
    body('title').notEmpty().withMessage('title is required'),
    body('stage_date').isDate().withMessage('stage_date must be YYYY-MM-DD'),
    body('court_name').optional({ nullable: true }).isString(),
    body('next_court_date').optional({ nullable: true }).isDate().withMessage('next_court_date must be YYYY-MM-DD'),
    body('direction_source').optional({ nullable: true }).isIn(['website', 'physical', 'both']),
    body('confidence').optional({ nullable: true }).isFloat({ min: 0, max: 1 }),
  ],
  validate,
  ctrl.create
);

// PATCH /api/case-stages/:id — associate+ only
router.patch(
  '/:id',
  authorize(...ASSOCIATE_PLUS),
  [
    body('stage_type').optional().isIn(STAGE_TYPES),
    body('title').optional().notEmpty(),
    body('stage_date').optional().isDate(),
    body('court_name').optional({ nullable: true }).isString(),
    body('next_court_date').optional({ nullable: true }).isDate(),
    body('direction_source').optional({ nullable: true }).isIn(['website', 'physical', 'both']),
  ],
  validate,
  ctrl.update
);

// DELETE /api/case-stages/:id — associate+ only
router.delete('/:id', authorize(...ASSOCIATE_PLUS), ctrl.remove);

// PATCH /api/case-stages/:id/complete — associate+ only
router.patch('/:id/complete', authorize(...ASSOCIATE_PLUS), ctrl.toggleComplete);

// GET /api/case-stages/:id/download — all staff
router.get('/:id/download', authorize(...STAFF), ctrl.download);

// POST /api/case-stages/:caseId/parse-direction — associate+ only
router.post(
  '/:caseId/parse-direction',
  authorize(...ASSOCIATE_PLUS),
  upload.single('file'),
  ctrl.parseDirection
);

module.exports = router;

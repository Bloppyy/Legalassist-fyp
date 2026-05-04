const { Router } = require('express');
const { body, query } = require('express-validator');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const courtGuidelinesController = require('../controllers/courtGuidelinesController');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

const VALID_CATEGORIES = ['court_filing_website', 'case_management', 'payment_for_filing', 'file_new_cases', 'other'];

router.use(authenticate);

// GET /api/court-guidelines?state=&category=  — all roles
router.get(
  '/',
  [
    query('category').optional().isIn(VALID_CATEGORIES).withMessage('invalid category'),
  ],
  validate,
  courtGuidelinesController.getAll
);

// GET /api/court-guidelines/:id  — all roles
router.get('/:id', courtGuidelinesController.getOne);

// GET /api/court-guidelines/:id/download  — all roles
router.get('/:id/download', courtGuidelinesController.download);

// POST /api/court-guidelines  — admin only
router.post(
  '/',
  authorize('admin'),
  upload.single('file'),
  [
    body('title').notEmpty().withMessage('title is required'),
    body('category').optional().isIn(VALID_CATEGORIES).withMessage('invalid category'),
    body('order_index').optional().isInt({ min: 0 }).withMessage('order_index must be a non-negative integer'),
    body('registry_url').optional().isURL().withMessage('registry_url must be a valid URL'),
  ],
  validate,
  courtGuidelinesController.create
);

// PUT /api/court-guidelines/:id  — admin only
router.put(
  '/:id',
  authorize('admin'),
  upload.single('file'),
  [
    body('title').optional().notEmpty().withMessage('title must not be empty'),
    body('category').optional().isIn(VALID_CATEGORIES).withMessage('invalid category'),
    body('order_index').optional().isInt({ min: 0 }).withMessage('order_index must be a non-negative integer'),
    body('registry_url').optional().isURL().withMessage('registry_url must be a valid URL'),
  ],
  validate,
  courtGuidelinesController.update
);

// DELETE /api/court-guidelines/:id  — admin only
router.delete('/:id', authorize('admin'), courtGuidelinesController.remove);

module.exports = router;

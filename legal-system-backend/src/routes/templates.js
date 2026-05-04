const { Router } = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const templatesController = require('../controllers/templatesController');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(authenticate);

// GET /api/templates?category_id=&search=  — all roles
router.get('/', templatesController.getAll);

// GET /api/templates/:id  — all roles
router.get('/:id', templatesController.getOne);

// GET /api/templates/:id/download  — all roles
router.get('/:id/download', templatesController.download);

// POST /api/templates  — associate, partner, admin
router.post(
  '/',
  authorize('associate', 'partner', 'admin'),
  upload.single('file'),
  [
    body('title').notEmpty().withMessage('title is required'),
    body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
  ],
  validate,
  templatesController.create
);

// PUT /api/templates/:id  — associate, partner, admin
router.put(
  '/:id',
  authorize('associate', 'partner', 'admin'),
  upload.single('file'),
  [
    body('title').optional().notEmpty().withMessage('title must not be empty'),
    body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
  ],
  validate,
  templatesController.update
);

// DELETE /api/templates/:id  — partner, admin
router.delete('/:id', authorize('partner', 'admin'), templatesController.remove);

module.exports = router;

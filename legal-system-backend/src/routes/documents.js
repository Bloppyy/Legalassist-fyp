const { Router } = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authenticate, authorize, LEVEL_1_AND_ASSOCIATE } = require('../middleware/auth');
const validate = require('../middleware/validate');
const documentsController = require('../controllers/documentsController');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only Word (.docx / .doc) files are allowed'));
  },
});

// 60 MB limit so oversized PDFs can still be received and flagged
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are allowed'));
  },
});

router.use(authenticate);

router.get('/', documentsController.getAll);
router.get('/:id', documentsController.getOne);
router.get('/:id/download', documentsController.download);

// POST /api/documents — Level 1 + associate
router.post(
  '/',
  authorize(...LEVEL_1_AND_ASSOCIATE),
  upload.single('file'),
  [
    body('title').notEmpty().withMessage('title is required'),
    body('case_id').optional({ nullable: true }).isUUID().withMessage('case_id must be a UUID'),
  ],
  validate,
  documentsController.create
);

// PUT /api/documents/:id — metadata only
router.put(
  '/:id',
  [body('title').optional().notEmpty().withMessage('title must not be empty')],
  validate,
  documentsController.update
);

// POST /api/documents/:id/reupload
router.post('/:id/reupload', upload.single('file'), documentsController.reupload);

router.delete('/:id', documentsController.remove);

// Workflow
router.patch('/:id/submit', authorize(...LEVEL_1_AND_ASSOCIATE), documentsController.submit);

router.patch(
  '/:id/escalate',
  authorize('associate'),
  [body('escalation_reason').notEmpty().withMessage('escalation_reason is required')],
  validate,
  documentsController.escalate
);

router.patch('/:id/approve', authorize('associate', 'partner'), documentsController.approve);

router.patch(
  '/:id/reject',
  authorize('associate', 'partner'),
  [body('reviewer_comments').notEmpty().withMessage('reviewer_comments is required')],
  validate,
  documentsController.reject
);

// PATCH /api/documents/:id/file — associate: approved → filed
router.patch('/:id/file', authorize('associate'), documentsController.markFiled);

// PATCH /api/documents/:id/serve — admin: filed → served
router.patch('/:id/serve', authorize('admin'), documentsController.markServed);

router.post('/:id/check-compliance', documentsController.checkCompliance);
router.post('/:id/check-similarity', documentsController.checkSimilarity);
router.get('/:id/entities', documentsController.getEntities);
router.post('/:id/classify', documentsController.classifyDocument);

// Pre-filing validation
router.post('/:id/upload-filing-pdf', authorize('associate'), uploadPdf.single('file'), documentsController.uploadFilingPdf);
router.post('/:id/strip-annotations', authorize('associate'), documentsController.stripAnnotationsPdf);

module.exports = router;

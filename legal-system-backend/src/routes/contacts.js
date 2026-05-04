const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const contactsController = require('../controllers/contactsController');

const router = Router();

router.use(authenticate);

// GET /api/contacts?search=&state=  — all roles
router.get('/', contactsController.getAll);

// GET /api/contacts/:id  — all roles
router.get('/:id', contactsController.getOne);

// POST /api/contacts  — associate, partner, admin
router.post(
  '/',
  authorize('associate', 'partner', 'admin'),
  [
    body('name').notEmpty().withMessage('name is required'),
    body('job_title').notEmpty().withMessage('job_title is required'),
    body('phone').notEmpty().withMessage('phone is required'),
    body('email').optional().isEmail().withMessage('email must be valid'),
  ],
  validate,
  contactsController.create
);

// PUT /api/contacts/:id  — associate, partner, admin
router.put(
  '/:id',
  authorize('associate', 'partner', 'admin'),
  [
    body('name').optional().notEmpty().withMessage('name must not be empty'),
    body('job_title').optional().notEmpty().withMessage('job_title must not be empty'),
    body('phone').optional().notEmpty().withMessage('phone must not be empty'),
    body('email').optional().isEmail().withMessage('email must be valid'),
  ],
  validate,
  contactsController.update
);

// DELETE /api/contacts/:id  — partner, admin
router.delete('/:id', authorize('partner', 'admin'), contactsController.remove);

module.exports = router;

const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const templateCategoriesController = require('../controllers/templateCategoriesController');

const router = Router();

router.use(authenticate);

// GET /api/template-categories  — all roles
router.get('/', templateCategoriesController.getAll);

// GET /api/template-categories/:id  — all roles (includes templates list)
router.get('/:id', templateCategoriesController.getOne);

// POST /api/template-categories  — admin only
router.post(
  '/',
  authorize('admin'),
  [body('name').notEmpty().withMessage('name is required')],
  validate,
  templateCategoriesController.create
);

// PUT /api/template-categories/:id  — admin only
router.put(
  '/:id',
  authorize('admin'),
  [body('name').notEmpty().withMessage('name is required')],
  validate,
  templateCategoriesController.update
);

// DELETE /api/template-categories/:id  — admin only
router.delete('/:id', authorize('admin'), templateCategoriesController.remove);

module.exports = router;

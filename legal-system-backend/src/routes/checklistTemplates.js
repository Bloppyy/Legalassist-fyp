const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/checklistController');

const router = Router();
router.use(authenticate);

router.get('/', c.listTemplates);

router.post(
  '/',
  authorize('associate', 'partner', 'admin'),
  [body('name').notEmpty().withMessage('name is required')],
  validate,
  c.createTemplate
);

router.put(
  '/:id',
  authorize('associate', 'partner', 'admin'),
  [body('name').optional().notEmpty().withMessage('name must not be empty')],
  validate,
  c.updateTemplate
);

router.delete('/:id', authorize('admin'), c.deleteTemplate);

router.post(
  '/:id/items',
  authorize('associate', 'partner', 'admin'),
  [body('title').notEmpty().withMessage('title is required')],
  validate,
  c.addTemplateItem
);

router.put(
  '/:id/items/:itemId',
  authorize('associate', 'partner', 'admin'),
  c.updateTemplateItem
);

router.delete(
  '/:id/items/:itemId',
  authorize('associate', 'partner', 'admin'),
  c.removeTemplateItem
);

module.exports = router;

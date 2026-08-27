const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const casesController = require('../controllers/casesController');

const router = Router();
router.use(authenticate);

router.get('/', casesController.getAll);
router.get('/:id', casesController.getOne);
router.get('/:id/history', casesController.getHistory);

router.post(
  '/',
  authorize('associate', 'partner', 'admin'),
  [
    body('case_number').notEmpty().withMessage('case_number is required'),
    body('year').isInt({ min: 1900, max: 2100 }).withMessage('year must be a valid integer'),
    body('client_name').notEmpty().withMessage('client_name is required'),
    body('assigned_to').optional({ nullable: true }).isUUID().withMessage('assigned_to must be a valid UUID'),
    body('partner_id').optional({ nullable: true }).isUUID().withMessage('partner_id must be a valid UUID'),
    body('party_role').optional({ nullable: true }).isIn(['plaintiff', 'defendant', 'other']).withMessage('party_role must be plaintiff, defendant, or other'),
    body('intake_brief').optional({ nullable: true }).isString(),
  ],
  validate,
  casesController.create
);

router.put(
  '/:id',
  authorize('associate', 'partner', 'admin'),
  [
    body('case_number').optional().notEmpty().withMessage('case_number must not be empty'),
    body('year').optional().isInt({ min: 1900, max: 2100 }).withMessage('year must be valid'),
    body('client_name').optional().notEmpty().withMessage('client_name must not be empty'),
    body('status').optional().isIn(['active', 'closed']).withMessage('status must be active or closed'),
    body('assigned_to').optional({ nullable: true }).isUUID().withMessage('assigned_to must be a valid UUID'),
    body('partner_id').optional({ nullable: true }).isUUID().withMessage('partner_id must be a valid UUID'),
    body('party_role').optional({ nullable: true }).isIn(['plaintiff', 'defendant', 'other']).withMessage('party_role must be plaintiff, defendant, or other'),
    body('intake_brief').optional({ nullable: true }).isString(),
  ],
  validate,
  casesController.update
);

router.delete('/:id', authorize('partner', 'admin'), casesController.remove);

module.exports = router;

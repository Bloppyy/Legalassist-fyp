const { Router } = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const usersController = require('../controllers/usersController');

const router = Router();

const ALL_ROLES = ['intern', 'junior_associate', 'chambering', 'associate', 'partner', 'admin'];

// GET /api/users/me
router.get('/me', authenticate, usersController.getProfile);

// PUT /api/users/me
router.put(
  '/me',
  authenticate,
  [body('name').notEmpty().withMessage('name is required')],
  validate,
  usersController.updateProfile
);

// GET /api/users?role=&search=  — associate, partner, admin only
router.get(
  '/',
  authenticate,
  authorize('associate', 'partner', 'admin'),
  [
    query('role').optional().isIn(ALL_ROLES).withMessage('invalid role'),
    query('search').optional().isString(),
  ],
  validate,
  usersController.getAll
);

// POST /api/users — admin only — create a new user
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('name is required'),
    body('email').isEmail().withMessage('valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
    body('role').notEmpty().isIn(ALL_ROLES).withMessage('invalid role'),
    body('supervisor_id').optional().isUUID().withMessage('supervisor_id must be a valid UUID'),
  ],
  validate,
  usersController.createUser
);

// PUT /api/users/:id/role — admin only
router.put(
  '/:id/role',
  authenticate,
  authorize('admin'),
  [
    body('role').notEmpty().isIn(ALL_ROLES).withMessage('invalid role'),
  ],
  validate,
  usersController.updateUserRole
);

// PUT /api/users/:id/supervisor — admin only
router.put(
  '/:id/supervisor',
  authenticate,
  authorize('admin'),
  [
    body('supervisor_id').optional({ nullable: true }).isUUID().withMessage('supervisor_id must be a valid UUID'),
  ],
  validate,
  usersController.updateUserSupervisor
);

// DELETE /api/users/:id — admin only
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  usersController.deleteUser
);

module.exports = router;

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

const router = Router();

router.use(authenticate);

// GET /api/notifications?unread=true
router.get('/', notificationsController.getAll);

// PATCH /api/notifications/read-all  — must come before /:id to avoid routing conflict
router.patch('/read-all', notificationsController.markAllRead);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', notificationsController.markRead);

module.exports = router;

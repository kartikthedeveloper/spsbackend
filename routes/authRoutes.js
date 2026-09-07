const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.get('/me', protect, ctrl.me);
router.post('/users', protect, authorize('admin', 'branch_manager'), ctrl.createUser);
router.get('/users', protect, authorize('admin', 'branch_manager'), ctrl.listUsers);
router.patch('/users/:id', protect, authorize('admin', 'branch_manager'), ctrl.updateUser);

module.exports = router;

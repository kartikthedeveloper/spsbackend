const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// List is also used to populate dropdowns (e.g. trainer select when creating a batch),
// so staff can read it too — only mutations are restricted.
router.get('/', authorize('admin', 'branch_manager', 'staff'), ctrl.listUsers);
router.get('/:id', authorize('admin', 'branch_manager', 'staff'), ctrl.getUser);
router.post('/', authorize('admin', 'branch_manager'), ctrl.createUser);
router.patch('/:id', authorize('admin', 'branch_manager'), ctrl.updateUser);
router.delete('/:id', authorize('admin', 'branch_manager'), ctrl.deleteUser);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.listStudents);
router.post('/', authorize('admin', 'branch_manager', 'staff'), ctrl.createStudent);
router.get('/:id', ctrl.getStudent);
router.patch('/:id', authorize('admin', 'branch_manager'), ctrl.updateStudent);
router.delete('/:id', authorize('admin', 'branch_manager'), ctrl.deleteStudent);

// Document endpoints
router.post('/:id/documents', authorize('admin', 'branch_manager'), ctrl.addDocument);
router.delete('/:id/documents/:docId', authorize('admin', 'branch_manager'), ctrl.removeDocument);

// Bulk status update
router.patch('/bulk/status', authorize('admin', 'branch_manager'), ctrl.bulkUpdateStatus);

// ID card
router.get('/:id/idcard', ctrl.generateIdCard);

module.exports = router;
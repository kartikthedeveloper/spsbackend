const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salaryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.listSalaries);
router.post('/', authorize('admin', 'branch_manager'), ctrl.generateSalary);
router.patch('/:id/pay', authorize('admin', 'branch_manager'), ctrl.markPaid);
router.get('/:id/slip', ctrl.salarySlipPdf);

module.exports = router;

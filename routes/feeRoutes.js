const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.post('/discount-request', authorize('admin', 'branch_manager', 'staff'), ctrl.requestDiscount);

router.get('/payments', ctrl.listPayments);
router.post('/payments', authorize('admin', 'branch_manager', 'staff'), ctrl.recordPayment);
router.get('/payments/:id/receipt', ctrl.receiptPdf);

router.get('/pending', ctrl.pendingFees);

module.exports = router;
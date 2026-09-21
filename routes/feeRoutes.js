const express = require('express');

const router = express.Router();

const ctrl = require('../controllers/feeController');

const {
  protect,
  authorize,
} = require('../middleware/auth');

router.use(protect);

// =====================================================
// DISCOUNT
// =====================================================

router.post(
  '/discount-request',
  authorize(
    'admin',
    'branch_manager',
    'staff'
  ),
  ctrl.requestDiscount
);

// =====================================================
// FEE REPORTS / DETAILS
// Put static routes before /:id routes
// =====================================================

router.get(
  '/pending',
  ctrl.pendingFees
);

router.get(
  '/dashboard',
  ctrl.feeDashboard
);

router.get(
  '/student/:id',
  ctrl.getStudentFeeDetails
);

// =====================================================
// STUDENT PAYMENTS
// =====================================================

router.get(
  '/payments',
  ctrl.listPayments
);

router.post(
  '/payments',
  authorize(
    'admin',
    'branch_manager',
    'staff'
  ),
  ctrl.recordPayment
);

router.get(
  '/payments/:id/receipt',
  ctrl.receiptPdf
);

// =====================================================
// UNIVERSITY PAYMENTS
// =====================================================

router.get(
  '/university-payments',
  ctrl.listUniversityPayments
);

router.post(
  '/university-payments',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.recordUniversityPayment
);

router.patch(
  '/university-payments/:id',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.updateUniversityPayment
);

router.delete(
  '/university-payments/:id',
  authorize('admin'),
  ctrl.deleteUniversityPayment
);

module.exports = router;

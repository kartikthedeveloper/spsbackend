const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/salaryController');
const {
  protect,
  authorize,
} = require('../middleware/auth');

router.use(protect);

// Yearly report endpoint:
// GET /api/salaries/report?year=2026
router.get(
  '/report',
  authorize('admin', 'branch_manager'),
  ctrl.salaryReport
);

router.get(
  '/',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.listSalaries
);

router.post(
  '/',
  authorize('admin', 'branch_manager'),
  ctrl.generateSalary
);

router.patch(
  '/:id/pay',
  authorize('admin', 'branch_manager'),
  ctrl.markPaid
);

module.exports = router;

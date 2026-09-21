const express = require('express');

const router = express.Router();

const ctrl = require('../controllers/dashboardController');

const { protect } = require('../middleware/auth');

router.use(protect);

// Dashboard summary
// Examples:
// /api/dashboard/summary
// /api/dashboard/summary?month=9&year=2026
// /api/dashboard/summary?year=2026
// /api/dashboard/summary?month=9&year=2026&branch=BRANCH_ID
router.get(
  '/summary',
  ctrl.summary
);

// Collection chart
// Examples:
// /api/dashboard/trend
// /api/dashboard/trend?year=2026
// /api/dashboard/trend?month=9&year=2026
router.get(
  '/trend',
  ctrl.collectionTrend
);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

/* ================= GET ================= */
router.get('/', ctrl.listLeads);
router.get('/pipeline', ctrl.pipeline);
router.get('/follow-ups-due', ctrl.followUpsDue);
router.get('/:id', ctrl.getLead);

/* ================= CREATE ================= */
router.post(
  '/',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.createLead
);

/* ================= UPDATE ================= */
router.patch(
  '/:id',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.updateLead
);

/* ================= DELETE ================= */
router.delete(
  '/:id',
  authorize('admin', 'branch_manager'),
  ctrl.deleteLead
);

/* ================= NOTES ================= */
router.post(
  '/:id/notes',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.addNote
);

/* ================= REMARKS (NEW) ================= */
router.post(
  '/:id/remarks',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.addRemark
);

/* ================= COMING DATE (NEW) ================= */
router.patch(
  '/:id/coming-date',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.updateComingDate
);

/* ================= REASSIGN ================= */
router.post(
  '/:id/reassign',
  authorize('admin', 'branch_manager'),
  ctrl.reassignLead
);

/* ================= CONVERT ================= */
router.post(
  '/:id/convert',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.convertLead
);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.listAttendance);
router.get('/summary', ctrl.attendanceSummary);
router.post('/mark', authorize('admin', 'branch_manager', 'staff'), ctrl.markAttendance);

module.exports = router;

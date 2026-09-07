const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/fees', ctrl.feeReport);
router.get('/attendance', ctrl.attendanceReport);
router.get('/leads', ctrl.leadReport);
router.get('/expenses', ctrl.expenseReport);
router.get('/fee-defaulters', ctrl.feeDefaultersReport);

module.exports = router;

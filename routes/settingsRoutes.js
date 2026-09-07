const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.getSettings);
router.patch('/', authorize('admin'), ctrl.updateSettings);

module.exports = router;

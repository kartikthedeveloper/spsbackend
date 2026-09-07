const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/campaignController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.listCampaigns);
router.post('/', authorize('admin', 'branch_manager'), ctrl.sendCampaign);

module.exports = router;

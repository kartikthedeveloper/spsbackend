const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.listLeads);
router.get('/pipeline', ctrl.pipeline);
router.get('/follow-ups-due', ctrl.followUpsDue);
router.get('/:id', ctrl.getLead);
router.post('/', authorize('admin', 'branch_manager', 'staff'), ctrl.createLead);
router.patch('/:id', authorize('admin', 'branch_manager', 'staff'), ctrl.updateLead);
router.post('/:id/notes', authorize('admin', 'branch_manager', 'staff'), ctrl.addNote);
router.post('/:id/reassign', authorize('admin', 'branch_manager'), ctrl.reassignLead);
router.post('/:id/convert', authorize('admin', 'branch_manager', 'staff'), ctrl.convertLead);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/branchController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.listBranches);
router.get('/:id', ctrl.getBranch);
router.post('/', authorize('admin'), ctrl.createBranch);
router.patch('/:id', authorize('admin'), ctrl.updateBranch);
router.delete('/:id', authorize('admin'), ctrl.deleteBranch);

module.exports = router;

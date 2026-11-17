const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/staffController');
const {
  protect,
  authorize,
} = require('../middleware/auth');

router.use(protect);

router.get(
  '/',
  authorize('admin', 'branch_manager', 'staff'),
  ctrl.listStaff
);

router.get(
  '/:id',
  authorize('admin', 'branch_manager'),
  ctrl.getStaff
);

router.post(
  '/',
  authorize('admin', 'branch_manager'),
  ctrl.createStaff
);

router.patch(
  '/:id',
  authorize('admin', 'branch_manager'),
  ctrl.updateStaff
);

router.delete(
  '/:id',
  authorize('admin', 'branch_manager'),
  ctrl.deleteStaff
);

module.exports = router;

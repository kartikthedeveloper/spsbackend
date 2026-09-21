const express = require('express');

const router = express.Router();

const ctrl = require('../controllers/studentController');

const {
  protect,
  authorize,
} = require('../middleware/auth');

router.use(protect);

// =====================================================
// LIST / CREATE
// =====================================================

router.get(
  '/',
  ctrl.listStudents
);

router.post(
  '/',
  authorize(
    'admin',
    'branch_manager',
    'staff'
  ),
  ctrl.createStudent
);

// =====================================================
// BULK STATUS
// Must be before /:id
// =====================================================

router.patch(
  '/bulk/status',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.bulkUpdateStatus
);

// =====================================================
// DOCUMENTS
// =====================================================

router.post(
  '/:id/documents',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.addDocument
);

router.delete(
  '/:id/documents/:docId',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.removeDocument
);

// =====================================================
// ID CARD
// =====================================================

router.get(
  '/:id/idcard',
  ctrl.generateIdCard
);

// =====================================================
// SINGLE STUDENT
// =====================================================

router.get(
  '/:id',
  ctrl.getStudent
);

router.patch(
  '/:id',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.updateStudent
);

router.delete(
  '/:id',
  authorize(
    'admin',
    'branch_manager'
  ),
  ctrl.deleteStudent
);

module.exports = router;

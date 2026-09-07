const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/courses', ctrl.listCourses);
router.post('/courses', authorize('admin', 'branch_manager'), ctrl.createCourse);
router.patch('/courses/:id', authorize('admin', 'branch_manager'), ctrl.updateCourse);
router.delete('/courses/:id', authorize('admin', 'branch_manager'), ctrl.deleteCourse);

router.get('/batches', ctrl.listBatches);
router.post('/batches', authorize('admin', 'branch_manager', 'staff'), ctrl.createBatch);
router.patch('/batches/:id', authorize('admin', 'branch_manager', 'staff'), ctrl.updateBatch);
router.delete('/batches/:id', authorize('admin', 'branch_manager'), ctrl.deleteBatch);
router.get("/courses/:id", ctrl.getCourse);
router.get("/batches/:id", ctrl.getBatch);
module.exports = router;

const Course = require('../models/Course');
const Batch = require('../models/Batch');

// ---- Courses ----
exports.createCourse = async (req, res) => {
  try {
    const branch = req.user.role === 'admin' ? req.body.branch : req.user.branch;
    const course = await Course.create({ ...req.body, branch });
    res.status(201).json({ course });
  } catch (err) {
    res.status(400).json({ message: 'Could not create course', error: err.message });
  }
};

exports.listCourses = async (req, res) => {
  const filter = { isActive: true };
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;
  const courses = await Course.find(filter).populate('branch', 'name code');
  res.json({ courses });
};

exports.updateCourse = async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!course) return res.status(404).json({ message: 'Course not found' });
  res.json({ course });
};

exports.deleteCourse = async (req, res) => {
  await Course.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ message: 'Course archived' });
};

// ---- Batches ----
exports.createBatch = async (req, res) => {
  try {
    const branch = req.user.role === 'admin' ? req.body.branch : req.user.branch;
    const batch = await Batch.create({ ...req.body, branch });
    res.status(201).json({ batch });
  } catch (err) {
    res.status(400).json({ message: 'Could not create batch', error: err.message });
  }
};

exports.listBatches = async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;
  if (req.query.course) filter.course = req.query.course;
  const batches = await Batch.find(filter)
    .populate('course', 'name')
    .populate('branch', 'name code')
    .populate('trainer', 'name');
  res.json({ batches });
};

exports.updateBatch = async (req, res) => {
  const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!batch) return res.status(404).json({ message: 'Batch not found' });
  res.json({ batch });
};

exports.deleteBatch = async (req, res) => {
  await Batch.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
  res.json({ message: 'Batch cancelled' });
};

exports.getCourse = async (req, res) => {
    const course = await Course.findById(req.params.id)
        .populate("branch", "name code");

    if (!course)
        return res.status(404).json({
            message: "Course not found",
        });

    res.json({ course });
};

exports.getBatch = async (req, res) => {
    const batch = await Batch.findById(req.params.id)
        .populate("course", "name")
        .populate("branch", "name code")
        .populate("trainer", "name");

    if (!batch)
        return res.status(404).json({
            message: "Batch not found",
        });

    res.json({ batch });
};
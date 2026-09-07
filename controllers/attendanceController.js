const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

// Bulk mark attendance for a batch on a given date
// body: { batch, date, records: [{ student, status }] }
exports.markAttendance = async (req, res) => {
  try {
    const { batch, date, records } = req.body;
    const student0 = await Student.findById(records[0]?.student);
    const branch = student0 ? student0.branch : req.body.branch;

    const ops = records.map((r) => ({
      updateOne: {
        filter: { student: r.student, date: new Date(date) },
        update: {
          $set: {
            student: r.student,
            batch,
            branch,
            date: new Date(date),
            status: r.status,
            markedBy: req.user._id,
          },
        },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(ops);
    res.json({ message: 'Attendance recorded' });
  } catch (err) {
    res.status(400).json({ message: 'Could not mark attendance', error: err.message });
  }
};

exports.listAttendance = async (req, res) => {
  const filter = {};
  if (req.query.batch) filter.batch = req.query.batch;
  if (req.query.student) filter.student = req.query.student;
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  const records = await Attendance.find(filter)
    .populate('student', 'name admissionId')
    .populate('batch', 'name')
    .sort({ date: -1 });
  res.json({ records });
};

// Attendance % per student — used for shortage alerts
exports.attendanceSummary = async (req, res) => {
  const filter = {};
  if (req.query.batch) filter.batch = req.query.batch;
  if (req.user.role !== 'admin') filter.branch = req.user.branch;

  const summary = await Attendance.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    {
      $project: {
        total: 1,
        present: 1,
        percentage: { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] },
      },
    },
  ]);

  const populated = await Student.populate(summary, { path: '_id', select: 'name admissionId phone email' });
  res.json({
    summary: populated.map((s) => ({
      student: s._id,
      total: s.total,
      present: s.present,
      percentage: s.percentage,
    })),
  });
};

const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Lead = require('../models/Lead');
const Expense = require('../models/Expense');
const Batch = require('../models/Batch');

exports.summary = async (req, res) => {
  const branchFilter = req.user.role !== 'admin' ? { branch: req.user.branch } : req.query.branch ? { branch: req.query.branch } : {};

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [
    totalStudents,
    activeLeads,
    upcomingBatches,
    todaysCollection,
    weekCollection,
    monthCollection,
    monthExpense,
    students,
    payments,
  ] = await Promise.all([
    Student.countDocuments({ ...branchFilter, isActive: true }),
    Lead.countDocuments({ ...branchFilter, stage: { $nin: ['converted', 'lost'] } }),
    Batch.countDocuments({ ...branchFilter, status: 'upcoming' }),
    Payment.aggregate([
      { $match: { ...branchFilter, paymentDate: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]),
    Payment.aggregate([
      { $match: { ...branchFilter, paymentDate: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]),
    Payment.aggregate([
      { $match: { ...branchFilter, paymentDate: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]),
    Expense.aggregate([
      { $match: { ...branchFilter, date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Student.find({ ...branchFilter, isActive: true }),
    Payment.aggregate([{ $match: branchFilter }, { $group: { _id: '$student', total: { $sum: '$amountPaid' } } }]),
  ]);

  const paidMap = new Map(payments.map((p) => [p._id.toString(), p.total]));
  const pendingFeesTotal = students.reduce((sum, s) => {
    const payable = (s.totalFee || 0) - (s.discount || 0);
    const paid = paidMap.get(s._id.toString()) || 0;
    return sum + Math.max(payable - paid, 0);
  }, 0);

  res.json({
    totalStudents,
    activeLeads,
    upcomingBatches,
    pendingTasks: activeLeads, // follow-ups + pending fees serve as "pending tasks" proxy
    pendingFeesTotal,
    collections: {
      today: todaysCollection[0]?.total || 0,
      week: weekCollection[0]?.total || 0,
      month: monthCollection[0]?.total || 0,
    },
    monthExpense: monthExpense[0]?.total || 0,
  });
};

// Last 6 months collection trend, for the dashboard chart
exports.collectionTrend = async (req, res) => {
  const branchFilter = req.user.role !== 'admin' ? { branch: req.user.branch } : req.query.branch ? { branch: req.query.branch } : {};
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const trend = await Payment.aggregate([
    { $match: { ...branchFilter, paymentDate: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: '$paymentDate' }, month: { $month: '$paymentDate' } },
        total: { $sum: '$amountPaid' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({ trend });
};

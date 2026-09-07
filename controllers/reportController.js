const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const Expense = require('../models/Expense');

const branchFilterFor = (req) =>
  req.user.role !== 'admin'
    ? { branch: req.user.branch }
    : req.query.branch
      ? { branch: req.query.branch }
      : {};

/*
|--------------------------------------------------------------------------
| Fee Collection
|--------------------------------------------------------------------------
*/
exports.feeReport = async (req, res) => {
  try {
    const filter = branchFilterFor(req);

    const payments = await Payment.find(filter)
      .populate('student', 'name admissionId phone')
      .sort({ paymentDate: -1 })
      .lean();

    const rows = payments.map((p) => ({
      receiptNumber: p.receiptNumber || '',
      date: p.paymentDate || null,
      student: p.student?.name || '',
      admissionId: p.student?.admissionId || '',
      phone: p.student?.phone || '',
      amount: Number(p.amountPaid || 0),
      mode: p.paymentMode || '',
      transactionRef: p.transactionRef || '',
      installmentLabel: p.installmentLabel || '',
      remarks: p.remarks || '',
    }));

    res.json({
      success: true,
      report: 'fees',
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('Fee report error:', err);

    res.status(500).json({
      success: false,
      message: 'Could not generate fee report',
    });
  }
};

/*
|--------------------------------------------------------------------------
| Attendance
|--------------------------------------------------------------------------
*/
exports.attendanceReport = async (req, res) => {
  try {
    const filter = branchFilterFor(req);

    if (req.query.batch) {
      filter.batch = req.query.batch;
    }

    const records = await Attendance.find(filter)
      .populate('student', 'name admissionId')
      .populate('batch', 'name')
      .sort({ date: -1 })
      .lean();

    const rows = records.map((r) => ({
      date: r.date || null,
      student: r.student?.name || '',
      admissionId: r.student?.admissionId || '',
      batch: r.batch?.name || '',
      status: r.status || '',
    }));

    res.json({
      success: true,
      report: 'attendance',
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('Attendance report error:', err);

    res.status(500).json({
      success: false,
      message: 'Could not generate attendance report',
    });
  }
};

/*
|--------------------------------------------------------------------------
| Leads
|--------------------------------------------------------------------------
*/
exports.leadReport = async (req, res) => {
  try {
    const filter = branchFilterFor(req);

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name')
      .populate('interestedCourse', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const rows = leads.map((l) => ({
      leadId: l.leadId || '',
      name: l.fullName || '',
      phone: l.phone || '',
      email: l.email || '',
      source: l.source || '',
      stage: l.stage || '',
      priority: l.priority || '',
      assignedTo: l.assignedTo?.name || '',
      course: l.interestedCourse?.name || '',
      createdOn: l.createdAt || null,
    }));

    res.json({
      success: true,
      report: 'leads',
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('Lead report error:', err);

    res.status(500).json({
      success: false,
      message: 'Could not generate lead report',
    });
  }
};

/*
|--------------------------------------------------------------------------
| Expenses
|--------------------------------------------------------------------------
*/
exports.expenseReport = async (req, res) => {
  try {
    const filter = branchFilterFor(req);

    const expenses = await Expense.find(filter)
      .populate('recordedBy', 'name')
      .sort({ date: -1 })
      .lean();

    const rows = expenses.map((e) => ({
      date: e.date || null,
      category: e.category || '',
      title: e.title || '',
      amount: Number(e.amount || 0),
      recordedBy: e.recordedBy?.name || '',
      notes: e.notes || '',
    }));

    res.json({
      success: true,
      report: 'expenses',
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('Expense report error:', err);

    res.status(500).json({
      success: false,
      message: 'Could not generate expense report',
    });
  }
};

/*
|--------------------------------------------------------------------------
| Fee Defaulters
|--------------------------------------------------------------------------
*/
exports.feeDefaultersReport = async (req, res) => {
  try {
    const filter = {
      ...branchFilterFor(req),
      isActive: true,
    };

    const students = await Student.find(filter)
      .populate('course', 'name')
      .lean();

    /*
     * IMPORTANT:
     * Original code calculated all payments globally.
     * We preserve that behavior here.
     */
    const payments = await Payment.aggregate([
      {
        $group: {
          _id: '$student',
          total: {
            $sum: '$amountPaid',
          },
        },
      },
    ]);

    const paidMap = new Map(
      payments.map((p) => [
        p._id.toString(),
        Number(p.total || 0),
      ])
    );

    const rows = [];

    students.forEach((s) => {
      const paid =
        paidMap.get(s._id.toString()) || 0;

      const payable =
        Number(s.totalFee || 0) -
        Number(s.discount || 0);

      const pending = payable - paid;

      if (pending > 0) {
        rows.push({
          admissionId: s.admissionId || '',
          name: s.name || '',
          phone: s.phone || '',
          course: s.course?.name || '',
          payable,
          paid,
          pending,
        });
      }
    });

    res.json({
      success: true,
      report: 'fee-defaulters',
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error(
      'Fee defaulters report error:',
      err
    );

    res.status(500).json({
      success: false,
      message:
        'Could not generate fee defaulters report',
    });
  }
};
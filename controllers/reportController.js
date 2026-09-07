const ExcelJS = require('exceljs');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const Expense = require('../models/Expense');

const sendWorkbook = async (res, workbook, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

const branchFilterFor = (req) =>
  req.user.role !== 'admin' ? { branch: req.user.branch } : req.query.branch ? { branch: req.query.branch } : {};

exports.feeReport = async (req, res) => {
  const filter = branchFilterFor(req);
  const payments = await Payment.find(filter).populate('student', 'name admissionId phone').sort({ paymentDate: -1 });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Fee Collection');
  sheet.columns = [
    { header: 'Receipt No', key: 'receiptNumber', width: 18 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Student', key: 'student', width: 24 },
    { header: 'Admission ID', key: 'admissionId', width: 16 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Mode', key: 'mode', width: 14 },
  ];
  payments.forEach((p) => {
    sheet.addRow({
      receiptNumber: p.receiptNumber,
      date: new Date(p.paymentDate).toLocaleDateString(),
      student: p.student?.name,
      admissionId: p.student?.admissionId,
      phone: p.student?.phone,
      amount: p.amountPaid,
      mode: p.paymentMode,
    });
  });
  sheet.getRow(1).font = { bold: true };
  await sendWorkbook(res, wb, 'fee-collection-report.xlsx');
};

exports.attendanceReport = async (req, res) => {
  const filter = branchFilterFor(req);
  if (req.query.batch) filter.batch = req.query.batch;
  const records = await Attendance.find(filter).populate('student', 'name admissionId').populate('batch', 'name').sort({ date: -1 });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Attendance');
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Student', key: 'student', width: 24 },
    { header: 'Admission ID', key: 'admissionId', width: 16 },
    { header: 'Batch', key: 'batch', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  records.forEach((r) => {
    sheet.addRow({
      date: new Date(r.date).toLocaleDateString(),
      student: r.student?.name,
      admissionId: r.student?.admissionId,
      batch: r.batch?.name,
      status: r.status,
    });
  });
  sheet.getRow(1).font = { bold: true };
  await sendWorkbook(res, wb, 'attendance-report.xlsx');
};

exports.leadReport = async (req, res) => {
  const filter = branchFilterFor(req);
  const leads = await Lead.find(filter).populate('assignedTo', 'name').populate('interestedCourse', 'name').sort({ createdAt: -1 });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Leads');
  sheet.columns = [
    { header: 'Lead ID', key: 'leadId', width: 16 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Source', key: 'source', width: 14 },
    { header: 'Stage', key: 'stage', width: 16 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Assigned To', key: 'assignedTo', width: 18 },
    { header: 'Interested Course', key: 'course', width: 20 },
    { header: 'Created On', key: 'createdOn', width: 14 },
  ];
  leads.forEach((l) => {
    sheet.addRow({
      leadId: l.leadId,
      name: l.fullName,
      phone: l.phone,
      source: l.source,
      stage: l.stage,
      priority: l.priority,
      assignedTo: l.assignedTo?.name,
      course: l.interestedCourse?.name,
      createdOn: new Date(l.createdAt).toLocaleDateString(),
    });
  });
  sheet.getRow(1).font = { bold: true };
  await sendWorkbook(res, wb, 'lead-report.xlsx');
};

exports.expenseReport = async (req, res) => {
  const filter = branchFilterFor(req);
  const expenses = await Expense.find(filter).populate('recordedBy', 'name').sort({ date: -1 });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Expenses');
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Title', key: 'title', width: 24 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Recorded By', key: 'recordedBy', width: 18 },
  ];
  expenses.forEach((e) => {
    sheet.addRow({
      date: new Date(e.date).toLocaleDateString(),
      category: e.category,
      title: e.title,
      amount: e.amount,
      recordedBy: e.recordedBy?.name,
    });
  });
  sheet.getRow(1).font = { bold: true };
  await sendWorkbook(res, wb, 'expense-report.xlsx');
};

exports.feeDefaultersReport = async (req, res) => {
  const filter = { ...branchFilterFor(req), isActive: true };
  const students = await Student.find(filter).populate('course', 'name');
  const payments = await Payment.aggregate([{ $group: { _id: '$student', total: { $sum: '$amountPaid' } } }]);
  const paidMap = new Map(payments.map((p) => [p._id.toString(), p.total]));

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Fee Defaulters');
  sheet.columns = [
    { header: 'Admission ID', key: 'admissionId', width: 16 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Course', key: 'course', width: 20 },
    { header: 'Total Payable', key: 'payable', width: 14 },
    { header: 'Paid', key: 'paid', width: 12 },
    { header: 'Pending', key: 'pending', width: 12 },
  ];
  students.forEach((s) => {
    const paid = paidMap.get(s._id.toString()) || 0;
    const payable = (s.totalFee || 0) - (s.discount || 0);
    const pending = payable - paid;
    if (pending > 0) {
      sheet.addRow({
        admissionId: s.admissionId,
        name: s.name,
        phone: s.phone,
        course: s.course?.name,
        payable,
        paid,
        pending,
      });
    }
  });
  sheet.getRow(1).font = { bold: true };
  await sendWorkbook(res, wb, 'fee-defaulters-report.xlsx');
};

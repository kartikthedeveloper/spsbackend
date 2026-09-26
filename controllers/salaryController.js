const Salary = require('../models/Salary');
const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');

// KPI-based auto-calculation: kpiScore of 100 = no adjustment.
// Every point above/below 100 shifts pay by 0.5% of base salary, so a
// KPI of 110 adds 5%, a KPI of 80 deducts 10%. Simple and transparent
// so staff can see exactly why their pay moved.
const computeKpiAdjustment = (baseSalary, kpiScore) => {
  const diff = kpiScore - 100;
  return Math.round(baseSalary * (diff * 0.005));
};

exports.generateSalary = async (req, res) => {
  try {
    const { staff, month, year, baseSalary, deductions = 0 } = req.body;
    const branch = req.user.role === 'admin' ? req.body.branch : req.user.branch;

    const netSalary = baseSalary - deductions;

    const salary = await Salary.findOneAndUpdate(
      { staff, month, year },
      { branch, baseSalary, deductions, netSalary, generatedBy: req.user._id },
      { new: true, upsert: true }
    );
    res.status(201).json({ salary });
  } catch (err) {
    res.status(400).json({ message: 'Could not generate salary', error: err.message });
  }
};

exports.listSalaries = async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;
  if (req.query.staff) filter.staff = req.query.staff;
  if (req.query.month) filter.month = Number(req.query.month);
  if (req.query.year) filter.year = Number(req.query.year);
  const salaries = await Salary.find(filter).populate('staff', 'name email role').sort({ year: -1, month: -1 });
  res.json({ salaries });
};

exports.markPaid = async (req, res) => {
  const salary = await Salary.findByIdAndUpdate(
    req.params.id,
    { status: 'paid', paidOn: new Date() },
    { new: true }
  );
  if (!salary) return res.status(404).json({ message: 'Salary record not found' });
  res.json({ salary });
};

exports.salarySlipPdf = async (req, res) => {
  const salary = await Salary.findById(req.params.id).populate('staff', 'name email role');
  if (!salary) return res.status(404).json({ message: 'Salary record not found' });
  const settings = (await Settings.findOne()) || {};

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const doc = new PDFDocument({ size: 'A5', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="salary-slip-${salary._id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').fillColor(settings.primaryColor || '#1E3A5F')
    .text(settings.instituteName || 'Success Point', { align: 'center' });
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000')
    .text(`Salary Slip - ${monthNames[salary.month - 1]} ${salary.year}`, { align: 'center' });
  doc.moveDown();

  const row = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(10).text(label, { continued: true, width: 200 });
    doc.font('Helvetica').text(String(value));
  };
  row('Employee: ', salary.staff?.name);
  row('Role: ', salary.staff?.role);
  row('Base Salary: ', `₹${salary.baseSalary}`);
  row('KPI Score: ', `${salary.kpiScore}%`);
  row('KPI Adjustment: ', `₹${salary.kpiAdjustment}`);
  row('Deductions: ', `₹${salary.deductions}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(12).text(`Net Salary: ₹${salary.netSalary}`);
  doc.moveDown();
  doc.fontSize(9).font('Helvetica').text(`Status: ${salary.status.toUpperCase()}`);

  doc.end();
};

const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Settings = require('../models/Settings');
const { generateId } = require('../utils/idGenerator');
const PDFDocument = require('pdfkit');

// ──────────────────────────────────────────────
//  DISCOUNT REQUEST (unchanged but improved)
// ──────────────────────────────────────────────

exports.requestDiscount = async (req, res) => {
  try {
    const { studentId, discountPercent, reason } = req.body;
    if (!studentId || discountPercent === undefined) {
      return res.status(400).json({ message: 'studentId and discountPercent are required' });
    }
    const student = await Student.findById(studentId).populate('branch');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const ceiling = student.branch?.maxDiscountPercent ?? 10;
    const discountAmount = Math.round((student.totalFee * discountPercent) / 100);

    if (discountPercent > ceiling && req.user.role !== 'admin') {
      return res.status(202).json({
        message: `Discount of ${discountPercent}% exceeds branch limit of ${ceiling}%. Admin approval required.`,
        requiresApproval: true,
        discountAmount,
      });
    }

    student.discount = discountAmount;
    student.discountApprovedBy = req.user._id;
    await student.save();
    res.json({ message: 'Discount applied', student });
  } catch (err) {
    res.status(400).json({ message: 'Error applying discount', error: err.message });
  }
};

// ──────────────────────────────────────────────
//  PAYMENTS – CRUD + receipt
// ──────────────────────────────────────────────

// Record payment
exports.recordPayment = async (req, res) => {
  try {
    const { studentId, amountPaid, paymentMode, transactionRef, remarks, installmentLabel } =
      req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const receiptNumber = await generateId(Payment, 'receiptNumber', 'RCPT');
    const payment = await Payment.create({
      receiptNumber,
      student: studentId,
      branch: student.branch,
      amountPaid,
      paymentMode,
      transactionRef,
      remarks,
      installmentLabel,
      collectedBy: req.user._id,
    });
    res.status(201).json({ payment });
  } catch (err) {
    res.status(400).json({ message: 'Could not record payment', error: err.message });
  }
};

// List payments (with filters)
exports.listPayments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.branch = req.user.branch;
    else if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.student) filter.student = req.query.student;
    if (req.query.from || req.query.to) {
      filter.paymentDate = {};
      if (req.query.from) filter.paymentDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.paymentDate.$lte = new Date(req.query.to);
    }

    const payments = await Payment.find(filter)
      .populate('student', 'name admissionId phone')
      .populate('branch', 'name code')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payments', error: err.message });
  }
};

// Get single payment
exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('student', 'name admissionId phone')
      .populate('branch', 'name code')
      .populate('collectedBy', 'name');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payment', error: err.message });
  }
};

// Update payment (restricted fields)
exports.updatePayment = async (req, res) => {
  try {
    // Only allow updating certain fields to maintain financial integrity
    const allowed = ['remarks', 'transactionRef', 'paymentDate', 'installmentLabel'];
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    // For admin, allow updating amount and mode (with caution)
    if (req.user.role === 'admin') {
      if (req.body.amountPaid !== undefined) updateData.amountPaid = req.body.amountPaid;
      if (req.body.paymentMode) updateData.paymentMode = req.body.paymentMode;
    }

    const payment = await Payment.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ payment });
  } catch (err) {
    res.status(400).json({ message: 'Could not update payment', error: err.message });
  }
};

// Delete payment (hard delete – only admin)
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete payment', error: err.message });
  }
};

// ──────────────────────────────────────────────
//  PENDING FEES (unchanged)
// ──────────────────────────────────────────────

exports.pendingFees = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.user.role !== 'admin') filter.branch = req.user.branch;
    else if (req.query.branch) filter.branch = req.query.branch;

    const students = await Student.find(filter)
      .populate('course', 'name')
      .populate('branch', 'name');
    const payments = await Payment.aggregate([
      { $group: { _id: '$student', totalPaid: { $sum: '$amountPaid' } } },
    ]);
    const paidMap = new Map(payments.map((p) => [p._id.toString(), p.totalPaid]));

    const result = students
      .map((s) => {
        const paid = paidMap.get(s._id.toString()) || 0;
        const payable = (s.totalFee || 0) - (s.discount || 0);
        const pending = payable - paid;
        return {
          student: { _id: s._id, name: s.name, admissionId: s.admissionId, phone: s.phone },
          course: s.course?.name,
          branch: s.branch?.name,
          totalFee: s.totalFee,
          discount: s.discount,
          paid,
          pending: Math.max(pending, 0),
        };
      })
      .filter((r) => r.pending > 0)
      .sort((a, b) => b.pending - a.pending);

    res.json({ pendingFees: result });
  } catch (err) {
    res.status(500).json({ message: 'Error calculating pending fees', error: err.message });
  }
};

// ──────────────────────────────────────────────
//  RECEIPT PDF (unchanged)
// ──────────────────────────────────────────────

exports.receiptPdf = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('student', 'name admissionId phone')
      .populate('branch', 'name address phone email')
      .populate('collectedBy', 'name');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const settings = (await Settings.findOne()) || {};

    const doc = new PDFDocument({ size: 'A5', margin: 36 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${payment.receiptNumber}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').fillColor(settings.primaryColor || '#1E3A5F')
      .text(settings.instituteName || 'Success Point', { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#444')
      .text(payment.branch?.address || '', { align: 'center' })
      .text(`${payment.branch?.phone || ''}  ${payment.branch?.email || ''}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(36, doc.y).lineTo(559 - 36, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Fee Payment Receipt', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica');
    const row = (label, value) => {
      doc.font('Helvetica-Bold').text(label, { continued: true, width: 150 });
      doc.font('Helvetica').text(value || '-');
    };
    row('Receipt No: ', payment.receiptNumber);
    row('Date: ', new Date(payment.paymentDate).toLocaleString());
    row('Student: ', `${payment.student?.name} (${payment.student?.admissionId})`);
    row('Phone: ', payment.student?.phone);
    row('Amount Paid: ', `₹${payment.amountPaid}`);
    row('Payment Mode: ', payment.paymentMode.replace('_', ' ').toUpperCase());
    if (payment.transactionRef) row('Transaction Ref: ', payment.transactionRef);
    if (payment.installmentLabel) row('Installment: ', payment.installmentLabel);
    row('Collected By: ', payment.collectedBy?.name);
    if (payment.remarks) row('Remarks: ', payment.remarks);

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888').text('This is a system-generated receipt.', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Could not generate receipt', error: err.message });
  }
};
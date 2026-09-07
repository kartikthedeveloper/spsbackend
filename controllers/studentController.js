const Student = require('../models/Student');
const Settings = require('../models/Settings');
const { generateId } = require('../utils/idGenerator');
const PDFDocument = require('pdfkit');

// ──────────────────────────────────────
//  CREATE
// ──────────────────────────────────────
exports.createStudent = async (req, res) => {
  try {
    const branch =
      req.user.role === 'admin'
        ? req.body.branch
        : req.user.branch;

    if (!branch) {
      return res.status(400).json({
        message: 'Branch is required',
      });
    }

    // Generate unique admission ID
    const admissionId = await generateId(
      Student,
      'admissionId',
      'SP'
    );

    // Get settings
    const settings = (await Settings.findOne()) || {};

    // ID card expiry
    const idCardExpiry = new Date();
    idCardExpiry.setMonth(
      idCardExpiry.getMonth() +
        (settings.idCardValidityMonths || 12)
    );

    // Prepare student data
    const studentData = {
      ...req.body,
      branch,
      admissionId,
      idCardExpiry,
    };

    // Required fields
    const required = ['name', 'phone', 'course'];

    for (const field of required) {
      if (!studentData[field]) {
        return res.status(400).json({
          message: `Missing required field: ${field}`,
        });
      }
    }

    // -----------------------------------------
    // FIX: Remove empty ObjectId fields
    // -----------------------------------------

    if (!studentData.batch || studentData.batch === '') {
      delete studentData.batch;
    }

    if (
      !studentData.leadSource ||
      studentData.leadSource === ''
    ) {
      delete studentData.leadSource;
    }

    // Create student
    const student = await Student.create(studentData);

    res.status(201).json({
      message: 'Student admission created successfully',
      student,
    });
  } catch (err) {
    console.error('CREATE STUDENT ERROR:', err);

    res.status(400).json({
      message: 'Could not create admission',
      error: err.message,
    });
  }
};

// ──────────────────────────────────────
//  LIST (with pagination, filtering, search)
// ──────────────────────────────────────
exports.listStudents = async (req, res) => {
  try {
    const filter = { isActive: true };

    // Branch filtering
    if (req.user.role !== 'admin') {
      filter.branch = req.user.branch;
    } else if (req.query.branch) {
      filter.branch = req.query.branch;
    }

    // Additional filters
    if (req.query.course) filter.course = req.query.course;
    if (req.query.batch) filter.batch = req.query.batch;
    if (req.query.status) filter.admissionStatus = req.query.status;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('branch', 'name code')
        .populate('course', 'name')
        .populate('batch', 'name timing')
        .populate('leadSource', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    res.json({
      students,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching students', error: err.message });
  }
};

// ──────────────────────────────────────
//  GET SINGLE STUDENT
// ──────────────────────────────────────
exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('branch', 'name code')
      .populate('course', 'name')
      .populate('batch', 'name timing')
      .populate('leadSource', 'name');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json({ student });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching student', error: err.message });
  }
};

// ──────────────────────────────────────
//  UPDATE STUDENT (all fields except admissionId and branch if not admin)
// ──────────────────────────────────────
exports.updateStudent = async (req, res) => {
  try {
    // Prevent updating admissionId (auto-generated)
    delete req.body.admissionId;

    // If user is not admin, disallow branch change
    if (req.user.role !== 'admin') {
      delete req.body.branch;
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('branch course batch');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json({ student });
  } catch (err) {
    res.status(400).json({ message: 'Could not update student', error: err.message });
  }
};

// ──────────────────────────────────────
//  DELETE (soft delete – set isActive = false)
// ──────────────────────────────────────
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json({ message: 'Student deactivated', student });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete student', error: err.message });
  }
};

// ──────────────────────────────────────
//  DOCUMENT MANAGEMENT
// ──────────────────────────────────────
// Add a document to a student
exports.addDocument = async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ message: 'Document name and URL are required' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.documents.push({ name, url, uploadedAt: new Date() });
    await student.save();
    res.status(201).json({ message: 'Document added', documents: student.documents });
  } catch (err) {
    res.status(400).json({ message: 'Could not add document', error: err.message });
  }
};

// Remove a document
exports.removeDocument = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const docIndex = student.documents.findIndex(d => d._id.toString() === req.params.docId);
    if (docIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }

    student.documents.splice(docIndex, 1);
    await student.save();
    res.json({ message: 'Document removed', documents: student.documents });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove document', error: err.message });
  }
};

// ──────────────────────────────────────
//  BULK STATUS UPDATE (optional)
// ──────────────────────────────────────
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { studentIds, admissionStatus } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'studentIds array required' });
    }
    if (!admissionStatus) {
      return res.status(400).json({ message: 'admissionStatus required' });
    }

    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      { admissionStatus },
      { runValidators: true }
    );
    res.json({ message: `${result.nModified} students updated`, result });
  } catch (err) {
    res.status(400).json({ message: 'Bulk update failed', error: err.message });
  }
};

// ──────────────────────────────────────
//  GENERATE ID CARD (PDF)
// ──────────────────────────────────────
exports.generateIdCard = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('branch', 'name code address phone')
      .populate('course', 'name');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const settings = (await Settings.findOne()) || {};

    const doc = new PDFDocument({ size: [242, 153], margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="idcard-${student.admissionId}.pdf"`);
    doc.pipe(res);

    const primary = settings.primaryColor || '#1E3A5F';
    const accent = settings.accentColor || '#D9822B';

    doc.rect(0, 0, 242, 153).fill(primary);
    doc.rect(0, 0, 242, 34).fill(accent);
    doc.fillColor('#fff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text(settings.instituteName || 'Success Point', 10, 10);

    doc.fillColor('#fff')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text(student.name, 10, 44);
    doc.font('Helvetica')
       .fontSize(7.5)
       .text(`ID: ${student.admissionId}`, 10, 60)
       .text(`Course: ${student.course?.name || '-'}`, 10, 74)
       .text(`Branch: ${student.branch?.name || '-'}`, 10, 88)
       .text(`Phone: ${student.phone}`, 10, 102)
       .text(`Valid till: ${student.idCardExpiry ? new Date(student.idCardExpiry).toLocaleDateString() : '-'}`, 10, 116);

    doc.fontSize(6.5)
       .fillColor('#dbe3ea')
       .text(student.branch?.address || '', 10, 134, { width: 222 });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Could not generate ID card', error: err.message });
  }
};
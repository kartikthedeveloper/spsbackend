const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const Settings = require('../models/Settings');
const { generateId } = require('../utils/idGenerator');
const PDFDocument = require('pdfkit');

// =====================================================
// HELPER
// =====================================================

const getUserBranch = (req) => {
  return req.user.role === 'admin'
    ? req.body.branch || req.query.branch
    : req.user.branch;
};

// =====================================================
// CREATE STUDENT / ADMISSION
// =====================================================

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

    const {
      name,
      phone,
      course,
      feeStructure: feeStructureId,
      batch,
      leadSource,
      discountPercent = 0,
    } = req.body;

    // -------------------------------------------------
    // REQUIRED FIELDS
    // -------------------------------------------------

    if (!name || !phone || !course) {
      return res.status(400).json({
        message:
          'Name, phone and course are required',
      });
    }

    // -------------------------------------------------
    // GET FEE STRUCTURE
    // -------------------------------------------------

    let feeStructure = null;

    if (feeStructureId) {
      feeStructure =
        await FeeStructure.findOne({
          _id: feeStructureId,
          course,
          branch,
          isActive: true,
        });

      if (!feeStructure) {
        return res.status(400).json({
          message:
            'Invalid fee structure for selected course and branch',
        });
      }
    }

    // -------------------------------------------------
    // FEE CALCULATION
    // -------------------------------------------------

    const totalFee =
      Number(
        req.body.totalFee ??
          feeStructure?.totalAmount ??
          0
      );

    const universityFee =
      Number(
        req.body.universityFee ??
          feeStructure?.universityFee ??
          0
      );

    const discountPct =
      Number(discountPercent) || 0;

    if (totalFee < 0) {
      return res.status(400).json({
        message: 'Total fee cannot be negative',
      });
    }

    if (
      discountPct < 0 ||
      discountPct > 100
    ) {
      return res.status(400).json({
        message:
          'Discount percentage must be between 0 and 100',
      });
    }

    const discountAmount = Math.round(
      (totalFee * discountPct) / 100
    );

    const netFee =
      totalFee - discountAmount;

    if (universityFee < 0) {
      return res.status(400).json({
        message:
          'University fee cannot be negative',
      });
    }

    if (universityFee > netFee) {
      return res.status(400).json({
        message:
          'University fee cannot be greater than net student fee',
      });
    }

    // Institute expected share
    const instituteFee =
      netFee - universityFee;

    // -------------------------------------------------
    // ADMISSION ID
    // -------------------------------------------------

    const admissionId =
      await generateId(
        Student,
        'admissionId',
        'SP'
      );

    // -------------------------------------------------
    // SETTINGS
    // -------------------------------------------------

    const settings =
      (await Settings.findOne()) || {};

    const idCardExpiry =
      new Date();

    idCardExpiry.setMonth(
      idCardExpiry.getMonth() +
        (settings.idCardValidityMonths || 12)
    );

    // -------------------------------------------------
    // STUDENT DATA
    // -------------------------------------------------

    const studentData = {
      ...req.body,

      admissionId,

      branch,

      course,

      feeStructure:
        feeStructure?._id || null,

      totalFee,

      discountPercent:
        discountPct,

      discount:
        discountAmount,

      netFee,

      universityFee,

      instituteFee,

      idCardExpiry,
    };

    // Remove empty ObjectIds

    if (!batch) {
      delete studentData.batch;
    }

    if (!leadSource) {
      delete studentData.leadSource;
    }

    // -------------------------------------------------
    // CREATE
    // -------------------------------------------------

    const student =
      await Student.create(
        studentData
      );

    const populatedStudent =
      await Student.findById(
        student._id
      )
        .populate(
          'branch',
          'name code'
        )
        .populate(
          'course',
          'name'
        )
        .populate(
          'batch',
          'name timing'
        )
        .populate(
          'feeStructure',
          'name totalAmount universityFee'
        );

    res.status(201).json({
      message:
        'Student admission created successfully',

      student:
        populatedStudent,
    });
  } catch (err) {
    console.error(
      'CREATE STUDENT ERROR:',
      err
    );

    res.status(400).json({
      message:
        'Could not create admission',
      error: err.message,
    });
  }
};

// =====================================================
// LIST STUDENTS
// =====================================================

exports.listStudents = async (
  req,
  res
) => {
  try {
    const filter = {
      isActive: true,
    };

    // Branch filtering

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    } else if (req.query.branch) {
      filter.branch =
        req.query.branch;
    }

    // Filters

    if (req.query.course) {
      filter.course =
        req.query.course;
    }

    if (req.query.batch) {
      filter.batch =
        req.query.batch;
    }

    if (req.query.status) {
      filter.admissionStatus =
        req.query.status;
    }

    // Search

    if (req.query.search) {
      filter.$text = {
        $search: req.query.search,
      };
    }

    // Pagination

    const page =
      Math.max(
        Number(req.query.page) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) || 20,
          1
        ),
        100
      );

    const skip =
      (page - 1) * limit;

    const [
      students,
      total,
    ] = await Promise.all([
      Student.find(filter)
        .populate(
          'branch',
          'name code'
        )
        .populate(
          'course',
          'name'
        )
        .populate(
          'batch',
          'name timing'
        )
        .populate(
          'leadSource',
          'name'
        )
        .populate(
          'feeStructure',
          'name totalAmount universityFee'
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit),

      Student.countDocuments(filter),
    ]);

    res.json({
      students,

      total,

      page,

      pages:
        Math.ceil(
          total / limit
        ),
    });
  } catch (err) {
    console.error(
      'LIST STUDENTS ERROR:',
      err
    );

    res.status(500).json({
      message:
        'Error fetching students',

      error: err.message,
    });
  }
};

// =====================================================
// GET SINGLE STUDENT
// =====================================================

exports.getStudent = async (
  req,
  res
) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const student =
      await Student.findOne(filter)
        .populate(
          'branch',
          'name code address phone email'
        )
        .populate(
          'course',
          'name'
        )
        .populate(
          'batch',
          'name timing'
        )
        .populate(
          'leadSource',
          'name'
        )
        .populate(
          'feeStructure',
          'name totalAmount universityFee paymentFrequency numberOfInstallments'
        );

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    res.json({
      student,
    });
  } catch (err) {
    console.error(
      'GET STUDENT ERROR:',
      err
    );

    res.status(500).json({
      message:
        'Error fetching student',

      error: err.message,
    });
  }
};

// =====================================================
// UPDATE STUDENT
// =====================================================

exports.updateStudent = async (
  req,
  res
) => {
  try {
    const studentFilter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      studentFilter.branch =
        req.user.branch;
    }

    const existingStudent =
      await Student.findOne(
        studentFilter
      );

    if (!existingStudent) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    // Never update admission ID
    delete req.body.admissionId;

    // Non-admin cannot change branch
    if (req.user.role !== 'admin') {
      delete req.body.branch;
    }

    // -------------------------------------------------
    // FEE UPDATE
    // -------------------------------------------------

    const shouldUpdateFee =
      req.body.totalFee !== undefined ||
      req.body.discountPercent !== undefined ||
      req.body.universityFee !== undefined ||
      req.body.feeStructure !== undefined;

    if (shouldUpdateFee) {
      let feeStructure = null;

      const course =
        req.body.course ||
        existingStudent.course;

      const branch =
        req.body.branch ||
        existingStudent.branch;

      if (req.body.feeStructure) {
        feeStructure =
          await FeeStructure.findOne({
            _id:
              req.body.feeStructure,

            course,

            branch,

            isActive: true,
          });

        if (!feeStructure) {
          return res.status(400).json({
            message:
              'Invalid fee structure',
          });
        }
      }

      const totalFee =
        Number(
          req.body.totalFee ??
            feeStructure?.totalAmount ??
            existingStudent.totalFee ??
            0
        );

      const universityFee =
        Number(
          req.body.universityFee ??
            feeStructure?.universityFee ??
            existingStudent.universityFee ??
            0
        );

      const discountPct =
        Number(
          req.body.discountPercent ??
            existingStudent.discountPercent ??
            0
        );

      const discount =
        Math.round(
          (totalFee *
            discountPct) /
            100
        );

      const netFee =
        totalFee - discount;

      if (
        universityFee >
        netFee
      ) {
        return res.status(400).json({
          message:
            'University fee cannot be greater than net fee',
        });
      }

      const instituteFee =
        netFee -
        universityFee;

      req.body.totalFee =
        totalFee;

      req.body.discountPercent =
        discountPct;

      req.body.discount =
        discount;

      req.body.netFee =
        netFee;

      req.body.universityFee =
        universityFee;

      req.body.instituteFee =
        instituteFee;
    }

    // Remove empty ObjectIds

    if (
      req.body.batch === ''
    ) {
      req.body.batch = null;
    }

    if (
      req.body.leadSource === ''
    ) {
      req.body.leadSource = null;
    }

    const student =
      await Student.findOneAndUpdate(
        studentFilter,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate(
          'branch',
          'name code'
        )
        .populate(
          'course',
          'name'
        )
        .populate(
          'batch',
          'name timing'
        )
        .populate(
          'feeStructure',
          'name totalAmount universityFee'
        );

    res.json({
      message:
        'Student updated successfully',

      student,
    });
  } catch (err) {
    console.error(
      'UPDATE STUDENT ERROR:',
      err
    );

    res.status(400).json({
      message:
        'Could not update student',

      error: err.message,
    });
  }
};

// =====================================================
// DELETE / SOFT DELETE
// =====================================================

exports.deleteStudent = async (
  req,
  res
) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const student =
      await Student.findOneAndUpdate(
        filter,
        {
          isActive: false,
        },
        {
          new: true,
        }
      );

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    res.json({
      message:
        'Student deactivated',
      student,
    });
  } catch (err) {
    res.status(500).json({
      message:
        'Could not delete student',

      error: err.message,
    });
  }
};

// =====================================================
// ADD DOCUMENT
// =====================================================

exports.addDocument = async (
  req,
  res
) => {
  try {
    const {
      name,
      url,
    } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        message:
          'Document name and URL are required',
      });
    }

    const filter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const student =
      await Student.findOne(filter);

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    student.documents.push({
      name,
      url,
      uploadedAt:
        new Date(),
    });

    await student.save();

    res.status(201).json({
      message:
        'Document added',

      documents:
        student.documents,
    });
  } catch (err) {
    res.status(400).json({
      message:
        'Could not add document',

      error: err.message,
    });
  }
};

// =====================================================
// REMOVE DOCUMENT
// =====================================================

exports.removeDocument = async (
  req,
  res
) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const student =
      await Student.findOne(filter);

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    const docIndex =
      student.documents.findIndex(
        (doc) =>
          doc._id.toString() ===
          req.params.docId
      );

    if (docIndex === -1) {
      return res.status(404).json({
        message:
          'Document not found',
      });
    }

    student.documents.splice(
      docIndex,
      1
    );

    await student.save();

    res.json({
      message:
        'Document removed',

      documents:
        student.documents,
    });
  } catch (err) {
    res.status(400).json({
      message:
        'Could not remove document',

      error: err.message,
    });
  }
};

// =====================================================
// BULK STATUS UPDATE
// =====================================================

exports.bulkUpdateStatus = async (
  req,
  res
) => {
  try {
    const {
      studentIds,
      admissionStatus,
    } = req.body;

    const allowedStatuses = [
      'enquiry',
      'form_filled',
      'documents_pending',
      'confirmed',
      'cancelled',
    ];

    if (
      !Array.isArray(studentIds) ||
      studentIds.length === 0
    ) {
      return res.status(400).json({
        message:
          'studentIds array required',
      });
    }

    if (
      !allowedStatuses.includes(
        admissionStatus
      )
    ) {
      return res.status(400).json({
        message:
          'Invalid admission status',
      });
    }

    const filter = {
      _id: {
        $in: studentIds,
      },
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const result =
      await Student.updateMany(
        filter,
        {
          $set: {
            admissionStatus,
          },
        },
        {
          runValidators: true,
        }
      );

    res.json({
      message:
        `${result.modifiedCount} students updated`,

      result,
    });
  } catch (err) {
    res.status(400).json({
      message:
        'Bulk update failed',

      error: err.message,
    });
  }
};

// =====================================================
// DISCOUNT
// =====================================================

exports.applyDiscount = async (
  req,
  res
) => {
  try {
    const {
      discountPercent,
    } = req.body;

    if (
      discountPercent === undefined
    ) {
      return res.status(400).json({
        message:
          'discountPercent is required',
      });
    }

    const filter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const student =
      await Student.findOne(filter);

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    const percentage =
      Number(discountPercent);

    if (
      percentage < 0 ||
      percentage > 100
    ) {
      return res.status(400).json({
        message:
          'Discount must be between 0 and 100%',
      });
    }

    const discountAmount =
      Math.round(
        (student.totalFee *
          percentage) /
          100
      );

    const netFee =
      student.totalFee -
      discountAmount;

    if (
      student.universityFee >
      netFee
    ) {
      return res.status(400).json({
        message:
          'Discount makes net fee lower than university fee',
      });
    }

    student.discountPercent =
      percentage;

    student.discount =
      discountAmount;

    student.netFee =
      netFee;

    student.instituteFee =
      netFee -
      student.universityFee;

    student.discountApprovedBy =
      req.user._id;

    await student.save();

    res.json({
      message:
        'Discount applied successfully',

      student,
    });
  } catch (err) {
    res.status(400).json({
      message:
        'Error applying discount',

      error: err.message,
    });
  }
};

// =====================================================
// GENERATE ID CARD
// =====================================================

exports.generateIdCard = async (
  req,
  res
) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    }

    const student =
      await Student.findOne(filter)
        .populate(
          'branch',
          'name code address phone'
        )
        .populate(
          'course',
          'name'
        );

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    const settings =
      (await Settings.findOne()) ||
      {};

    const doc =
      new PDFDocument({
        size: [242, 153],
        margin: 0,
      });

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="idcard-${student.admissionId}.pdf"`
    );

    doc.pipe(res);

    const primary =
      settings.primaryColor ||
      '#1E3A5F';

    const accent =
      settings.accentColor ||
      '#D9822B';

    // Background
    doc
      .rect(
        0,
        0,
        242,
        153
      )
      .fill(primary);

    // Header
    doc
      .rect(
        0,
        0,
        242,
        34
      )
      .fill(accent);

    doc
      .fillColor('#fff')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(
        settings.instituteName ||
          'Success Point',
        10,
        10
      );

    // Student
    doc
      .fillColor('#fff')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(
        student.name,
        10,
        44
      );

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `ID: ${student.admissionId}`,
        10,
        60
      )
      .text(
        `Course: ${student.course?.name || '-'}`,
        10,
        74
      )
      .text(
        `Branch: ${student.branch?.name || '-'}`,
        10,
        88
      )
      .text(
        `Phone: ${student.phone}`,
        10,
        102
      )
      .text(
        `Valid till: ${
          student.idCardExpiry
            ? new Date(
                student.idCardExpiry
              ).toLocaleDateString()
            : '-'
        }`,
        10,
        116
      );

    doc
      .fontSize(6.5)
      .fillColor('#dbe3ea')
      .text(
        student.branch?.address ||
          '',
        10,
        134,
        {
          width: 222,
        }
      );

    doc.end();
  } catch (err) {
    res.status(500).json({
      message:
        'Could not generate ID card',

      error: err.message,
    });
  }
};

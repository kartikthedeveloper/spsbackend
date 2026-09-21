const Payment = require('../models/Payment');
const UniversityPayment = require('../models/UniversityPayment');
const Student = require('../models/Student');
const Settings = require('../models/Settings');
const { generateId } = require('../utils/idGenerator');
const PDFDocument = require('pdfkit');

// =====================================================
// HELPER
// =====================================================

const getStudentFilter = (
  req,
  studentId
) => {
  const filter = {
    _id: studentId,
  };

  if (req.user.role !== 'admin') {
    filter.branch =
      req.user.branch;
  }

  return filter;
};

// =====================================================
// RECORD STUDENT PAYMENT
// =====================================================

exports.recordPayment = async (
  req,
  res
) => {
  try {
    const {
      studentId,
      amountPaid,
      paymentMode,
      transactionRef,
      remarks,
      installmentLabel,
    } = req.body;

    if (
      !studentId ||
      !amountPaid ||
      !paymentMode
    ) {
      return res.status(400).json({
        message:
          'studentId, amountPaid and paymentMode are required',
      });
    }

    const amount =
      Number(amountPaid);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        message:
          'Amount paid must be greater than 0',
      });
    }

    // -------------------------------------------------
    // STUDENT
    // -------------------------------------------------

    const student =
      await Student.findOne(
        getStudentFilter(
          req,
          studentId
        )
      );

    if (!student) {
      return res.status(404).json({
        message:
          'Student not found',
      });
    }

    // -------------------------------------------------
    // ALREADY PAID
    // -------------------------------------------------

    const paymentSummary =
      await Payment.aggregate([
        {
          $match: {
            student:
              student._id,
          },
        },

        {
          $group: {
            _id: null,

            totalPaid: {
              $sum: '$amountPaid',
            },
          },
        },
      ]);

    const alreadyPaid =
      paymentSummary[0]
        ?.totalPaid || 0;

    const pending =
      Math.max(
        student.netFee -
          alreadyPaid,
        0
      );

    if (amount > pending) {
      return res.status(400).json({
        message:
          `Payment cannot exceed pending fee. Maximum allowed: ₹${pending}`,
      });
    }

    // -------------------------------------------------
    // RECEIPT NUMBER
    // -------------------------------------------------

    const receiptNumber =
      await generateId(
        Payment,
        'receiptNumber',
        'RCPT'
      );

    // -------------------------------------------------
    // CREATE
    // -------------------------------------------------

    const payment =
      await Payment.create({
        receiptNumber,

        student:
          student._id,

        branch:
          student.branch,

        amountPaid:
          amount,

        paymentMode,

        transactionRef,

        remarks,

        installmentLabel,

        collectedBy:
          req.user._id,
      });

    res.status(201).json({
      message:
        'Student payment recorded successfully',

      payment,

      calculation: {
        totalFee:
          student.totalFee,

        discount:
          student.discount,

        netFee:
          student.netFee,

        universityFee:
          student.universityFee,

        instituteFee:
          student.instituteFee,

        alreadyPaid,

        currentPayment:
          amount,

        remainingStudentFee:
          pending - amount,
      },
    });
  } catch (err) {
    console.error(
      'RECORD PAYMENT ERROR:',
      err
    );

    res.status(400).json({
      message:
        'Could not record payment',

      error: err.message,
    });
  }
};

// =====================================================
// LIST STUDENT PAYMENTS
// =====================================================

exports.requestDiscount = async (req, res) => {
  try {
    const { studentId, discount, discountPercent, remarks } = req.body;

    if (!studentId) {
      return res.status(400).json({
        message: 'Student ID is required'
      });
    }

    const student = await Student.findOne({
      _id: studentId,
      ...getStudentFilter(req, studentId)
    });

    if (!student) {
      return res.status(404).json({
        message: 'Student not found'
      });
    }

    const totalFee = Number(student.totalFee || 0);

    let discountAmount = Number(discount || 0);

    if (discountPercent !== undefined && discountPercent !== null) {
      const percent = Number(discountPercent);

      if (percent < 0 || percent > 100) {
        return res.status(400).json({
          message: 'Discount percentage must be between 0 and 100'
        });
      }

      discountAmount = (totalFee * percent) / 100;
    }

    if (discountAmount < 0 || discountAmount > totalFee) {
      return res.status(400).json({
        message: 'Invalid discount amount'
      });
    }

    const finalDiscount = Math.round(discountAmount * 100) / 100;
    const netFee = Math.max(0, totalFee - finalDiscount);

    const universityFee = Number(student.universityFee || 0);

    if (universityFee > netFee) {
      return res.status(400).json({
        message: 'University fee cannot be greater than net fee after discount'
      });
    }

    student.discount = finalDiscount;

    student.discountPercent =
      totalFee > 0
        ? Math.round((finalDiscount / totalFee) * 10000) / 100
        : 0;

    student.netFee = netFee;
    student.instituteFee = Math.max(0, netFee - universityFee);

    if (req.user?._id) {
      student.discountApprovedBy = req.user._id;
    }

    await student.save();

    return res.json({
      message: 'Discount updated successfully',
      student: {
        id: student._id,
        totalFee: student.totalFee,
        discountPercent: student.discountPercent,
        discount: student.discount,
        netFee: student.netFee,
        universityFee: student.universityFee,
        instituteFee: student.instituteFee
      },
      remarks: remarks || ''
    });
  } catch (error) {
    console.error('requestDiscount error:', error);

    return res.status(500).json({
      message: 'Failed to update discount',
      error: error.message
    });
  }
};

exports.listPayments = async (
  req,
  res
) => {
  try {
    const filter = {};

    if (req.user.role !== 'admin') {
      filter.branch =
        req.user.branch;
    } else if (req.query.branch) {
      filter.branch =
        req.query.branch;
    }

    if (req.query.student) {
      filter.student =
        req.query.student;
    }

    if (
      req.query.from ||
      req.query.to
    ) {
      filter.paymentDate = {};

      if (req.query.from) {
        filter.paymentDate.$gte =
          new Date(
            req.query.from
          );
      }

      if (req.query.to) {
        const toDate =
          new Date(
            req.query.to
          );

        toDate.setHours(
          23,
          59,
          59,
          999
        );

        filter.paymentDate.$lte =
          toDate;
      }
    }

    const payments =
      await Payment.find(filter)
        .populate(
          'student',
          'name admissionId phone'
        )
        .populate(
          'branch',
          'name code'
        )
        .populate(
          'collectedBy',
          'name'
        )
        .sort({
          paymentDate: -1,
        });

    res.json({
      payments,
    });
  } catch (err) {
    res.status(500).json({
      message:
        'Error fetching payments',

      error: err.message,
    });
  }
};

// =====================================================
// GET SINGLE PAYMENT
// =====================================================

exports.getPayment = async (
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

    const payment =
      await Payment.findOne(filter)
        .populate(
          'student',
          'name admissionId phone'
        )
        .populate(
          'branch',
          'name code'
        )
        .populate(
          'collectedBy',
          'name'
        );

    if (!payment) {
      return res.status(404).json({
        message:
          'Payment not found',
      });
    }

    res.json({
      payment,
    });
  } catch (err) {
    res.status(500).json({
      message:
        'Error fetching payment',

      error: err.message,
    });
  }
};

// =====================================================
// UPDATE STUDENT PAYMENT
// =====================================================

exports.updatePayment = async (
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

    const payment =
      await Payment.findOne(filter);

    if (!payment) {
      return res.status(404).json({
        message:
          'Payment not found',
      });
    }

    const allowed = [
      'remarks',
      'transactionRef',
      'paymentDate',
      'installmentLabel',
    ];

    const updateData = {};

    for (
      const key of allowed
    ) {
      if (
        req.body[key] !==
        undefined
      ) {
        updateData[key] =
          req.body[key];
      }
    }

    // Only admin can change amount/mode
    if (
      req.user.role === 'admin'
    ) {
      if (
        req.body.amountPaid !==
        undefined
      ) {
        const newAmount =
          Number(
            req.body.amountPaid
          );

        if (
          !Number.isFinite(
            newAmount
          ) ||
          newAmount <= 0
        ) {
          return res.status(400).json({
            message:
              'Invalid payment amount',
          });
        }

        // Get student
        const student =
          await Student.findById(
            payment.student
          );

        if (!student) {
          return res.status(404).json({
            message:
              'Student not found',
          });
        }

        // Other payments
        const summary =
          await Payment.aggregate([
            {
              $match: {
                student:
                  student._id,

                _id: {
                  $ne:
                    payment._id,
                },
              },
            },

            {
              $group: {
                _id: null,

                totalPaid: {
                  $sum:
                    '$amountPaid',
                },
              },
            },
          ]);

        const otherPaid =
          summary[0]
            ?.totalPaid || 0;

        const maxAllowed =
          Math.max(
            student.netFee -
              otherPaid,
            0
          );

        if (
          newAmount >
          maxAllowed
        ) {
          return res.status(400).json({
            message:
              `Amount exceeds pending fee. Maximum allowed: ₹${maxAllowed}`,
          });
        }

        updateData.amountPaid =
          newAmount;
      }

      if (
        req.body.paymentMode
      ) {
        updateData.paymentMode =
          req.body.paymentMode;
      }
    }

    const updatedPayment =
      await Payment.findOneAndUpdate(
        filter,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    res.json({
      message:
        'Payment updated successfully',

      payment:
        updatedPayment,
    });
  } catch (err) {
    res.status(400).json({
      message:
        'Could not update payment',

      error: err.message,
    });
  }
};

// =====================================================
// DELETE PAYMENT
// =====================================================

exports.deletePayment = async (
  req,
  res
) => {
  try {
    if (
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        message:
          'Only admin can delete payments',
      });
    }

    const payment =
      await Payment.findByIdAndDelete(
        req.params.id
      );

    if (!payment) {
      return res.status(404).json({
        message:
          'Payment not found',
      });
    }

    res.json({
      message:
        'Payment deleted successfully',
    });
  } catch (err) {
    res.status(500).json({
      message:
        'Could not delete payment',

      error: err.message,
    });
  }
};

// =====================================================
// RECORD UNIVERSITY PAYMENT
// =====================================================

exports.recordUniversityPayment =
  async (req, res) => {
    try {
      const {
        studentId,
        amountPaid,
        paymentMode,
        transactionRef,
        remarks,
      } = req.body;

      if (
        !studentId ||
        !amountPaid ||
        !paymentMode
      ) {
        return res.status(400).json({
          message:
            'studentId, amountPaid and paymentMode are required',
        });
      }

      const amount =
        Number(amountPaid);

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        return res.status(400).json({
          message:
            'Amount paid must be greater than 0',
        });
      }

      // -------------------------------------------------
      // STUDENT
      // -------------------------------------------------

      const student =
        await Student.findOne(
          getStudentFilter(
            req,
            studentId
          )
        );

      if (!student) {
        return res.status(404).json({
          message:
            'Student not found',
        });
      }

      // -------------------------------------------------
      // ALREADY PAID TO UNIVERSITY
      // -------------------------------------------------

      const summary =
        await UniversityPayment.aggregate(
          [
            {
              $match: {
                student:
                  student._id,
              },
            },

            {
              $group: {
                _id: null,

                totalPaid: {
                  $sum:
                    '$amountPaid',
                },
              },
            },
          ]
        );

      const alreadyPaid =
        summary[0]
          ?.totalPaid || 0;

      const pending =
        Math.max(
          student.universityFee -
            alreadyPaid,
          0
        );

      if (amount > pending) {
        return res.status(400).json({
          message:
            `University payment cannot exceed pending university fee. Maximum allowed: ₹${pending}`,
        });
      }

      // -------------------------------------------------
      // PAYMENT NUMBER
      // -------------------------------------------------

      const paymentNumber =
        await generateId(
          UniversityPayment,
          'paymentNumber',
          'UNIPAY'
        );

      // -------------------------------------------------
      // CREATE
      // -------------------------------------------------

      const payment =
        await UniversityPayment.create(
          {
            paymentNumber,

            student:
              student._id,

            branch:
              student.branch,

            amountPaid:
              amount,

            paymentMode,

            transactionRef,

            remarks,

            paidBy:
              req.user._id,
          }
        );

      res.status(201).json({
        message:
          'University payment recorded successfully',

        payment,

        calculation: {
          universityFee:
            student.universityFee,

          alreadyPaid,

          currentPayment:
            amount,

          remainingUniversityFee:
            pending - amount,
        },
      });
    } catch (err) {
      console.error(
        'UNIVERSITY PAYMENT ERROR:',
        err
      );

      res.status(400).json({
        message:
          'Could not record university payment',

        error: err.message,
      });
    }
  };

// =====================================================
// LIST UNIVERSITY PAYMENTS
// =====================================================

exports.listUniversityPayments =
  async (req, res) => {
    try {
      const filter = {};

      if (
        req.user.role !== 'admin'
      ) {
        filter.branch =
          req.user.branch;
      } else if (
        req.query.branch
      ) {
        filter.branch =
          req.query.branch;
      }

      if (req.query.student) {
        filter.student =
          req.query.student;
      }

      const payments =
        await UniversityPayment.find(
          filter
        )
          .populate(
            'student',
            'name admissionId phone'
          )
          .populate(
            'branch',
            'name code'
          )
          .populate(
            'paidBy',
            'name'
          )
          .sort({
            paymentDate: -1,
          });

      res.json({
        payments,
      });
    } catch (err) {
      res.status(500).json({
        message:
          'Error fetching university payments',

        error: err.message,
      });
    }
  };

// =====================================================
// STUDENT FEE DETAILS
// =====================================================

exports.getStudentFeeDetails =
  async (req, res) => {
    try {
      const student =
        await Student.findOne(
          getStudentFilter(
            req,
            req.params.id
          )
        )
          .populate(
            'course',
            'name'
          )
          .populate(
            'branch',
            'name code'
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

      // -------------------------------------------------
      // STUDENT PAYMENT
      // -------------------------------------------------

      const studentPayment =
        await Payment.aggregate([
          {
            $match: {
              student:
                student._id,
            },
          },

          {
            $group: {
              _id: null,

              totalPaid: {
                $sum:
                  '$amountPaid',
              },
            },
          },
        ]);

      // -------------------------------------------------
      // UNIVERSITY PAYMENT
      // -------------------------------------------------

      const universityPayment =
        await UniversityPayment.aggregate(
          [
            {
              $match: {
                student:
                  student._id,
              },
            },

            {
              $group: {
                _id: null,

                totalPaid: {
                  $sum:
                    '$amountPaid',
                },
              },
            },
          ]
        );

      const studentPaid =
        studentPayment[0]
          ?.totalPaid || 0;

      const universityPaid =
        universityPayment[0]
          ?.totalPaid || 0;

      // -------------------------------------------------
      // CALCULATION
      // -------------------------------------------------

      const studentPending =
        Math.max(
          student.netFee -
            studentPaid,
          0
        );

      const universityPending =
        Math.max(
          student.universityFee -
            universityPaid,
          0
        );

      const instituteExpected =
        student.instituteFee;

      const instituteReceived =
        studentPaid -
        universityPaid;

      res.json({
        student: {
          _id:
            student._id,

          admissionId:
            student.admissionId,

          name:
            student.name,

          phone:
            student.phone,

          course:
            student.course,

          branch:
            student.branch,
        },

        fee: {
          totalFee:
            student.totalFee,

          discountPercent:
            student.discountPercent,

          discount:
            student.discount,

          netFee:
            student.netFee,

          universityFee:
            student.universityFee,

          instituteFee:
            student.instituteFee,
        },

        studentPayment: {
          paid:
            studentPaid,

          pending:
            studentPending,
        },

        universityPayment: {
          payable:
            student.universityFee,

          paid:
            universityPaid,

          pending:
            universityPending,
        },

        institute: {
          expected:
            instituteExpected,

          received:
            instituteReceived,
        },
      });
    } catch (err) {
      console.error(
        'STUDENT FEE DETAILS ERROR:',
        err
      );

      res.status(500).json({
        message:
          'Error calculating student fee details',

        error: err.message,
      });
    }
  };

// =====================================================
// PENDING FEES
// =====================================================

exports.pendingFees =
  async (req, res) => {
    try {
      const studentFilter = {
        isActive: true,
      };

      const paymentFilter = {};

      const universityFilter = {};

      if (
        req.user.role !== 'admin'
      ) {
        studentFilter.branch =
          req.user.branch;

        paymentFilter.branch =
          req.user.branch;

        universityFilter.branch =
          req.user.branch;
      } else if (
        req.query.branch
      ) {
        studentFilter.branch =
          req.query.branch;

        paymentFilter.branch =
          req.query.branch;

        universityFilter.branch =
          req.query.branch;
      }

      const students =
        await Student.find(
          studentFilter
        )
          .populate(
            'course',
            'name'
          )
          .populate(
            'branch',
            'name'
          );

      // -------------------------------------------------
      // STUDENT PAYMENTS
      // -------------------------------------------------

      const studentPayments =
        await Payment.aggregate([
          {
            $match:
              paymentFilter,
          },

          {
            $group: {
              _id: '$student',

              totalPaid: {
                $sum:
                  '$amountPaid',
              },
            },
          },
        ]);

      // -------------------------------------------------
      // UNIVERSITY PAYMENTS
      // -------------------------------------------------

      const universityPayments =
        await UniversityPayment.aggregate(
          [
            {
              $match:
                universityFilter,
            },

            {
              $group: {
                _id: '$student',

                totalPaid: {
                  $sum:
                    '$amountPaid',
                },
              },
            },
          ]
        );

      const studentPaidMap =
        new Map(
          studentPayments.map(
            (item) => [
              item._id.toString(),
              item.totalPaid,
            ]
          )
        );

      const universityPaidMap =
        new Map(
          universityPayments.map(
            (item) => [
              item._id.toString(),
              item.totalPaid,
            ]
          )
        );

      const result =
        students
          .map((student) => {
            const id =
              student._id.toString();

            const studentPaid =
              studentPaidMap.get(
                id
              ) || 0;

            const universityPaid =
              universityPaidMap.get(
                id
              ) || 0;

            const studentPending =
              Math.max(
                student.netFee -
                  studentPaid,
                0
              );

            const universityPending =
              Math.max(
                student.universityFee -
                  universityPaid,
                0
              );

            const instituteReceived =
              studentPaid -
              universityPaid;

            return {
              student: {
                _id:
                  student._id,

                name:
                  student.name,

                admissionId:
                  student.admissionId,

                phone:
                  student.phone,
              },

              course:
                student.course?.name,

              branch:
                student.branch?.name,

              totalFee:
                student.totalFee,

              discount:
                student.discount,

              netFee:
                student.netFee,

              universityFee:
                student.universityFee,

              instituteFee:
                student.instituteFee,

              studentPaid,

              studentPending,

              universityPaid,

              universityPending,

              instituteReceived,
            };
          })
          .filter(
            (item) =>
              item.studentPending >
                0 ||
              item.universityPending >
                0
          )
          .sort(
            (a, b) =>
              b.studentPending -
              a.studentPending
          );

      res.json({
        pendingFees:
          result,
      });
    } catch (err) {
      console.error(
        'PENDING FEES ERROR:',
        err
      );

      res.status(500).json({
        message:
          'Error calculating pending fees',

        error: err.message,
      });
    }
  };

// =====================================================
// FEE DASHBOARD
// =====================================================

exports.feeDashboard =
  async (req, res) => {
    try {
      const studentFilter = {
        isActive: true,
      };

      const paymentFilter = {};

      const universityFilter = {};

      if (
        req.user.role !== 'admin'
      ) {
        studentFilter.branch =
          req.user.branch;

        paymentFilter.branch =
          req.user.branch;

        universityFilter.branch =
          req.user.branch;
      } else if (
        req.query.branch
      ) {
        studentFilter.branch =
          req.query.branch;

        paymentFilter.branch =
          req.query.branch;

        universityFilter.branch =
          req.query.branch;
      }

      const students =
        await Student.find(
          studentFilter
        ).select(
          `
          totalFee
          discount
          netFee
          universityFee
          instituteFee
          `
        );

      // -------------------------------------------------
      // STUDENT COLLECTION
      // -------------------------------------------------

      const studentSummary =
        await Payment.aggregate([
          {
            $match:
              paymentFilter,
          },

          {
            $group: {
              _id: null,

              totalCollected: {
                $sum:
                  '$amountPaid',
              },
            },
          },
        ]);

      // -------------------------------------------------
      // UNIVERSITY PAYMENT
      // -------------------------------------------------

      const universitySummary =
        await UniversityPayment.aggregate(
          [
            {
              $match:
                universityFilter,
            },

            {
              $group: {
                _id: null,

                totalPaid: {
                  $sum:
                    '$amountPaid',
                },
              },
            },
          ]
        );

      // -------------------------------------------------
      // TOTALS
      // -------------------------------------------------

      const totalFee =
        students.reduce(
          (sum, student) =>
            sum +
            (student.totalFee ||
              0),
          0
        );

      const totalDiscount =
        students.reduce(
          (sum, student) =>
            sum +
            (student.discount ||
              0),
          0
        );

      const totalNetFee =
        students.reduce(
          (sum, student) =>
            sum +
            (student.netFee ||
              0),
          0
        );

      const totalUniversityFee =
        students.reduce(
          (sum, student) =>
            sum +
            (student.universityFee ||
              0),
          0
        );

      const totalInstituteFee =
        students.reduce(
          (sum, student) =>
            sum +
            (student.instituteFee ||
              0),
          0
        );

      const totalStudentCollected =
        studentSummary[0]
          ?.totalCollected || 0;

      const totalUniversityPaid =
        universitySummary[0]
          ?.totalPaid || 0;

      const totalStudentPending =
        Math.max(
          totalNetFee -
            totalStudentCollected,
          0
        );

      const totalUniversityPending =
        Math.max(
          totalUniversityFee -
            totalUniversityPaid,
          0
        );

      const instituteNetBalance =
        totalStudentCollected -
        totalUniversityPaid;

      res.json({
        dashboard: {
          totalStudents:
            students.length,

          totalFee,

          totalDiscount,

          totalNetFee,

          totalUniversityFee,

          totalInstituteFee,

          totalStudentCollected,

          totalStudentPending,

          totalUniversityPaid,

          totalUniversityPending,

          instituteNetBalance,
        },
      });
    } catch (err) {
      console.error(
        'FEE DASHBOARD ERROR:',
        err
      );

      res.status(500).json({
        message:
          'Error calculating fee dashboard',

        error: err.message,
      });
    }
  };

// =====================================================
// UNIVERSITY PAYMENT UPDATE
// =====================================================

exports.updateUniversityPayment =
  async (req, res) => {
    try {
      const filter = {
        _id: req.params.id,
      };

      if (
        req.user.role !== 'admin'
      ) {
        filter.branch =
          req.user.branch;
      }

      const payment =
        await UniversityPayment.findOne(
          filter
        );

      if (!payment) {
        return res.status(404).json({
          message:
            'University payment not found',
        });
      }

      const updateData = {};

      const allowed = [
        'transactionRef',
        'remarks',
        'paymentDate',
      ];

      for (
        const key of allowed
      ) {
        if (
          req.body[key] !==
          undefined
        ) {
          updateData[key] =
            req.body[key];
        }
      }

      if (
        req.user.role === 'admin'
      ) {
        if (
          req.body.amountPaid !==
          undefined
        ) {
          const student =
            await Student.findById(
              payment.student
            );

          if (!student) {
            return res.status(404).json({
              message:
                'Student not found',
            });
          }

          const newAmount =
            Number(
              req.body.amountPaid
            );

          const otherPayments =
            await UniversityPayment.aggregate(
              [
                {
                  $match: {
                    student:
                      student._id,

                    _id: {
                      $ne:
                        payment._id,
                    },
                  },
                },

                {
                  $group: {
                    _id: null,

                    totalPaid: {
                      $sum:
                        '$amountPaid',
                    },
                  },
                },
              ]
            );

          const otherPaid =
            otherPayments[0]
              ?.totalPaid || 0;

          const maxAllowed =
            Math.max(
              student.universityFee -
                otherPaid,
              0
            );

          if (
            newAmount >
            maxAllowed
          ) {
            return res.status(400).json({
              message:
                `Amount exceeds university fee. Maximum allowed: ₹${maxAllowed}`,
            });
          }

          updateData.amountPaid =
            newAmount;
        }

        if (
          req.body.paymentMode
        ) {
          updateData.paymentMode =
            req.body.paymentMode;
        }
      }

      const updated =
        await UniversityPayment.findOneAndUpdate(
          filter,
          updateData,
          {
            new: true,
            runValidators: true,
          }
        );

      res.json({
        message:
          'University payment updated successfully',

        payment:
          updated,
      });
    } catch (err) {
      res.status(400).json({
        message:
          'Could not update university payment',

        error: err.message,
      });
    }
  };

// =====================================================
// DELETE UNIVERSITY PAYMENT
// =====================================================

exports.deleteUniversityPayment =
  async (req, res) => {
    try {
      if (
        req.user.role !== 'admin'
      ) {
        return res.status(403).json({
          message:
            'Only admin can delete university payments',
        });
      }

      const payment =
        await UniversityPayment.findByIdAndDelete(
          req.params.id
        );

      if (!payment) {
        return res.status(404).json({
          message:
            'University payment not found',
        });
      }

      res.json({
        message:
          'University payment deleted successfully',
      });
    } catch (err) {
      res.status(500).json({
        message:
          'Could not delete university payment',

        error: err.message,
      });
    }
  };

// =====================================================
// STUDENT PAYMENT RECEIPT PDF
// =====================================================

exports.receiptPdf = async (
  req,
  res
) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (
      req.user.role !== 'admin'
    ) {
      filter.branch =
        req.user.branch;
    }

    const payment =
      await Payment.findOne(filter)
        .populate(
          'student',
          'name admissionId phone'
        )
        .populate(
          'branch',
          'name address phone email'
        )
        .populate(
          'collectedBy',
          'name'
        );

    if (!payment) {
      return res.status(404).json({
        message:
          'Payment not found',
      });
    }

    const settings =
      (await Settings.findOne()) ||
      {};

    const doc =
      new PDFDocument({
        size: 'A5',
        margin: 36,
      });

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${payment.receiptNumber}.pdf"`
    );

    doc.pipe(res);

    // -------------------------------------------------
    // HEADER
    // -------------------------------------------------

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor(
        settings.primaryColor ||
          '#1E3A5F'
      )
      .text(
        settings.instituteName ||
          'Success Point',
        {
          align: 'center',
        }
      );

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#444')
      .text(
        payment.branch?.address ||
          '',
        {
          align: 'center',
        }
      )
      .text(
        `${
          payment.branch?.phone ||
          ''
        } ${
          payment.branch?.email ||
          ''
        }`,
        {
          align: 'center',
        }
      );

    doc.moveDown();

    doc
      .moveTo(36, doc.y)
      .lineTo(
        559 - 36,
        doc.y
      )
      .strokeColor('#ccc')
      .stroke();

    doc.moveDown();

    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text(
        'Fee Payment Receipt',
        {
          align: 'center',
        }
      );

    doc.moveDown();

    // -------------------------------------------------
    // DETAILS
    // -------------------------------------------------

    doc
      .fontSize(10)
      .font('Helvetica');

    const row = (
      label,
      value
    ) => {
      doc
        .font('Helvetica-Bold')
        .text(
          label,
          {
            continued: true,
            width: 150,
          }
        );

      doc
        .font('Helvetica')
        .text(
          value || '-'
        );
    };

    row(
      'Receipt No: ',
      payment.receiptNumber
    );

    row(
      'Date: ',
      new Date(
        payment.paymentDate
      ).toLocaleString()
    );

    row(
      'Student: ',
      `${payment.student?.name} (${payment.student?.admissionId})`
    );

    row(
      'Phone: ',
      payment.student?.phone
    );

    row(
      'Amount Paid: ',
      `₹${payment.amountPaid}`
    );

    row(
      'Payment Mode: ',
      payment.paymentMode
        .replace(
          '_',
          ' '
        )
        .toUpperCase()
    );

    if (
      payment.transactionRef
    ) {
      row(
        'Transaction Ref: ',
        payment.transactionRef
      );
    }

    if (
      payment.installmentLabel
    ) {
      row(
        'Installment: ',
        payment.installmentLabel
      );
    }

    row(
      'Collected By: ',
      payment.collectedBy?.name
    );

    if (
      payment.remarks
    ) {
      row(
        'Remarks: ',
        payment.remarks
      );
    }

    doc.moveDown(2);

    doc
      .fontSize(8)
      .fillColor('#888')
      .text(
        'This is a system-generated receipt.',
        {
          align: 'center',
        }
      );

    doc.end();
  } catch (err) {
    res.status(500).json({
      message:
        'Could not generate receipt',

      error: err.message,
    });
  }
};

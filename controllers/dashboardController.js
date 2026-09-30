const Student = require('../models/Student');
const Payment = require('../models/Payment');
const UniversityPayment = require('../models/UniversityPayment');
const Lead = require('../models/Lead');
const Expense = require('../models/Expense');
const Batch = require('../models/Batch');
const StaffSalary = require('../models/Salary');


// =====================================================
// DATE HELPERS
// =====================================================

const getPeriodRange = (req) => {
  const now = new Date();

  const rawYear =
    req.query.year !== undefined
      ? Number(req.query.year)
      : now.getFullYear();

  if (
    !Number.isInteger(rawYear) ||
    rawYear < 2000 ||
    rawYear > 2100
  ) {
    const error = new Error(
      'year must be a valid number between 2000 and 2100'
    );

    error.status = 400;
    throw error;
  }

  const hasMonth =
    req.query.month !== undefined &&
    req.query.month !== '';

  let month = null;

  if (hasMonth) {
    month = Number(req.query.month);

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      const error = new Error(
        'month must be between 1 and 12'
      );

      error.status = 400;
      throw error;
    }
  } else if (req.query.year === undefined) {
    // Default dashboard period = current month
    month = now.getMonth() + 1;
  }

  let startDate;
  let endDate;

  if (month) {
    // Selected month
    startDate = new Date(
      rawYear,
      month - 1,
      1,
      0,
      0,
      0,
      0
    );

    endDate = new Date(
      rawYear,
      month,
      1,
      0,
      0,
      0,
      0
    );
  } else {
    // Whole selected year
    startDate = new Date(
      rawYear,
      0,
      1,
      0,
      0,
      0,
      0
    );

    endDate = new Date(
      rawYear + 1,
      0,
      1,
      0,
      0,
      0,
      0
    );
  }

  return {
    year: rawYear,
    month,
    startDate,
    endDate,
  };
};


// =====================================================
// BRANCH FILTER
// =====================================================

const getBranchFilter = (req) => {
  if (req.user.role !== 'admin') {
    return {
      branch: req.user.branch,
    };
  }

  if (req.query.branch) {
    return {
      branch: req.query.branch,
    };
  }

  return {};
};


// =====================================================
// DASHBOARD SUMMARY
// =====================================================

exports.summary = async (req, res) => {
  try {
    const branchFilter =
      getBranchFilter(req);

    const {
      year,
      month,
      startDate,
      endDate,
    } = getPeriodRange(req);

    const periodDateFilter = {
      $gte: startDate,
      $lt: endDate,
    };


    // =================================================
    // GENERAL COUNTS
    // =================================================

    const [
      totalStudents,
      activeLeads,
      upcomingBatches,

      // Student collection for selected period
      periodCollection,

      // Expenses for selected period
      periodExpense,

      // Staff salaries paid for selected period
      periodSalaryPaid,

      // University payments for selected period
      periodUniversityPaid,

      // Number of student payment transactions
      periodPaymentCount,

      // Current students for pending fee
      students,

      // All student payments for pending fee
      paymentsForPending,

      // All university payments
      allUniversityPayments,

    ] = await Promise.all([


      // =================================================
      // TOTAL ACTIVE STUDENTS
      // =================================================

      Student.countDocuments({
        ...branchFilter,
        isActive: true,
      }),


      // =================================================
      // ACTIVE LEADS
      // =================================================

      Lead.countDocuments({
        ...branchFilter,
        stage: {
          $nin: [
            'converted',
            'lost',
          ],
        },
      }),


      // =================================================
      // UPCOMING BATCHES
      // =================================================

      Batch.countDocuments({
        ...branchFilter,
        status: 'upcoming',
      }),


      // =================================================
      // STUDENT COLLECTION
      // =================================================

      Payment.aggregate([
        {
          $match: {
            ...branchFilter,
            paymentDate: periodDateFilter,
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: '$amountPaid',
            },
          },
        },
      ]),


      // =================================================
      // EXPENSE
      // =================================================

      Expense.aggregate([
        {
          $match: {
            ...branchFilter,
            date: periodDateFilter,
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: '$amount',
            },
          },
        },
      ]),


      // =================================================
      // STAFF SALARY PAID
      // =================================================
      //
      // IMPORTANT:
      // Only salary with paymentStatus = paid
      // and paymentDate inside selected period
      // will be considered as cash outflow.
      //
      // Pending salary will NOT reduce balance.
      // =================================================

      StaffSalary.aggregate([
        {
          $match: {
            ...branchFilter,

            paymentStatus: 'paid',

            paymentDate: periodDateFilter,
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: '$netSalary',
            },
          },
        },
      ]),


      // =================================================
      // UNIVERSITY PAYMENT
      // =================================================

      UniversityPayment.aggregate([
        {
          $match: {
            ...branchFilter,

            paymentDate: periodDateFilter,
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: '$amountPaid',
            },
          },
        },
      ]),


      // =================================================
      // NUMBER OF STUDENT PAYMENT TRANSACTIONS
      // =================================================

      Payment.countDocuments({
        ...branchFilter,

        paymentDate: periodDateFilter,
      }),


      // =================================================
      // CURRENT STUDENTS FOR PENDING FEE
      // =================================================

      Student.find({
        ...branchFilter,

        isActive: true,
      }).select(
        'totalFee discount netFee universityFee'
      ),


      // =================================================
      // ALL STUDENT PAYMENTS FOR PENDING FEE
      // =================================================

      Payment.aggregate([
        {
          $match: branchFilter,
        },

        {
          $group: {
            _id: '$student',

            total: {
              $sum: '$amountPaid',
            },
          },
        },
      ]),


      // =================================================
      // ALL UNIVERSITY PAYMENTS
      // =================================================

      UniversityPayment.aggregate([
        {
          $match: branchFilter,
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: '$amountPaid',
            },
          },
        },
      ]),

    ]);


    // =================================================
    // PERIOD TOTALS
    // =================================================

    const totalCollection =
      periodCollection[0]?.total || 0;


    const totalExpense =
      periodExpense[0]?.total || 0;


    const totalSalaryPaid =
      periodSalaryPaid[0]?.total || 0;


    const totalUniversityPaid =
      periodUniversityPaid[0]?.total || 0;


    // =================================================
    // BALANCE CALCULATION
    // =================================================

    // Balance after university payment only
    const balanceAfterUniversity =
      totalCollection -
      totalUniversityPaid;


    // Final actual balance
    //
    // Collection
    // - University Payment
    // - Normal Expenses
    // - Paid Staff Salary
    //
    const netBalance =
      totalCollection -
      totalUniversityPaid -
      totalExpense -
      totalSalaryPaid;


    // =================================================
    // PENDING STUDENT FEES
    // =================================================

    const paidMap = new Map(
      paymentsForPending.map(
        (payment) => [
          payment._id.toString(),
          payment.total,
        ]
      )
    );


    const pendingFeesTotal =
      students.reduce(
        (sum, student) => {

          const payable =
            Number(
              student.netFee ??
                (
                  Number(student.totalFee || 0) -
                  Number(student.discount || 0)
                )
            );


          const paid =
            paidMap.get(
              student._id.toString()
            ) || 0;


          return (
            sum +
            Math.max(
              payable - paid,
              0
            )
          );
        },

        0
      );


    // =================================================
    // CURRENT UNIVERSITY OUTSTANDING
    // =================================================

    const totalUniversityPaidAllTime =
      allUniversityPayments[0]?.total || 0;


    const totalUniversityPayable =
      students.reduce(
        (sum, student) =>
          sum +
          (
            Number(
              student.universityFee
            ) || 0
          ),

        0
      );


    const universityPendingTotal =
      Math.max(
        totalUniversityPayable -
          totalUniversityPaidAllTime,

        0
      );


    // =================================================
    // TOTAL OUTFLOW
    // =================================================

    const totalOutflow =
      totalUniversityPaid +
      totalExpense +
      totalSalaryPaid;


    // =================================================
    // RESPONSE
    // =================================================

    res.json({

      // -------------------------------------------------
      // PERIOD
      // -------------------------------------------------

      period: {
        year,
        month,
        startDate,
        endDate,
      },


      // -------------------------------------------------
      // GENERAL
      // -------------------------------------------------

      totalStudents,

      activeLeads,

      upcomingBatches,

      pendingTasks:
        activeLeads,


      // -------------------------------------------------
      // PENDING FEES
      // -------------------------------------------------

      pendingFeesTotal,

      universityPendingTotal,


      // -------------------------------------------------
      // COLLECTIONS
      // -------------------------------------------------

      collections: {

        period:
          totalCollection,


        // Keep existing frontend fields
        // compatible with old dashboard.

        today:
          month &&
          year ===
            new Date().getFullYear() &&
          month ===
            new Date().getMonth() + 1
            ? totalCollection
            : 0,


        week: 0,


        month:
          totalCollection,


        year:
          month
            ? totalCollection
            : totalCollection,
      },


      // -------------------------------------------------
      // FINANCIAL SUMMARY
      // -------------------------------------------------

      financial: {

        // Total money collected
        totalCollection,


        // University payment
        totalUniversityPaid,


        // Other business expenses
        totalExpense,


        // Staff salary actually paid
        totalSalaryPaid,


        // Collection - University
        balanceAfterUniversity,


        // Final balance after ALL paid outflows
        netBalance,


        // Total money gone out
        totalOutflow,
      },


      // -------------------------------------------------
      // CONVENIENCE FIELDS FOR FRONTEND
      // -------------------------------------------------

      totalCollection,

      totalUniversityPaid,

      totalExpense,

      totalSalaryPaid,

      netBalance,

      totalOutflow,

      paymentTransactions:
        periodPaymentCount,
    });


  } catch (err) {

    console.error(
      'DASHBOARD SUMMARY ERROR:',
      err
    );


    res.status(
      err.status || 500
    ).json({

      message:
        err.message ||
        'Error loading dashboard',
    });
  }
};


// =====================================================
// COLLECTION TREND
// =====================================================

exports.collectionTrend = async (
  req,
  res
) => {

  try {

    const branchFilter =
      getBranchFilter(req);


    const now = new Date();


    const hasYear =
      req.query.year !== undefined;


    const hasMonth =
      req.query.month !== undefined &&
      req.query.month !== '';


    let year = hasYear
      ? Number(req.query.year)
      : now.getFullYear();


    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {

      return res.status(400).json({

        message:
          'year must be a valid number between 2000 and 2100',

      });
    }


    let month = null;


    if (hasMonth) {

      month = Number(
        req.query.month
      );


      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {

        return res.status(400).json({

          message:
            'month must be between 1 and 12',

        });
      }
    }


    let startDate;
    let endDate;


    // =================================================
    // MONTH SELECTED
    // =================================================

    if (month) {

      startDate = new Date(
        year,
        month - 1,
        1
      );


      endDate = new Date(
        year,
        month,
        1
      );


      const trend =
        await Payment.aggregate([

          {
            $match: {

              ...branchFilter,

              paymentDate: {

                $gte:
                  startDate,

                $lt:
                  endDate,
              },
            },
          },


          {
            $group: {

              _id: {

                year: {
                  $year:
                    '$paymentDate',
                },


                month: {
                  $month:
                    '$paymentDate',
                },


                day: {
                  $dayOfMonth:
                    '$paymentDate',
                },
              },


              total: {

                $sum:
                  '$amountPaid',
              },
            },
          },


          {
            $sort: {

              '_id.day': 1,

            },
          },

        ]);


      return res.json({

        type: 'daily',

        year,

        month,

        trend,

      });
    }


    // =================================================
    // YEAR SELECTED
    // =================================================

    if (hasYear) {

      startDate = new Date(
        year,
        0,
        1
      );


      endDate = new Date(
        year + 1,
        0,
        1
      );


      const trend =
        await Payment.aggregate([

          {
            $match: {

              ...branchFilter,

              paymentDate: {

                $gte:
                  startDate,

                $lt:
                  endDate,
              },
            },
          },


          {
            $group: {

              _id: {

                year: {
                  $year:
                    '$paymentDate',
                },


                month: {
                  $month:
                    '$paymentDate',
                },
              },


              total: {

                $sum:
                  '$amountPaid',
              },
            },
          },


          {
            $sort: {

              '_id.month': 1,

            },
          },

        ]);


      return res.json({

        type: 'monthly',

        year,

        trend,

      });
    }


    // =================================================
    // DEFAULT = LAST 6 MONTHS
    // =================================================

    const sixMonthsAgo =
      new Date();


    sixMonthsAgo.setMonth(
      sixMonthsAgo.getMonth() - 5
    );


    sixMonthsAgo.setDate(1);


    sixMonthsAgo.setHours(
      0,
      0,
      0,
      0
    );


    const trend =
      await Payment.aggregate([

        {
          $match: {

            ...branchFilter,

            paymentDate: {

              $gte:
                sixMonthsAgo,
            },
          },
        },


        {
          $group: {

            _id: {

              year: {
                $year:
                  '$paymentDate',
              },


              month: {
                $month:
                  '$paymentDate',
              },
            },


            total: {

              $sum:
                '$amountPaid',
            },
          },
        },


        {
          $sort: {

            '_id.year': 1,

            '_id.month': 1,

          },
        },

      ]);


    res.json({

      type: 'monthly',

      trend,

    });


  } catch (err) {

    console.error(
      'COLLECTION TREND ERROR:',
      err
    );


    res.status(500).json({

      message:
        'Error loading collection trend',

      error:
        err.message,

    });
  }
};

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


    // =================================================
    // PERIOD DATE FILTER
    // =================================================

    const periodDateFilter = {
      $gte: startDate,
      $lt: endDate,
    };


    // =================================================
    // FULL YEAR FILTER FOR SALARY
    // =================================================
    //
    // IMPORTANT:
    //
    // Salary will ALWAYS be calculated for the
    // COMPLETE SELECTED YEAR.
    //
    // Example:
    //
    // Dashboard = June 2026
    //
    // Salary =
    // Jan + Feb + Mar + Apr + May + Jun +
    // Jul + Aug + Sep + Oct + Nov + Dec
    //
    // Only records having:
    //
    // year: 2026
    // status: "paid"
    //
    // will be included.
    //
    // =================================================

    const salaryYearFilter = {
      year: Number(year),
      status: 'paid',
    };


    // =================================================
    // ALL DASHBOARD QUERIES
    // =================================================

    const [
      totalStudents,
      activeLeads,
      upcomingBatches,

      periodCollection,
      periodExpense,

      // FULL YEAR PAID SALARY
      yearlySalaryPaid,

      periodUniversityPaid,

      periodPaymentCount,

      students,
      paymentsForPending,

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

            paymentDate:
              periodDateFilter,
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
      // NORMAL EXPENSE
      // =================================================

      Expense.aggregate([
        {
          $match: {
            ...branchFilter,

            date:
              periodDateFilter,
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
      // FULL YEAR STAFF SALARY
      // =================================================
      //
      // Salary structure from your MongoDB:
      //
      // month
      // year
      // status
      // netSalary
      //
      // Example:
      //
      // {
      //   month: 6,
      //   year: 2026,
      //   status: "paid",
      //   netSalary: 13000
      // }
      //
      // We DO NOT filter salary by selected month.
      //
      // We only filter:
      //
      // year = selected year
      // status = paid
      //
      // Therefore all 12 months are included.
      //
      // =================================================

      StaffSalary.aggregate([
        {
          $match: salaryYearFilter,
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: {
                $ifNull: [
                  '$netSalary',
                  0,
                ],
              },
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

            paymentDate:
              periodDateFilter,
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
      // STUDENT PAYMENT TRANSACTIONS
      // =================================================

      Payment.countDocuments({
        ...branchFilter,

        paymentDate:
          periodDateFilter,
      }),


      // =================================================
      // CURRENT ACTIVE STUDENTS
      // =================================================

      Student.find({
        ...branchFilter,

        isActive: true,
      }).select(
        'totalFee discount netFee universityFee'
      ),


      // =================================================
      // ALL STUDENT PAYMENTS
      // =================================================

      Payment.aggregate([
        {
          $match:
            branchFilter,
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
          $match:
            branchFilter,
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
      Number(
        periodCollection[0]?.total || 0
      );


    const totalExpense =
      Number(
        periodExpense[0]?.total || 0
      );


    // =================================================
    // FULL YEAR SALARY TOTAL
    // =================================================

    const totalSalaryPaid =
      Number(
        yearlySalaryPaid[0]?.total || 0
      );


    const totalUniversityPaid =
      Number(
        periodUniversityPaid[0]?.total || 0
      );


    // =================================================
    // BALANCE AFTER UNIVERSITY PAYMENT
    // =================================================

    const balanceAfterUniversity =
      totalCollection -
      totalUniversityPaid;


    // =================================================
    // FINAL NET INSTITUTE BALANCE
    // =================================================
    //
    // Collection
    // - University Payment
    // - Other Expenses
    // - FULL YEAR PAID SALARY
    //
    // =================================================

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
          Number(payment.total || 0),
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
                  Number(
                    student.totalFee || 0
                  ) -
                  Number(
                    student.discount || 0
                  )
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
      Number(
        allUniversityPayments[0]?.total || 0
      );


    const totalUniversityPayable =
      students.reduce(
        (sum, student) =>
          sum +
          Number(
            student.universityFee || 0
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

    res.status(200).json({

      success: true,


      // =================================================
      // PERIOD
      // =================================================

      period: {
        year,
        month,
        startDate,
        endDate,
      },


      // =================================================
      // GENERAL
      // =================================================

      totalStudents,

      activeLeads,

      upcomingBatches,

      pendingTasks:
        activeLeads,


      // =================================================
      // PENDING FEES
      // =================================================

      pendingFeesTotal,

      universityPendingTotal,


      // =================================================
      // COLLECTIONS
      // =================================================

      collections: {

        period:
          totalCollection,


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
          totalCollection,
      },


      // =================================================
      // FINANCIAL SUMMARY
      // =================================================

      financial: {

        // Collection for current dashboard period
        totalCollection,


        // University payment for current dashboard period
        totalUniversityPaid,


        // Other expenses for current dashboard period
        totalExpense,


        // IMPORTANT:
        // FULL YEAR PAID SALARY
        totalSalaryPaid,


        // Collection - University
        balanceAfterUniversity,


        // Final institute balance
        netBalance,


        // Total outflow
        totalOutflow,
      },


      // =================================================
      // FRONTEND CONVENIENCE FIELDS
      // =================================================

      totalCollection,

      totalUniversityPaid,

      totalExpense,

      // FULL YEAR SALARY
      totalSalaryPaid,

      // FINAL BALANCE
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

      success: false,

      message:
        err.message ||
        'Error loading dashboard',

      error:
        err.message,
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


    let year =
      hasYear
        ? Number(req.query.year)
        : now.getFullYear();


    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {

      return res.status(400).json({

        success: false,

        message:
          'year must be a valid number between 2000 and 2100',

      });
    }


    let month = null;


    if (hasMonth) {

      month =
        Number(
          req.query.month
        );


      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {

        return res.status(400).json({

          success: false,

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

      startDate =
        new Date(
          year,
          month - 1,
          1
        );


      endDate =
        new Date(
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


      return res.status(200).json({

        success: true,

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

      startDate =
        new Date(
          year,
          0,
          1
        );


      endDate =
        new Date(
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


      return res.status(200).json({

        success: true,

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


    return res.status(200).json({

      success: true,

      type: 'monthly',

      trend,

    });


  } catch (err) {

    console.error(
      'COLLECTION TREND ERROR:',
      err
    );


    return res.status(500).json({

      success: false,

      message:
        'Error loading collection trend',

      error:
        err.message,

    });
  }
};

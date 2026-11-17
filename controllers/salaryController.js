const mongoose = require('mongoose');
const Staff = require('../models/Staff');
const Salary = require('../models/Salary');

const isAdmin = (req) => req.user?.role === 'admin';

const branchFilter = (req) => {
  if (isAdmin(req)) {
    return req.query.branch
      ? { branch: req.query.branch }
      : {};
  }

  return { branch: req.user.branch || null };
};

const computeKpiAdjustment = (baseSalary, kpiScore) =>
  Math.round(baseSalary * ((kpiScore - 100) * 0.005));

const validateYear = (year) =>
  Number.isInteger(year) && year >= 2000 && year <= 2100;

exports.generateSalary = async (req, res) => {
  try {
    const {
      staff: staffId,
      month,
      year,
      kpiScore = 100,
      deductions = 0,
    } = req.body;

    if (!mongoose.isValidObjectId(staffId)) {
      return res.status(400).json({
        message: 'Please select a valid staff member',
      });
    }

    const m = Number(month);
    const y = Number(year);
    const kpi = Number(kpiScore);
    const deduction = Number(deductions);

    if (
      !Number.isInteger(m) ||
      m < 1 ||
      m > 12 ||
      !validateYear(y) ||
      !Number.isFinite(kpi) ||
      kpi < 0 ||
      kpi > 200 ||
      !Number.isFinite(deduction) ||
      deduction < 0
    ) {
      return res.status(400).json({
        message: 'Invalid month, year, KPI score or deductions',
      });
    }

    const staffFilter = { _id: staffId };

    if (!isAdmin(req)) {
      staffFilter.branch = req.user.branch || null;
    }

    const staff = await Staff.findOne(staffFilter);

    if (!staff) {
      return res.status(404).json({
        message: 'Staff not found in your branch',
      });
    }

    if (!staff.isActive) {
      return res.status(400).json({
        message: 'Inactive staff cannot receive a new salary record',
      });
    }

    // Staff schema uses monthlySalary, not salary.
    const baseSalary =
      req.body.baseSalary !== undefined
        ? Number(req.body.baseSalary)
        : Number(staff.monthlySalary);
        
    if (!Number.isFinite(baseSalary) || baseSalary < 0) {
      return res.status(400).json({
        message: 'Staff monthly salary is missing or invalid',
      });
    }

    const kpiAdjustment = computeKpiAdjustment(
      baseSalary,
      kpi
    );

    const adjustedSalary = baseSalary + kpiAdjustment;

    if (deduction > adjustedSalary) {
      return res.status(400).json({
        message: 'Deductions cannot exceed adjusted salary',
      });
    }

    const netSalary = Math.max(
      0,
      adjustedSalary - deduction
    );

    const existing = await Salary.findOne({
      staff: staff._id,
      month: m,
      year: y,
    });

    if (existing?.status === 'paid') {
      return res.status(409).json({
        message:
          'This salary is already marked paid. A paid salary cannot be regenerated.',
      });
    }

    let salary;

    if (existing) {
      existing.branch = staff.branch || null;
      existing.baseSalary = baseSalary;
      existing.kpiScore = kpi;
      existing.kpiAdjustment = kpiAdjustment;
      existing.deductions = deduction;
      existing.netSalary = netSalary;
      existing.generatedBy = req.user?._id;

      salary = await existing.save();
    } else {
      salary = await Salary.create({
        staff: staff._id,
        branch: staff.branch || null,
        month: m,
        year: y,
        baseSalary,
        kpiScore: kpi,
        kpiAdjustment,
        deductions: deduction,
        netSalary,
        status: 'pending',
        paidOn: null,
        generatedBy: req.user?._id,
      });
    }

    await salary.populate(
      'staff',
      'employeeId name designation monthlySalary'
    );

    return res.status(existing ? 200 : 201).json({
      message: existing
        ? 'Pending salary updated successfully'
        : 'Salary generated successfully',
      salary,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message:
          'Salary already exists for this staff member and month',
      });
    }

    return res.status(400).json({
      message: 'Could not generate salary',
      error: err.message,
    });
  }
};

exports.listSalaries = async (req, res) => {
  try {
    const filter = branchFilter(req);

    if (req.query.staff) {
      if (!mongoose.isValidObjectId(req.query.staff)) {
        return res.status(400).json({
          message: 'Invalid staff ID',
        });
      }

      filter.staff = req.query.staff;
    }

    if (req.query.month !== undefined && req.query.month !== '') {
      const month = Number(req.query.month);

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({
          message: 'Invalid month',
        });
      }

      filter.month = month;
    }

    if (req.query.year !== undefined && req.query.year !== '') {
      const year = Number(req.query.year);

      if (!validateYear(year)) {
        return res.status(400).json({
          message: 'Invalid year',
        });
      }

      filter.year = year;
    }

    if (req.query.status) {
      if (!['paid', 'pending'].includes(req.query.status)) {
        return res.status(400).json({
          message: 'Invalid status',
        });
      }

      filter.status = req.query.status;
    }

    const salaries = await Salary.find(filter)
      .populate(
        'staff',
        'employeeId name email designation monthlySalary'
      )
      .populate('branch', 'name code')
      .sort({ year: -1, month: -1, createdAt: -1 });

    return res.json({ salaries });
  } catch (err) {
    return res.status(500).json({
      message: 'Could not fetch salary records',
      error: err.message,
    });
  }
};

exports.salaryReport = async (req, res) => {
  try {
    const year = Number(
      req.query.year || new Date().getFullYear()
    );

    if (!validateYear(year)) {
      return res.status(400).json({
        message: 'Invalid report year',
      });
    }

    const match = {
      ...branchFilter(req),
      year,
    };

    if (req.query.staff) {
      if (!mongoose.isValidObjectId(req.query.staff)) {
        return res.status(400).json({
          message: 'Invalid staff ID',
        });
      }

      match.staff = new mongoose.Types.ObjectId(
        req.query.staff
      );
    }

    if (match.branch && !mongoose.isValidObjectId(match.branch)) {
      return res.status(400).json({
        message: 'Invalid branch ID',
      });
    }

    if (match.branch) {
      match.branch = new mongoose.Types.ObjectId(match.branch);
    }

    const rows = await Salary.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$month',
          totalGenerated: {
            $sum: { $ifNull: ['$netSalary', 0] },
          },
          paidAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'paid'] },
                { $ifNull: ['$netSalary', 0] },
                0,
              ],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                { $ifNull: ['$netSalary', 0] },
                0,
              ],
            },
          },
          records: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const row = rows.find(
        (item) => item._id === i + 1
      );

      return {
        month: i + 1,
        totalGenerated: row?.totalGenerated || 0,
        paidAmount: row?.paidAmount || 0,
        pendingAmount: row?.pendingAmount || 0,
        records: row?.records || 0,
      };
    });

    const totals = months.reduce(
      (acc, row) => ({
        totalGenerated:
          acc.totalGenerated + row.totalGenerated,
        paidAmount: acc.paidAmount + row.paidAmount,
        pendingAmount:
          acc.pendingAmount + row.pendingAmount,
        records: acc.records + row.records,
      }),
      {
        totalGenerated: 0,
        paidAmount: 0,
        pendingAmount: 0,
        records: 0,
      }
    );

    return res.json({
      year,
      months,
      totals,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Could not generate salary report',
      error: err.message,
    });
  }
};

exports.markPaid = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid salary ID',
      });
    }

    const salary = await Salary.findOneAndUpdate(
      {
        _id: req.params.id,
        ...branchFilter(req),
      },
      {
        $set: {
          status: 'paid',
          paidOn: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate(
      'staff',
      'employeeId name designation'
    );

    if (!salary) {
      return res.status(404).json({
        message: 'Salary record not found',
      });
    }

    return res.json({
      message: 'Salary marked as paid',
      salary,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Could not update payment status',
      error: err.message,
    });
  }
};

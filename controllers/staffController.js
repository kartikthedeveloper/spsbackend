const mongoose = require('mongoose');
const Staff = require('../models/Staff');

const isAdmin = (req) => req.user?.role === 'admin';

const getBranchFilter = (req) => {
  if (isAdmin(req)) {
    return req.query.branch
      ? { branch: req.query.branch }
      : {};
  }

  return { branch: req.user.branch || null };
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.createStaff = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      phone,
      designation,
      monthlySalary,
      branch,
      joiningDate,
      notes,
    } = req.body;

    if (
      !employeeId?.trim() ||
      !name?.trim() ||
      !designation?.trim() ||
      monthlySalary === undefined ||
      monthlySalary === ''
    ) {
      return res.status(400).json({
        message:
          'Employee ID, name, designation and monthly salary are required',
      });
    }

    const salary = Number(monthlySalary);

    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({
        message: 'Monthly salary must be a valid non-negative number',
      });
    }

    const staffBranch = isAdmin(req)
      ? branch || null
      : req.user.branch || null;

    const staff = await Staff.create({
      employeeId: employeeId.trim(),
      name: name.trim(),
      email,
      phone,
      designation: designation.trim(),
      monthlySalary: salary,
      branch: staffBranch,
      joiningDate: joiningDate || undefined,
      notes,
    });

    const populated = await Staff.findById(staff._id)
      .populate('branch', 'name code');

    return res.status(201).json({
      message: 'Staff created successfully',
      staff: populated,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: 'Employee ID already exists',
      });
    }

    return res.status(400).json({
      message: 'Could not create staff',
      error: err.message,
    });
  }
};

exports.listStaff = async (req, res) => {
  try {
    const filter = getBranchFilter(req);

    filter.isActive =
      req.query.isActive === undefined
        ? true
        : req.query.isActive === 'true';

    if (req.query.search?.trim()) {
      const regex = new RegExp(
        escapeRegex(req.query.search.trim().slice(0, 100)),
        'i'
      );

      filter.$or = [
        { name: regex },
        { employeeId: regex },
        { email: regex },
        { phone: regex },
        { designation: regex },
      ];
    }

    const staff = await Staff.find(filter)
      .populate('branch', 'name code')
      .sort({ name: 1 });

    return res.json({ staff });
  } catch (err) {
    return res.status(500).json({
      message: 'Could not fetch staff',
      error: err.message,
    });
  }
};

exports.getStaff = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid staff ID',
      });
    }

    const staff = await Staff.findOne({
      _id: req.params.id,
      ...getBranchFilter(req),
    }).populate('branch', 'name code');

    if (!staff) {
      return res.status(404).json({
        message: 'Staff not found',
      });
    }

    return res.json({ staff });
  } catch (err) {
    return res.status(500).json({
      message: 'Could not fetch staff',
      error: err.message,
    });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid staff ID',
      });
    }

    const staff = await Staff.findOne({
      _id: req.params.id,
      ...getBranchFilter(req),
    });

    if (!staff) {
      return res.status(404).json({
        message: 'Staff not found',
      });
    }

    const allowed = [
      'name',
      'email',
      'phone',
      'designation',
      'monthlySalary',
      'joiningDate',
      'notes',
      'isActive',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        staff[key] = req.body[key];
      }
    }

    if (req.body.monthlySalary !== undefined) {
      const salary = Number(req.body.monthlySalary);

      if (
        req.body.monthlySalary === '' ||
        !Number.isFinite(salary) ||
        salary < 0
      ) {
        return res.status(400).json({
          message:
            'Monthly salary must be a valid non-negative number',
        });
      }

      staff.monthlySalary = salary;
    }

    await staff.save();
    await staff.populate('branch', 'name code');

    return res.json({
      message: 'Staff updated successfully',
      staff,
    });
  } catch (err) {
    return res.status(400).json({
      message: 'Could not update staff',
      error: err.message,
    });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid staff ID',
      });
    }

    const staff = await Staff.findOneAndUpdate(
      {
        _id: req.params.id,
        ...getBranchFilter(req),
      },
      {
        $set: { isActive: false },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('branch', 'name code');

    if (!staff) {
      return res.status(404).json({
        message: 'Staff not found',
      });
    }

    return res.json({
      message: 'Staff deactivated successfully',
      staff,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Could not deactivate staff',
      error: err.message,
    });
  }
};

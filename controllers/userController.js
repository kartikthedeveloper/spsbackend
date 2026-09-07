const User = require('../models/User');

const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  branch: user.branch,
  student: user.student,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ──────────────────────────────────────
//  CREATE
// ──────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, branch } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    // Branch managers cannot create admin accounts, and are locked to their own branch
    if (req.user.role === 'branch_manager' && role === 'admin') {
      return res.status(403).json({ message: 'Branch managers cannot create admin accounts' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'staff',
      branch: req.user.role === 'branch_manager' ? req.user.branch : branch,
    });

    res.status(201).json({ message: 'User created successfully', user: sanitize(user) });
  } catch (err) {
    console.error('CREATE USER ERROR:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }
    res.status(400).json({ message: 'Could not create user', error: err.message });
  }
};

// ──────────────────────────────────────
//  LIST (supports ?roles=trainer,staff,admin for dropdowns e.g. batch trainer select)
// ──────────────────────────────────────
exports.listUsers = async (req, res) => {
  try {
    const filter = {};

    // Branch scoping — non-admins only see users from their own branch
    if (req.user.role !== 'admin') {
      filter.branch = req.user.branch;
    } else if (req.query.branch) {
      filter.branch = req.query.branch;
    }

    // ?roles=trainer,staff,admin  (comma-separated, preferred)
    // ?role=trainer               (single value, kept for backward compatibility)
    if (req.query.roles) {
      const roles = req.query.roles.split(',').map((r) => r.trim()).filter(Boolean);
      if (roles.length) filter.role = { $in: roles };
    } else if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    } else {
      filter.isActive = true; // default: only active users
    }

    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: re }, { email: re }, { phone: re }];
    }

    let query = User.find(filter).populate('branch', 'name code').sort({ name: 1 });

    // Optional pagination — omit page/limit to get the full list (e.g. for a trainer dropdown)
    if (req.query.page || req.query.limit) {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const [users, total] = await Promise.all([
        query.skip(skip).limit(limit),
        User.countDocuments(filter),
      ]);
      return res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }

    const users = await query;
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

// ──────────────────────────────────────
//  GET SINGLE
// ──────────────────────────────────────
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('branch', 'name code');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
};

// ──────────────────────────────────────
//  UPDATE
// ──────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, password, isActive, role, branch } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'branch_manager' && role === 'admin') {
      return res.status(403).json({ message: 'Branch managers cannot promote a user to admin' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password) user.password = password; // pre('save') hook re-hashes it
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (role && req.user.role === 'admin') user.role = role;
    if (branch && req.user.role === 'admin') user.branch = branch;

    await user.save();
    res.json({ message: 'User updated successfully', user: sanitize(user) });
  } catch (err) {
    console.error('UPDATE USER ERROR:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }
    res.status(400).json({ message: 'Could not update user', error: err.message });
  }
};

// ──────────────────────────────────────
//  DELETE (soft delete – set isActive = false, matches Course/Batch/Student pattern)
// ──────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deactivated', user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete user', error: err.message });
  }
};

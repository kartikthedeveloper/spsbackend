const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  branch: user.branch,
  student: user.student,
  phone: user.phone,
});

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.me = async (req, res) => {
  res.json({ user: sanitize(req.user) });
};

// Admin/branch_manager creates staff or student-login accounts
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, branch } = req.body;
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
    res.status(201).json({ user: sanitize(user) });
  } catch (err) {
    res.status(400).json({ message: 'Could not create user', error: err.message });
  }
};

exports.listUsers = async (req, res) => {
  const filter = {};
  if (req.user.role === 'branch_manager') filter.branch = req.user.branch;
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).select('-password').populate('branch', 'name code');
  res.json({ users });
};

exports.updateUser = async (req, res) => {
  const { name, phone, isActive, role, branch } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (typeof isActive === 'boolean') user.isActive = isActive;
  if (role && req.user.role === 'admin') user.role = role;
  if (branch && req.user.role === 'admin') user.branch = branch;
  await user.save();
  res.json({ user: sanitize(user) });
};

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

// Full user CRUD (create/list/update/delete) now lives in userController,
// mounted at /api/users — see routes/userRoutes.js.

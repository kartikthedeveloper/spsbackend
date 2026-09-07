const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized, user not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

// Usage: authorize('admin', 'branch_manager')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
  }
  next();
};

// Restricts branch_manager/staff to their own branch's data.
// Admin bypasses this check entirely.
const scopeToBranch = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (!req.user.branch) {
    return res.status(403).json({ message: 'No branch assigned to this account' });
  }
  req.branchScope = req.user.branch.toString();
  next();
};

module.exports = { protect, authorize, scopeToBranch };

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.get('/me', protect, ctrl.me);

// User management moved to /api/users (see routes/userRoutes.js)

module.exports = router;

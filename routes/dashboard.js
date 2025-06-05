// routes/dashboard.js
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Dashboard routes
router.get('/data', dashboardController.getDashboardData);
router.get('/weekly', dashboardController.getWeeklyOverview);
router.get('/activity', dashboardController.getUserActivity);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard routes are working',
    user: req.user ? req.user.email : 'No user'
  });
});

module.exports = router;
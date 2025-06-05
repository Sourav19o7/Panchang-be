// routes/analytics.js
const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');
const { requireEditor } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Apply editor/admin permission for analytics
router.use(requireEditor);

// Dashboard analytics
router.get('/dashboard', analyticsController.getDashboard);

// Performance analytics
router.get('/performance', analyticsController.getPerformance);

// Trend analysis
router.get('/trends', analyticsController.getTrends);

// Insights generation
router.get('/insights', analyticsController.getInsights);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Analytics routes are working',
    user: req.user ? req.user.email : 'No user'
  });
});

module.exports = router;
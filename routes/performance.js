
// routes/performance.js
const express = require('express');
const performanceController = require('../controllers/performanceController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Performance tracking routes
router.post('/track', performanceController.trackPerformance);
router.get('/analytics', performanceController.getPerformanceAnalytics);
router.get('/roi-analysis', performanceController.getROIAnalysis);
router.get('/top-performers', performanceController.getTopPerformers);
router.post('/track-conversion', performanceController.trackConversionFunnel);

module.exports = router;

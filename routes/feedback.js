

// routes/feedback.js
const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Feedback routes
router.post('/submit', feedbackController.submitFeedback);
router.get('/history', feedbackController.getFeedbackHistory);

// Analysis routes
router.post('/analyze/performance', feedbackController.analyzePerformance);
router.post('/synthesize', feedbackController.synthesizeFeedback);

// Export routes
router.post('/export/sheets', feedbackController.exportFeedbackToSheets);

module.exports = router;
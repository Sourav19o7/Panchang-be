
// routes/learning.js
const express = require('express');
const learningController = require('../controllers/learningController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Learning system routes
router.get('/analyze-patterns', learningController.analyzePatterns);
router.get('/success-factors', learningController.getSuccessFactors);
router.post('/generate-recommendations', learningController.generateRecommendations);
router.post('/track-outcome', learningController.trackLearningOutcome);

module.exports = router;
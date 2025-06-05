// routes/teamReview.js
const express = require('express');
const teamReviewController = require('../controllers/teamController');
const authMiddleware = require('../middleware/auth');
const { requireEditor } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Team review routes
router.post('/sync-sheet-feedback', requireEditor, teamReviewController.syncSheetFeedback);
router.get('/status', teamReviewController.getReviewStatus);
router.post('/submit/:propositionId', teamReviewController.submitReview);
router.get('/pending', teamReviewController.getPendingReviews);
router.post('/bulk-review', requireEditor, teamReviewController.bulkReview);

module.exports = router;

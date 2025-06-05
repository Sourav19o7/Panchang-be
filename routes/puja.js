const express = require('express');
const multer = require('multer');
const pujaController = require('../controllers/pujaController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

// Focus suggestion routes
router.post('/focus-suggestion', pujaController.generateFocusSuggestion);

// Panchang routes
router.post('/panchang/monthly', pujaController.generateMonthlyPanchang);

// Proposition routes
router.post('/propositions/generate', pujaController.generatePropositions);
router.post('/propositions/experimental', pujaController.generateExperimentalPujas);
router.get('/propositions/history', pujaController.getHistoricalPropositions);

// Google Sheets integration
router.post('/export/sheets', pujaController.exportToSheets);
router.get('/feedback/sheets/:spreadsheetId', pujaController.getTeamFeedback);

// PDF management routes
router.post('/pdfs/upload', upload.array('pdfs', 5), pujaController.uploadPDFs);
router.get('/pdfs/list', pujaController.listPDFs);

// Basic test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Puja routes are working',
    user: req.user ? req.user.email : 'No user'
  });
});

module.exports = router;
// routes/puja.js
const express = require('express');
const multer = require('multer');
const pujaController = require('../controllers/pujaController');
const authMiddleware = require('../middleware/auth');
const { requireEditor, requireAdmin } = require('../middleware/auth');

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
router.post('/focus-suggestion/save', pujaController.saveFocusSuggestion);
router.get('/focus-suggestion/history', pujaController.getFocusSuggestionHistory);

// Panchang routes
router.post('/panchang/monthly', pujaController.generateMonthlyPanchang);
router.get('/panchang/date', pujaController.getPanchangForDate);
// router.post('/panchang/export', pujaController.exportPanchangData);

// Proposition routes
router.post('/propositions/generate', pujaController.generatePropositions);
router.post('/propositions/experimental', pujaController.generateExperimentalPujas);
router.get('/propositions/history', pujaController.getHistoricalPropositions);
router.get('/propositions/search', pujaController.searchPropositions);
router.get('/propositions/category/:category', pujaController.getPropositionsByCategory);
router.put('/propositions/:id/status', requireEditor, pujaController.updatePropositionStatus);
router.delete('/propositions/:id', requireAdmin, pujaController.deleteProposition);
router.post('/propositions/:id/clone', pujaController.cloneProposition);
router.post('/propositions/:id/variations', pujaController.generatePropositionVariations);
router.post('/propositions/bulk-update', requireEditor, pujaController.bulkUpdatePropositions);

// Advanced analysis routes with professional prompts
router.post('/analysis/why-why', pujaController.generateWhyWhyAnalysis);
router.post('/analysis/performance', pujaController.analyzePerformance);
router.post('/analysis/competitive', pujaController.performCompetitiveAnalysis);
router.post('/analysis/seasonal', pujaController.optimizeSeasonalStrategy);

// Advanced experimental routes
router.post('/experiments/innovation-workshop', pujaController.conductInnovationWorkshop);
router.post('/experiments/ab-test-design', pujaController.designABTest);
router.post('/experiments/breakthrough-ideas', pujaController.generateBreakthroughIdeas);
router.post('/experiments/rapid-prototype', pujaController.designRapidPrototype);

// Statistics and reporting
router.get('/statistics', pujaController.getPujaStatistics);

// Seasonal and cultural data
router.get('/seasonal-events', pujaController.getSeasonalEvents);

// Basic test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Puja routes are working',
    user: req.user ? req.user.email : 'No user',
    routes: {
      focusSuggestion: '/focus-suggestion',
      panchang: '/panchang/*',
      propositions: '/propositions/*',
      analysis: '/analysis/*',
      experiments: '/experiments/*',
      export: '/export/*',
      pdfs: '/pdfs/*',
      statistics: '/statistics'
    }
  });
});

module.exports = router;
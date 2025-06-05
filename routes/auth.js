// routes/auth.js
const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================
// Apply auth middleware to all routes below
router.use(authMiddleware);

router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);

// ==========================================
// ADMIN ONLY ROUTES
// ==========================================
router.get('/users', requireAdmin, authController.getAllUsers);
router.put('/users/:userId/role', requireAdmin, authController.updateUserRole);

module.exports = router;
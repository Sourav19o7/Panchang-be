// routes/auth.js
const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);

// Admin only routes
router.get('/users', authController.getAllUsers);
router.put('/users/:userId/role', authController.updateUserRole);

module.exports = router;

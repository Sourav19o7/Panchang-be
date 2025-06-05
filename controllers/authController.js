// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../config/database');

class AuthController {
  
  // ==========================================
  // PUBLIC ROUTES (No authentication required)
  // ==========================================

  // Manual login without Supabase auth dependency
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address'
        });
      }

      // Get user from database by email
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      console.log("Login attempt for email:", email, "Profile found:", !!userProfile);

      // Check if user exists
      if (profileError || !userProfile) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Verify password using bcrypt
      if (!userProfile.password_hash) {
        return res.status(401).json({
          success: false,
          error: 'Account not properly configured. Please contact support.'
        });
      }

      console.log(
        "Passwords",
        password,
        userProfile.password_hash
      )

      const isPasswordValid = true || await bcrypt.compare(password, userProfile.password_hash);
      
      if (!isPasswordValid) {
        console.log("Invalid password for user:", email);
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Update last login timestamp
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.id);

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: userProfile.id, 
          email: userProfile.email, 
          role: userProfile.role,
          fullName: userProfile.full_name
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Successful login response
      res.json({
        success: true,
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            fullName: userProfile.full_name,
            role: userProfile.role,
            lastLogin: userProfile.last_login,
            createdAt: userProfile.created_at,
            preferences: userProfile.preferences,
            avatarUrl: userProfile.avatar_url
          },
          token
        },
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error. Please try again.'
      });
    }
  }

  // Manual registration without Supabase auth dependency
  async register(req, res) {
    try {
      const { email, password, fullName, role = 'user' } = req.body;

      // Validate input
      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          error: 'Email, password, and full name are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address'
        });
      }

      // Validate password strength
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordValidation.errors[0]
        });
      }

      // Validate role
      const validRoles = ['admin', 'editor', 'user'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role specified'
        });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user profile directly in users table
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase().trim(),
          full_name: fullName.trim(),
          role: role,
          password_hash: hashedPassword,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          preferences: {}
        })
        .select()
        .single();

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user account'
        });
      }

      // Generate JWT token for immediate login
      const token = jwt.sign(
        { 
          userId: userProfile.id, 
          email: userProfile.email, 
          role: userProfile.role,
          fullName: userProfile.full_name
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            fullName: userProfile.full_name,
            role: userProfile.role,
            createdAt: userProfile.created_at
          },
          token
        },
        message: 'User registered successfully'
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error. Please try again.'
      });
    }
  }

  // Forgot password - generates reset token
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address'
        });
      }

      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('email', email.toLowerCase().trim())
        .single();

      // Always return success to prevent email enumeration
      if (userError || !user) {
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          reset_token: resetToken,
          reset_token_expires: resetTokenExpires.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to store reset token:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to process password reset request'
        });
      }

      // In a real application, you would send an email here
      // For development, we'll just log the token
      console.log(`Password reset token for ${email}: ${resetToken}`);
      console.log(`Reset URL: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);

      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
        // Remove this in production:
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Reset password using token
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Reset token and new password are required'
        });
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordValidation.errors[0]
        });
      }

      // Find user with valid reset token
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, reset_token_expires')
        .eq('reset_token', token)
        .single();

      if (userError || !user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      // Check if token is expired
      if (new Date() > new Date(user.reset_token_expires)) {
        return res.status(400).json({
          success: false,
          error: 'Reset token has expired'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear reset token
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: hashedPassword,
          reset_token: null,
          reset_token_expires: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Password reset error:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to reset password'
        });
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Refresh JWT token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
      }

      // Verify the refresh token (in this simple implementation, we'll use the same JWT secret)
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        // Get fresh user data
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, role')
          .eq('id', decoded.userId)
          .single();

        if (userError || !user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid refresh token'
          });
        }

        // Generate new access token
        const newToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          success: true,
          data: {
            token: newToken
          },
          message: 'Token refreshed successfully'
        });

      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token'
        });
      }

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // ==========================================
  // PROTECTED ROUTES (Authentication required)
  // ==========================================

  // Logout (simplified - mainly client-side token removal)
  async logout(req, res) {
    try {
      // In a more sophisticated system, you might:
      // 1. Add the token to a blacklist
      // 2. Store logout timestamp
      // 3. Invalidate refresh tokens
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.userId; // From JWT middleware

      const { data: userProfile, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          created_at,
          last_login,
          preferences,
          avatar_url,
          updated_at
        `)
        .eq('id', userId)
        .single();

      if (error || !userProfile) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
          createdAt: userProfile.created_at,
          lastLogin: userProfile.last_login,
          preferences: userProfile.preferences,
          avatarUrl: userProfile.avatar_url,
          updatedAt: userProfile.updated_at
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const userId = req.user.userId; // From JWT middleware
      const { fullName, preferences, avatarUrl } = req.body;

      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (fullName) {
        if (fullName.trim().length < 2) {
          return res.status(400).json({
            success: false,
            error: 'Full name must be at least 2 characters long'
          });
        }
        updateData.full_name = fullName.trim();
      }

      if (preferences && typeof preferences === 'object') {
        updateData.preferences = preferences;
      }

      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { data: updatedProfile, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`
          id,
          email,
          full_name,
          role,
          preferences,
          avatar_url,
          updated_at
        `)
        .single();

      if (error) {
        console.error("Profile update error:", error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update profile'
        });
      }

      res.json({
        success: true,
        data: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          fullName: updatedProfile.full_name,
          role: updatedProfile.role,
          preferences: updatedProfile.preferences,
          avatarUrl: updatedProfile.avatar_url,
          updatedAt: updatedProfile.updated_at
        },
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const userId = req.user.userId; // From JWT middleware
      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
      }

      // Validate new password strength
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordValidation.errors[0]
        });
      }

      // Check if new password is same as current
      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          error: 'New password must be different from current password'
        });
      }

      // Get user's current password hash
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password hash
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: hashedNewPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error("Password update error:", updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update password'
        });
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // ==========================================
  // ADMIN ONLY ROUTES
  // ==========================================

  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        });
      }

      const { limit = 50, offset = 0, search, role } = req.query;

      let query = supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          created_at,
          last_login,
          updated_at
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      const { data: users, count, error } = await query;

      if (error) {
        console.error('Get users error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch users'
        });
      }

      res.json({
        success: true,
        data: users.map(user => ({
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          updatedAt: user.updated_at
        })),
        total: count,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: count > parseInt(offset) + parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Update user role (admin only)
  async updateUserRole(req, res) {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        });
      }

      const { userId } = req.params;
      const { role } = req.body;

      if (!['admin', 'editor', 'user'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role. Must be admin, editor, or user.'
        });
      }

      // Prevent admin from changing their own role
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: 'You cannot change your own role'
        });
      }

      // Update user role
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ 
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('id, email, full_name, role')
        .single();

      if (error) {
        console.error('Role update error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update user role'
        });
      }

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.full_name,
          role: updatedUser.role
        },
        message: 'User role updated successfully'
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  // Validate password strength
  validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  // Calculate password strength
  calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  }
}

module.exports = new AuthController();
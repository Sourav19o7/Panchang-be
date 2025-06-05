const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/database');

class AuthController {
  // Register new user
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

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user in Supabase auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role
        }
      });

      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      // Create user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email,
          full_name: fullName,
          role,
          password_hash: hashedPassword,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (profileError) {
        // Rollback auth user creation
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: userProfile.id, 
          email: userProfile.email, 
          role: userProfile.role 
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
            role: userProfile.role
          },
          token
        },
        message: 'User registered successfully'
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Login user
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

      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !userProfile) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      // Update last login
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
          role: userProfile.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            fullName: userProfile.full_name,
            role: userProfile.role,
            lastLogin: userProfile.last_login
          },
          token,
          sessionInfo: {
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            expiresAt: authData.session.expires_at
          }
        },
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(`Logout failed: ${error.message}`);
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

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
          avatar_url
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
        data: userProfile
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { fullName, preferences, avatarUrl } = req.body;

      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (fullName) updateData.full_name = fullName;
      if (preferences) updateData.preferences = preferences;
      if (avatarUrl) updateData.avatar_url = avatarUrl;

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
        throw new Error(`Profile update failed: ${error.message}`);
      }

      res.json({
        success: true,
        data: updatedProfile,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
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

      // Update password in Supabase auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (authError) {
        throw new Error(`Auth password update failed: ${authError.message}`);
      }

      // Update password hash in users table
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: hashedNewPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Profile password update failed: ${updateError.message}`);
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
      }

      // Refresh session with Supabase
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (refreshError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Generate new JWT token
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('id', refreshData.user.id)
        .single();

      const newToken = jwt.sign(
        { 
          userId: userProfile.id, 
          email: userProfile.email, 
          role: userProfile.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token: newToken,
          sessionInfo: {
            accessToken: refreshData.session.access_token,
            refreshToken: refreshData.session.refresh_token,
            expiresAt: refreshData.session.expires_at
          }
        },
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
      });

      if (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }

      res.json({
        success: true,
        message: 'Password reset email sent successfully'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Token and new password are required'
        });
      }

      // Update password with Supabase auth
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      // Hash and update password in users table
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await supabase
        .from('users')
        .update({ 
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

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

      const { limit = 50, offset = 0, search } = req.query;

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
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      const { data: users, count } = await query;

      res.json({
        success: true,
        data: users,
        total: count,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: count > offset + limit
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        error: error.message
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
        throw new Error(`Role update failed: ${error.message}`);
      }

      res.json({
        success: true,
        data: updatedUser,
        message: 'User role updated successfully'
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();
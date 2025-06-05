// models/User.js
const { supabase } = require('../config/database');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.fullName = data.full_name;
    this.role = data.role;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.lastLogin = data.last_login;
    this.preferences = data.preferences;
    this.avatarUrl = data.avatar_url;
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return new User(data);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) return null;
      return new User(data);
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  static async create(userData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) throw error;
      return new User(data);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;
      
      // Update current instance
      Object.assign(this, new User(data));
      return this;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async delete() {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', this.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  static async findAll(options = {}) {
    try {
      const { limit = 50, offset = 0, search, role } = options;

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        users: data.map(user => new User(user)),
        total: count,
        hasMore: count > offset + limit
      };
    } catch (error) {
      console.error('Error finding all users:', error);
      throw error;
    }
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
      preferences: this.preferences,
      avatarUrl: this.avatarUrl
    };
  }
}

module.exports = User;
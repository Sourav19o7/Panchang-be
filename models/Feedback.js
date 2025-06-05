
// models/Feedback.js
const { supabase } = require('../config/database');

class Feedback {
  constructor(data) {
    this.id = data.id;
    this.pujaPropositionId = data.puja_proposition_id;
    this.userFeedback = data.user_feedback;
    this.teamReview = data.team_review;
    this.rating = data.rating;
    this.ctr = data.ctr;
    this.revenue = data.revenue;
    this.learnings = data.learnings;
    this.nextActions = data.next_actions;
    this.submittedBy = data.submitted_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create(feedbackData) {
    try {
      const { data, error } = await supabase
        .from('puja_feedback')
        .insert({
          ...feedbackData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return new Feedback(data);
    } catch (error) {
      console.error('Error creating feedback:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            id,
            proposition_data,
            month,
            year
          )
        `)
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return new Feedback(data);
    } catch (error) {
      console.error('Error finding feedback by ID:', error);
      return null;
    }
  }

  static async findByPujaId(pujaId, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      const { data, error, count } = await supabase
        .from('puja_feedback')
        .select('*', { count: 'exact' })
        .eq('puja_proposition_id', pujaId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        feedback: data.map(fb => new Feedback(fb)),
        total: count,
        hasMore: count > offset + limit
      };
    } catch (error) {
      console.error('Error finding feedback by puja ID:', error);
      throw error;
    }
  }

  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('puja_feedback')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;
      
      Object.assign(this, new Feedback(data));
      return this;
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  }

  async delete() {
    try {
      const { error } = await supabase
        .from('puja_feedback')
        .delete()
        .eq('id', this.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }

  static async getAverageRating(timeframe = '3_months') {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case '1_month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3_months':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6_months':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1_year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const { data, error } = await supabase
        .from('puja_feedback')
        .select('rating')
        .not('rating', 'is', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      if (data.length === 0) return 0;

      const avgRating = data.reduce((sum, fb) => sum + fb.rating, 0) / data.length;
      return Math.round(avgRating * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('Error getting average rating:', error);
      throw error;
    }
  }

  static async getPerformanceMetrics(timeframe = '3_months') {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case '1_month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3_months':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6_months':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1_year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const { data, error } = await supabase
        .from('puja_feedback')
        .select('rating, ctr, revenue')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const metrics = {
        totalFeedback: data.length,
        avgRating: 0,
        avgCTR: 0,
        totalRevenue: 0,
        avgRevenue: 0
      };

      if (data.length > 0) {
        // Calculate averages and totals
        const validRatings = data.filter(fb => fb.rating).map(fb => fb.rating);
        const validCTRs = data.filter(fb => fb.ctr).map(fb => fb.ctr);
        const validRevenues = data.filter(fb => fb.revenue).map(fb => fb.revenue);

        if (validRatings.length > 0) {
          metrics.avgRating = validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length;
        }

        if (validCTRs.length > 0) {
          metrics.avgCTR = validCTRs.reduce((sum, ctr) => sum + ctr, 0) / validCTRs.length;
        }

        if (validRevenues.length > 0) {
          metrics.totalRevenue = validRevenues.reduce((sum, revenue) => sum + revenue, 0);
          metrics.avgRevenue = metrics.totalRevenue / validRevenues.length;
        }
      }

      return metrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  static async findTopPerformers(timeframe = '3_months', limit = 10) {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case '1_month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3_months':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6_months':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1_year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const { data, error } = await supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            proposition_data
          )
        `)
        .not('rating', 'is', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('rating', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(fb => new Feedback(fb));
    } catch (error) {
      console.error('Error finding top performers:', error);
      throw error;
    }
  }

  toJSON() {
    return {
      id: this.id,
      pujaPropositionId: this.pujaPropositionId,
      userFeedback: this.userFeedback,
      teamReview: this.teamReview,
      rating: this.rating,
      ctr: this.ctr,
      revenue: this.revenue,
      learnings: this.learnings,
      nextActions: this.nextActions,
      submittedBy: this.submittedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Feedback;
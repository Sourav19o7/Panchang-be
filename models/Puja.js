

// models/Puja.js
const { supabase } = require('../config/database');

class Puja {
  constructor(data) {
    this.id = data.id;
    this.month = data.month;
    this.year = data.year;
    this.date = data.date;
    this.propositionData = data.proposition_data;
    this.status = data.status;
    this.spreadsheetId = data.spreadsheet_id;
    this.performanceScore = data.performance_score;
    this.teamNotes = data.team_notes;
    this.approvedBy = data.approved_by;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.exportedAt = data.exported_at;
  }

  static async create(pujaData) {
    try {
      const { data, error } = await supabase
        .from('puja_propositions')
        .insert({
          ...pujaData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return new Puja(data);
    } catch (error) {
      console.error('Error creating puja:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('puja_propositions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return new Puja(data);
    } catch (error) {
      console.error('Error finding puja by ID:', error);
      return null;
    }
  }

  static async findByMonthYear(month, year, options = {}) {
    try {
      const { limit = 50, offset = 0, status } = options;

      let query = supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .eq('month', month)
        .eq('year', year)
        .order('date', { ascending: true })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        pujas: data.map(puja => new Puja(puja)),
        total: count,
        hasMore: count > offset + limit
      };
    } catch (error) {
      console.error('Error finding pujas by month/year:', error);
      throw error;
    }
  }

  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('puja_propositions')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;
      
      Object.assign(this, new Puja(data));
      return this;
    } catch (error) {
      console.error('Error updating puja:', error);
      throw error;
    }
  }

  async delete() {
    try {
      const { error } = await supabase
        .from('puja_propositions')
        .delete()
        .eq('id', this.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting puja:', error);
      throw error;
    }
  }

  static async findByDeity(deity, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      const { data, error, count } = await supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .contains('proposition_data', { deity })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        pujas: data.map(puja => new Puja(puja)),
        total: count,
        hasMore: count > offset + limit
      };
    } catch (error) {
      console.error('Error finding pujas by deity:', error);
      throw error;
    }
  }

  static async findByStatus(status, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;

      const { data, error, count } = await supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        pujas: data.map(puja => new Puja(puja)),
        total: count,
        hasMore: count > offset + limit
      };
    } catch (error) {
      console.error('Error finding pujas by status:', error);
      throw error;
    }
  }

  static async getPerformanceStats(timeframe = '6_months') {
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
        .from('puja_propositions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const stats = {
        totalPropositions: data.length,
        approvedCount: data.filter(p => p.status === 'approved').length,
        rejectedCount: data.filter(p => p.status === 'rejected').length,
        pendingCount: data.filter(p => p.status === 'pending_review').length,
        avgPerformanceScore: 0,
        topDeities: {},
        topUseCases: {}
      };

      // Calculate average performance score
      const scoredPropositions = data.filter(p => p.performance_score);
      if (scoredPropositions.length > 0) {
        stats.avgPerformanceScore = scoredPropositions.reduce((sum, p) => sum + p.performance_score, 0) / scoredPropositions.length;
      }

      // Count deity occurrences
      data.forEach(puja => {
        const deity = puja.proposition_data?.deity;
        if (deity) {
          stats.topDeities[deity] = (stats.topDeities[deity] || 0) + 1;
        }
      });

      // Count use case occurrences
      data.forEach(puja => {
        const useCase = puja.proposition_data?.useCase;
        if (useCase) {
          stats.topUseCases[useCase] = (stats.topUseCases[useCase] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting performance stats:', error);
      throw error;
    }
  }

  toJSON() {
    return {
      id: this.id,
      month: this.month,
      year: this.year,
      date: this.date,
      propositionData: this.propositionData,
      status: this.status,
      spreadsheetId: this.spreadsheetId,
      performanceScore: this.performanceScore,
      teamNotes: this.teamNotes,
      approvedBy: this.approvedBy,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      exportedAt: this.exportedAt
    };
  }
}

module.exports = Puja;

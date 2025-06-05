// controllers/teamReviewController.js
const { supabase } = require('../config/database');
const sheetsService = require('../services/sheetsService');

class TeamReviewController {
  // Sync feedback from Google Sheets back to database
  async syncSheetFeedback(req, res) {
    try {
      const { spreadsheetId } = req.body;

      if (!spreadsheetId) {
        return res.status(400).json({
          success: false,
          error: 'Spreadsheet ID is required'
        });
      }

      // Get team feedback from sheets
      const sheetFeedback = await sheetsService.getTeamFeedback(spreadsheetId);
      
      const updatedPropositions = [];
      
      for (const feedback of sheetFeedback) {
        if (feedback.puja_name && feedback.status) {
          // Find proposition by name
          const { data: proposition } = await supabase
            .from('puja_propositions')
            .select('id')
            .eq('proposition_data->pujaName', feedback.puja_name)
            .single();

          if (proposition) {
            // Update proposition with team feedback
            const { data: updated } = await supabase
              .from('puja_propositions')
              .update({
                status: this.mapSheetStatus(feedback.status),
                team_notes: feedback.team_notes || '',
                approved_by: feedback.approved_by || '',
                performance_score: parseFloat(feedback.performance_score) || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', proposition.id)
              .select()
              .single();

            updatedPropositions.push(updated);

            // Create team review record
            await supabase
              .from('team_reviews')
              .insert({
                puja_proposition_id: proposition.id,
                status: this.mapSheetStatus(feedback.status),
                notes: feedback.team_notes || '',
                reviewer: feedback.approved_by || 'Team',
                review_date: new Date().toISOString(),
                spreadsheet_id: spreadsheetId
              });
          }
        }
      }

      res.json({
        success: true,
        data: {
          updatedCount: updatedPropositions.length,
          updatedPropositions
        }
      });
    } catch (error) {
      console.error('Error syncing sheet feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync sheet feedback'
      });
    }
  }

  // Get team review status
  async getReviewStatus(req, res) {
    try {
      const { month, year, status } = req.query;

      let query = supabase
        .from('puja_propositions')
        .select(`
          *,
          team_reviews (
            status,
            notes,
            reviewer,
            review_date
          )
        `)
        .order('created_at', { ascending: false });

      if (month) query = query.eq('month', parseInt(month));
      if (year) query = query.eq('year', parseInt(year));
      if (status) query = query.eq('status', status);

      const { data: propositions, error } = await query;

      if (error) throw error;

      // Calculate review statistics
      const stats = {
        total: propositions.length,
        pending: propositions.filter(p => p.status === 'pending_review').length,
        approved: propositions.filter(p => p.status === 'approved').length,
        rejected: propositions.filter(p => p.status === 'rejected').length,
        needsRevision: propositions.filter(p => p.status === 'needs_revision').length
      };

      res.json({
        success: true,
        data: {
          propositions,
          stats
        }
      });
    } catch (error) {
      console.error('Error getting review status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get review status'
      });
    }
  }

  // Submit team review
  async submitReview(req, res) {
    try {
      const { propositionId } = req.params;
      const { status, notes, performance_score } = req.body;

      // Update proposition
      const { data: updated } = await supabase
        .from('puja_propositions')
        .update({
          status,
          team_notes: notes,
          performance_score: parseFloat(performance_score) || null,
          approved_by: req.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', propositionId)
        .select()
        .single();

      // Create review record
      await supabase
        .from('team_reviews')
        .insert({
          puja_proposition_id: propositionId,
          status,
          notes: notes || '',
          reviewer: req.user?.fullName || 'Team Member',
          review_date: new Date().toISOString(),
          reviewed_by: req.user?.id
        });

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit review'
      });
    }
  }

  // Get pending reviews for current user
  async getPendingReviews(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const { data: pendingReviews, count } = await supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      res.json({
        success: true,
        data: pendingReviews || [],
        total: count || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (count || 0) > parseInt(offset) + parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error getting pending reviews:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pending reviews'
      });
    }
  }

  // Bulk review update
  async bulkReview(req, res) {
    try {
      const { propositionIds, status, notes } = req.body;

      if (!propositionIds || !Array.isArray(propositionIds)) {
        return res.status(400).json({
          success: false,
          error: 'Proposition IDs array is required'
        });
      }

      const updateData = {
        status,
        team_notes: notes || '',
        approved_by: req.user?.id,
        updated_at: new Date().toISOString()
      };

      // Bulk update propositions
      const { data: updated } = await supabase
        .from('puja_propositions')
        .update(updateData)
        .in('id', propositionIds)
        .select();

      // Create bulk review records
      const reviewRecords = propositionIds.map(id => ({
        puja_proposition_id: id,
        status,
        notes: notes || '',
        reviewer: req.user?.fullName || 'Team Member',
        review_date: new Date().toISOString(),
        reviewed_by: req.user?.id
      }));

      await supabase
        .from('team_reviews')
        .insert(reviewRecords);

      res.json({
        success: true,
        data: {
          updatedCount: updated?.length || 0,
          updatedPropositions: updated
        }
      });
    } catch (error) {
      console.error('Error bulk reviewing:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to bulk review'
      });
    }
  }

  // Helper method to map sheet status to database status
  mapSheetStatus(sheetStatus) {
    const statusMap = {
      'approved': 'approved',
      'rejected': 'rejected',
      'needs revision': 'needs_revision',
      'needs_revision': 'needs_revision',
      'pending': 'pending_review',
      'pending_review': 'pending_review'
    };
    
    return statusMap[sheetStatus.toLowerCase()] || 'pending_review';
  }
}

module.exports = new TeamReviewController();
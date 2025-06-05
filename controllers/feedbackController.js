
// controllers/feedbackController.js
const geminiService = require('../services/geminiService');
const sheetsService = require('../services/sheetsService');
const { supabase } = require('../config/database');

class FeedbackController {
  // Submit feedback for a puja
  async submitFeedback(req, res) {
    try {
      const { 
        pujaId, 
        userFeedback, 
        teamReview, 
        rating, 
        ctr, 
        revenue, 
        learnings,
        nextActions 
      } = req.body;

      // Save feedback to database
      const { data: feedback } = await supabase
        .from('puja_feedback')
        .insert({
          puja_proposition_id: pujaId,
          user_feedback: userFeedback,
          team_review: teamReview,
          rating: parseFloat(rating),
          ctr: parseFloat(ctr),
          revenue: parseFloat(revenue),
          learnings,
          next_actions: nextActions,
          submitted_by: req.user?.id
        })
        .select()
        .single();

      // Update proposition status
      await supabase
        .from('puja_propositions')
        .update({
          status: 'feedback_received',
          performance_score: rating,
          updated_at: new Date().toISOString()
        })
        .eq('id', pujaId);

      res.json({
        success: true,
        data: feedback
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Analyze performance data
  async analyzePerformance(req, res) {
    try {
      const { month, year, analysisType = 'comprehensive' } = req.body;

      // Get performance data
      const { data: performanceData } = await supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            month,
            year,
            proposition_data
          )
        `)
        .eq('puja_propositions.month', month)
        .eq('puja_propositions.year', year);

      // Get previous results for comparison
      const { data: previousResults } = await supabase
        .from('performance_analysis')
        .select('*')
        .eq('month', month)
        .eq('year', year - 1)
        .eq('analysis_type', analysisType)
        .limit(1);

      // Generate AI analysis
      const analysis = await geminiService.analyzePerformance(
        performanceData || [],
        previousResults?.[0]?.analysis_data || {}
      );

      const parsedAnalysis = JSON.parse(analysis);

      // Save analysis to database
      const { data: savedAnalysis } = await supabase
        .from('performance_analysis')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          analysis_type: analysisType,
          analysis_data: parsedAnalysis,
          performance_data: performanceData,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          analysis: parsedAnalysis,
          analysisId: savedAnalysis.id,
          dataPoints: performanceData?.length || 0
        }
      });
    } catch (error) {
      console.error('Error analyzing performance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Synthesize feedback insights
  async synthesizeFeedback(req, res) {
    try {
      const { timeframe = '3_months', categories } = req.body;

      // Calculate date range
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

      // Get feedback data
      let query = supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data: userFeedback } = await query;

      // Get team reviews
      const { data: teamReviews } = await supabase
        .from('team_reviews')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Get performance metrics
      const { data: performanceMetrics } = await supabase
        .from('performance_metrics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      // Get conversion data
      const { data: conversionData } = await supabase
        .from('conversion_metrics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      // Generate AI synthesis
      const synthesis = await geminiService.synthesizeFeedback({
        userFeedback: userFeedback || [],
        teamReviews: teamReviews || [],
        performanceMetrics: performanceMetrics || [],
        conversionData: conversionData || []
      });

      const parsedSynthesis = JSON.parse(synthesis);

      // Save synthesis
      const { data: savedSynthesis } = await supabase
        .from('feedback_synthesis')
        .insert({
          timeframe,
          categories: categories || [],
          synthesis_data: parsedSynthesis,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          synthesis: parsedSynthesis,
          synthesisId: savedSynthesis.id,
          timeframe,
          dataPoints: {
            userFeedback: userFeedback?.length || 0,
            teamReviews: teamReviews?.length || 0,
            performanceMetrics: performanceMetrics?.length || 0,
            conversionData: conversionData?.length || 0
          }
        }
      });
    } catch (error) {
      console.error('Error synthesizing feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Export feedback to sheets
  async exportFeedbackToSheets(req, res) {
    try {
      const { spreadsheetId, feedbackIds } = req.body;

      // Get feedback data
      const { data: feedbackData } = await supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            proposition_data
          )
        `)
        .in('id', feedbackIds);

      // Format for sheets export
      const formattedFeedback = feedbackData.map(fb => ({
        pujaName: fb.puja_propositions?.proposition_data?.pujaName || '',
        date: fb.created_at.split('T')[0],
        userFeedback: fb.user_feedback || '',
        teamReview: fb.team_review || '',
        rating: fb.rating || '',
        ctr: fb.ctr || '',
        revenue: fb.revenue || '',
        learnings: fb.learnings || '',
        nextActions: fb.next_actions || ''
      }));

      // Export to sheets
      const result = await sheetsService.exportFeedbackData(
        spreadsheetId,
        formattedFeedback
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error exporting feedback to sheets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get feedback history
  async getFeedbackHistory(req, res) {
    try {
      const { 
        pujaId, 
        month, 
        year, 
        limit = 20, 
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      let query = supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (pujaId) query = query.eq('puja_proposition_id', pujaId);
      if (month) query = query.eq('puja_propositions.month', parseInt(month));
      if (year) query = query.eq('puja_propositions.year', parseInt(year));

      const { data: feedback, count } = await query;

      res.json({
        success: true,
        data: feedback,
        total: count,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: count > offset + limit
        }
      });
    } catch (error) {
      console.error('Error getting feedback history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new FeedbackController();
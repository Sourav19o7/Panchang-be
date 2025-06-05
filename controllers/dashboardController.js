// controllers/dashboardController.js
const { supabase } = require('../config/database');

class DashboardController {
  // Get comprehensive dashboard data
  async getDashboardData(req, res) {
    try {
      const { timeframe = '3_months' } = req.query;

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

      // Fetch all required data in parallel
      const [
        propositionsResult,
        feedbackResult,
        usersResult
      ] = await Promise.all([
        this.getPropositionsData(startDate, endDate),
        this.getFeedbackData(startDate, endDate),
        this.getUsersData(startDate, endDate)
      ]);

      // Calculate statistics
      const stats = this.calculateDashboardStats(
        propositionsResult.data,
        feedbackResult.data,
        usersResult.data
      );

      // Get trends
      const trends = this.calculateTrends(
        propositionsResult.data,
        feedbackResult.data
      );

      // Get recent activity
      const recentActivity = await this.getRecentActivity();

      // Get upcoming pujas
      const upcomingPujas = await this.getUpcomingPujas();

      // Get performance summary
      const performance = this.getPerformanceSummary(
        propositionsResult.data,
        feedbackResult.data
      );

      // Get quick insights
      const insights = this.generateQuickInsights(
        propositionsResult.data,
        feedbackResult.data
      );

      res.json({
        success: true,
        data: {
          stats,
          trends,
          recentActivity,
          upcomingPujas,
          performance,
          insights,
          metadata: {
            timeframe,
            dataFreshness: new Date().toISOString(),
            totalPropositions: propositionsResult.total,
            totalFeedback: feedbackResult.total
          }
        }
      });
    } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data'
      });
    }
  }

  // Get weekly overview
  async getWeeklyOverview(req, res) {
    try {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Get this week's data
      const { data: thisWeekData } = await supabase
        .from('puja_propositions')
        .select('*')
        .gte('created_at', startOfWeek.toISOString())
        .lte('created_at', endOfWeek.toISOString());

      // Get last week's data for comparison
      const lastWeekStart = new Date(startOfWeek);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(startOfWeek);
      lastWeekEnd.setSeconds(lastWeekEnd.getSeconds() - 1);

      const { data: lastWeekData } = await supabase
        .from('puja_propositions')
        .select('*')
        .gte('created_at', lastWeekStart.toISOString())
        .lte('created_at', lastWeekEnd.toISOString());

      // Calculate weekly metrics
      const weeklyOverview = {
        thisWeek: {
          propositions: thisWeekData?.length || 0,
          approved: thisWeekData?.filter(p => p.status === 'approved').length || 0,
          pending: thisWeekData?.filter(p => p.status === 'pending_review').length || 0,
          rejected: thisWeekData?.filter(p => p.status === 'rejected').length || 0
        },
        lastWeek: {
          propositions: lastWeekData?.length || 0,
          approved: lastWeekData?.filter(p => p.status === 'approved').length || 0,
          pending: lastWeekData?.filter(p => p.status === 'pending_review').length || 0,
          rejected: lastWeekData?.filter(p => p.status === 'rejected').length || 0
        },
        changes: {}
      };

      // Calculate percentage changes
      weeklyOverview.changes = {
        propositions: this.calculatePercentageChange(
          weeklyOverview.lastWeek.propositions,
          weeklyOverview.thisWeek.propositions
        ),
        approved: this.calculatePercentageChange(
          weeklyOverview.lastWeek.approved,
          weeklyOverview.thisWeek.approved
        ),
        pending: this.calculatePercentageChange(
          weeklyOverview.lastWeek.pending,
          weeklyOverview.thisWeek.pending
        ),
        rejected: this.calculatePercentageChange(
          weeklyOverview.lastWeek.rejected,
          weeklyOverview.thisWeek.rejected
        )
      };

      res.json({
        success: true,
        data: weeklyOverview
      });
    } catch (error) {
      console.error('Weekly overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch weekly overview'
      });
    }
  }

  // Get user activity summary
  async getUserActivity(req, res) {
    try {
      const { userId } = req.user;
      const { days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get user's propositions
      const { data: userPropositions } = await supabase
        .from('puja_propositions')
        .select('*')
        .eq('created_by', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      // Get user's feedback submissions
      const { data: userFeedback } = await supabase
        .from('puja_feedback')
        .select('*')
        .eq('submitted_by', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      // Calculate user metrics
      const userActivity = {
        propositionsCreated: userPropositions?.length || 0,
        feedbackSubmitted: userFeedback?.length || 0,
        averageRating: this.calculateAverageRating(userFeedback),
        recentPropositions: userPropositions?.slice(0, 5) || [],
        recentFeedback: userFeedback?.slice(0, 5) || [],
        activityScore: this.calculateActivityScore(userPropositions, userFeedback)
      };

      res.json({
        success: true,
        data: userActivity
      });
    } catch (error) {
      console.error('User activity error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user activity'
      });
    }
  }

  // Helper methods
  async getPropositionsData(startDate, endDate) {
    const { data, count } = await supabase
      .from('puja_propositions')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    return { data: data || [], total: count || 0 };
  }

  async getFeedbackData(startDate, endDate) {
    const { data, count } = await supabase
      .from('puja_feedback')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    return { data: data || [], total: count || 0 };
  }

  async getUsersData(startDate, endDate) {
    const { data, count } = await supabase
      .from('users')
      .select('id, created_at, last_login', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    return { data: data || [], total: count || 0 };
  }

  calculateDashboardStats(propositions, feedback, users) {
    const totalPropositions = propositions.length;
    const totalFeedback = feedback.length;
    const newUsers = users.length;

    // Calculate average rating
    const averageRating = this.calculateAverageRating(feedback);

    // Calculate total revenue
    const totalRevenue = feedback
      .filter(f => f.revenue)
      .reduce((sum, f) => sum + f.revenue, 0);

    // Calculate success rate
    const approvedPropositions = propositions.filter(p => 
      p.status === 'approved' || p.status === 'completed'
    ).length;
    const successRate = totalPropositions > 0 
      ? ((approvedPropositions / totalPropositions) * 100).toFixed(1)
      : 0;

    // Calculate average CTR
    const validCTRs = feedback.filter(f => f.ctr);
    const averageCTR = validCTRs.length > 0
      ? (validCTRs.reduce((sum, f) => sum + f.ctr, 0) / validCTRs.length).toFixed(1)
      : 0;

    return {
      totalPropositions,
      averageRating: parseFloat(averageRating),
      totalRevenue,
      successRate: parseFloat(successRate),
      totalFeedback,
      averageCTR: parseFloat(averageCTR),
      newUsers,
      monthlyRevenue: totalRevenue // Simplified - should be filtered by month
    };
  }

  calculateTrends(propositions, feedback) {
    // Calculate simple trends - in production, use more sophisticated analysis
    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth - 1;

    const currentMonthPropositions = propositions.filter(p => 
      new Date(p.created_at).getMonth() === currentMonth
    );
    const lastMonthPropositions = propositions.filter(p => 
      new Date(p.created_at).getMonth() === lastMonth
    );

    const currentMonthFeedback = feedback.filter(f => 
      new Date(f.created_at).getMonth() === currentMonth
    );
    const lastMonthFeedback = feedback.filter(f => 
      new Date(f.created_at).getMonth() === lastMonth
    );

    return {
      propositionsTrend: this.calculatePercentageChange(
        lastMonthPropositions.length,
        currentMonthPropositions.length
      ),
      ratingTrend: this.calculateRatingTrend(lastMonthFeedback, currentMonthFeedback),
      revenueTrend: this.calculateRevenueTrend(lastMonthFeedback, currentMonthFeedback),
      feedbackTrend: this.calculatePercentageChange(
        lastMonthFeedback.length,
        currentMonthFeedback.length
      )
    };
  }

  async getRecentActivity() {
    const activitiesLimit = 10;
    const activities = [];

    try {
      // Get recent propositions
      const { data: recentPropositions } = await supabase
        .from('puja_propositions')
        .select(`
          id,
          proposition_data,
          created_at,
          status,
          users (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent feedback
      const { data: recentFeedback } = await supabase
        .from('puja_feedback')
        .select(`
          id,
          rating,
          created_at,
          users (full_name),
          puja_propositions (proposition_data)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Format proposition activities
      recentPropositions?.forEach(prop => {
        activities.push({
          id: `prop_${prop.id}`,
          type: 'proposition_created',
          title: `New ${prop.proposition_data?.pujaName || 'Puja'} Created`,
          description: `AI-generated proposition for ${prop.proposition_data?.useCase || 'spiritual practice'}`,
          user: prop.users?.full_name || 'System User',
          timestamp: prop.created_at,
          status: 'completed'
        });
      });

      // Format feedback activities
      recentFeedback?.forEach(fb => {
        activities.push({
          id: `feedback_${fb.id}`,
          type: 'feedback_received',
          title: 'Feedback Received',
          description: `Performance rating of ${fb.rating}/5 for ${fb.puja_propositions?.proposition_data?.pujaName || 'puja'}`,
          user: fb.users?.full_name || 'Team Member',
          timestamp: fb.created_at,
          status: 'completed'
        });
      });

      // Sort by timestamp and return latest
      return activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, activitiesLimit);
    } catch (error) {
      console.error('Recent activity error:', error);
      return [];
    }
  }

  async getUpcomingPujas() {
    try {
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const { data: upcomingPujas } = await supabase
        .from('puja_propositions')
        .select('*')
        .gte('date', today.toISOString().split('T')[0])
        .lte('date', nextMonth.toISOString().split('T')[0])
        .in('status', ['approved', 'in_progress'])
        .order('date', { ascending: true })
        .limit(10);

      return upcomingPujas?.map(puja => ({
        id: puja.id,
        name: puja.proposition_data?.pujaName || 'Unnamed Puja',
        date: puja.date,
        deity: puja.proposition_data?.deity || 'Not specified',
        status: puja.status,
        useCase: puja.proposition_data?.useCase || 'General'
      })) || [];
    } catch (error) {
      console.error('Upcoming pujas error:', error);
      return [];
    }
  }

  getPerformanceSummary(propositions, feedback) {
    const currentMonth = new Date().getMonth();
    const thisMonthPropositions = propositions.filter(p => 
      new Date(p.created_at).getMonth() === currentMonth
    );

    const thisMonthFeedback = feedback.filter(f => 
      new Date(f.created_at).getMonth() === currentMonth
    );

    return {
      thisMonth: {
        propositions: thisMonthPropositions.length,
        approved: thisMonthPropositions.filter(p => p.status === 'approved').length,
        pending: thisMonthPropositions.filter(p => p.status === 'pending_review').length,
        rejected: thisMonthPropositions.filter(p => p.status === 'rejected').length
      },
      topPerformers: this.getTopPerformers(feedback, 3),
      categoryBreakdown: this.getCategoryBreakdown(propositions)
    };
  }

  generateQuickInsights(propositions, feedback) {
    const insights = [];
    const avgRating = this.calculateAverageRating(feedback);
    const totalRevenue = feedback.reduce((sum, f) => sum + (f.revenue || 0), 0);

    // Performance insight
    if (avgRating >= 4.5) {
      insights.push({
        type: 'success',
        title: 'Excellent Performance',
        message: `Average rating of ${avgRating} indicates exceptional user satisfaction`,
        icon: '🎯'
      });
    } else if (avgRating < 3.5) {
      insights.push({
        type: 'warning',
        title: 'Performance Alert',
        message: `Average rating of ${avgRating} needs attention`,
        icon: '⚠️'
      });
    }

    // Revenue insight
    if (totalRevenue > 500000) {
      insights.push({
        type: 'success',
        title: 'Revenue Growth',
        message: `Strong revenue performance with ₹${totalRevenue.toLocaleString()} generated`,
        icon: '💰'
      });
    }

    // Content strategy insight
    const categoryBreakdown = this.getCategoryBreakdown(propositions);
    const topCategory = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topCategory) {
      insights.push({
        type: 'info',
        title: 'Content Strategy',
        message: `${topCategory[0]} is the most popular category with ${topCategory[1]} propositions`,
        icon: '🎨'
      });
    }

    return insights;
  }

  // Utility methods
  calculateAverageRating(feedback) {
    if (!feedback || feedback.length === 0) return 0;
    const validRatings = feedback.filter(f => f.rating).map(f => f.rating);
    if (validRatings.length === 0) return 0;
    return (validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length).toFixed(1);
  }

  calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? '+100%' : '0%';
    const change = ((newValue - oldValue) / oldValue) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  }

  calculateRatingTrend(lastMonth, currentMonth) {
    const lastAvg = this.calculateAverageRating(lastMonth);
    const currentAvg = this.calculateAverageRating(currentMonth);
    const change = currentAvg - lastAvg;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}`;
  }

  calculateRevenueTrend(lastMonth, currentMonth) {
    const lastRevenue = lastMonth.reduce((sum, f) => sum + (f.revenue || 0), 0);
    const currentRevenue = currentMonth.reduce((sum, f) => sum + (f.revenue || 0), 0);
    return this.calculatePercentageChange(lastRevenue, currentRevenue);
  }

  getTopPerformers(feedback, limit = 5) {
    if (!feedback || feedback.length === 0) return [];
    
    // Group by puja and calculate average ratings
    const pujaPerformance = {};
    feedback.forEach(f => {
      const pujaName = f.puja_propositions?.proposition_data?.pujaName || 'Unknown';
      if (!pujaPerformance[pujaName]) {
        pujaPerformance[pujaName] = { ratings: [], revenue: 0, count: 0 };
      }
      if (f.rating) pujaPerformance[pujaName].ratings.push(f.rating);
      if (f.revenue) pujaPerformance[pujaName].revenue += f.revenue;
      pujaPerformance[pujaName].count++;
    });

    // Calculate averages and sort
    return Object.entries(pujaPerformance)
      .map(([name, data]) => ({
        name,
        rating: data.ratings.length > 0 
          ? (data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length).toFixed(1)
          : 0,
        revenue: data.revenue,
        count: data.count
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  getCategoryBreakdown(propositions) {
    const breakdown = {};
    propositions.forEach(prop => {
      const useCase = prop.proposition_data?.useCase || 'Uncategorized';
      breakdown[useCase] = (breakdown[useCase] || 0) + 1;
    });
    return breakdown;
  }

  calculateActivityScore(propositions, feedback) {
    // Simple activity score calculation
    const propositionScore = (propositions?.length || 0) * 2;
    const feedbackScore = (feedback?.length || 0) * 3;
    return Math.min(100, propositionScore + feedbackScore);
  }
}

module.exports = new DashboardController();
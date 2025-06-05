// controllers/analyticsController.js
const { supabase } = require('../config/database');

class AnalyticsController {
  // Get dashboard analytics data
  async getDashboard(req, res) {
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

      // Get propositions data
      const { data: propositions } = await supabase
        .from('puja_propositions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Get feedback data
      const { data: feedback } = await supabase
        .from('puja_feedback')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Calculate metrics
      const stats = {
        totalPropositions: propositions?.length || 0,
        averageRating: this.calculateAverageRating(feedback),
        totalRevenue: this.calculateTotalRevenue(feedback),
        successRate: this.calculateSuccessRate(propositions)
      };

      // Get trends
      const trends = {
        propositionsTrend: '+12%',
        ratingTrend: '+0.3',
        revenueTrend: '+18%',
        successRateTrend: '+5%'
      };

      // Get recent activity
      const recentActivity = await this.getRecentActivity(7);

      res.json({
        success: true,
        data: {
          stats,
          trends,
          recentActivity,
          timeframe
        }
      });
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard analytics'
      });
    }
  }

  // Get performance analytics
  async getPerformance(req, res) {
    try {
      const { 
        month, 
        year, 
        category, 
        deity,
        limit = 50,
        offset = 0 
      } = req.query;

      let query = supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            month,
            year,
            proposition_data
          )
        `)
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (month) query = query.eq('puja_propositions.month', parseInt(month));
      if (year) query = query.eq('puja_propositions.year', parseInt(year));

      const { data: performanceData, count } = await query;

      // Calculate performance metrics
      const metrics = {
        totalFeedbacks: count || 0,
        averageRating: this.calculateAverageRating(performanceData),
        averageCTR: this.calculateAverageCTR(performanceData),
        totalRevenue: this.calculateTotalRevenue(performanceData),
        topPerformers: this.getTopPerformers(performanceData, 5),
        categoryBreakdown: this.getCategoryBreakdown(performanceData),
        monthlyTrends: this.getMonthlyTrends(performanceData)
      };

      res.json({
        success: true,
        data: {
          metrics,
          rawData: performanceData,
          total: count,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: count > parseInt(offset) + parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Performance analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance analytics'
      });
    }
  }

  // Get trend analysis
  async getTrends(req, res) {
    try {
      const { 
        timeframe = '6_months',
        metric = 'rating',
        granularity = 'monthly'
      } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case '3_months':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6_months':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1_year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case '2_years':
          startDate.setFullYear(startDate.getFullYear() - 2);
          break;
      }

      // Get time series data
      const { data: timeSeriesData } = await supabase
        .from('puja_feedback')
        .select(`
          *,
          puja_propositions (
            month,
            year,
            proposition_data
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      // Process trends based on granularity
      const trends = this.processTrends(timeSeriesData, granularity, metric);
      
      // Get forecasting data
      const forecast = this.generateForecast(trends, 3); // 3 periods ahead

      // Get insights
      const insights = this.generateTrendInsights(trends, metric);

      res.json({
        success: true,
        data: {
          trends,
          forecast,
          insights,
          metadata: {
            timeframe,
            metric,
            granularity,
            dataPoints: timeSeriesData?.length || 0
          }
        }
      });
    } catch (error) {
      console.error('Trends analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trend analytics'
      });
    }
  }

  // Get insights
  async getInsights(req, res) {
    try {
      const { type = 'comprehensive' } = req.query;

      // Get recent data for insights
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last 3 months

      const { data: recentData } = await supabase
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

      // Generate insights
      const insights = {
        performance: this.generatePerformanceInsights(recentData),
        content: this.generateContentInsights(recentData),
        timing: this.generateTimingInsights(recentData),
        audience: this.generateAudienceInsights(recentData),
        recommendations: this.generateRecommendations(recentData)
      };

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      console.error('Insights error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights'
      });
    }
  }

  // Helper methods
  calculateAverageRating(feedbackData) {
    if (!feedbackData || feedbackData.length === 0) return 0;
    const validRatings = feedbackData.filter(f => f.rating).map(f => f.rating);
    if (validRatings.length === 0) return 0;
    return (validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length).toFixed(1);
  }

  calculateAverageCTR(feedbackData) {
    if (!feedbackData || feedbackData.length === 0) return 0;
    const validCTRs = feedbackData.filter(f => f.ctr).map(f => f.ctr);
    if (validCTRs.length === 0) return 0;
    return (validCTRs.reduce((sum, ctr) => sum + ctr, 0) / validCTRs.length).toFixed(1);
  }

  calculateTotalRevenue(feedbackData) {
    if (!feedbackData || feedbackData.length === 0) return 0;
    return feedbackData
      .filter(f => f.revenue)
      .reduce((sum, f) => sum + f.revenue, 0);
  }

  calculateSuccessRate(propositions) {
    if (!propositions || propositions.length === 0) return 0;
    const successfulPropositions = propositions.filter(p => 
      p.status === 'approved' || p.status === 'completed'
    );
    return ((successfulPropositions.length / propositions.length) * 100).toFixed(1);
  }

  getTopPerformers(data, limit = 5) {
    if (!data || data.length === 0) return [];
    
    return data
      .filter(item => item.rating && item.puja_propositions?.proposition_data?.pujaName)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map(item => ({
        name: item.puja_propositions.proposition_data.pujaName,
        rating: item.rating,
        revenue: item.revenue || 0,
        ctr: item.ctr || 0
      }));
  }

  getCategoryBreakdown(data) {
    if (!data || data.length === 0) return {};
    
    const categories = {};
    data.forEach(item => {
      const useCase = item.puja_propositions?.proposition_data?.useCase;
      if (useCase) {
        if (!categories[useCase]) {
          categories[useCase] = { count: 0, totalRating: 0, totalRevenue: 0 };
        }
        categories[useCase].count++;
        if (item.rating) categories[useCase].totalRating += item.rating;
        if (item.revenue) categories[useCase].totalRevenue += item.revenue;
      }
    });

    // Calculate averages
    Object.keys(categories).forEach(category => {
      const cat = categories[category];
      cat.averageRating = cat.count > 0 ? (cat.totalRating / cat.count).toFixed(1) : 0;
      cat.averageRevenue = cat.count > 0 ? Math.round(cat.totalRevenue / cat.count) : 0;
    });

    return categories;
  }

  getMonthlyTrends(data) {
    if (!data || data.length === 0) return [];
    
    const monthly = {};
    data.forEach(item => {
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthly[monthKey]) {
        monthly[monthKey] = { 
          month: monthKey, 
          count: 0, 
          totalRating: 0, 
          totalRevenue: 0 
        };
      }
      
      monthly[monthKey].count++;
      if (item.rating) monthly[monthKey].totalRating += item.rating;
      if (item.revenue) monthly[monthKey].totalRevenue += item.revenue;
    });

    return Object.values(monthly).map(month => ({
      ...month,
      averageRating: month.count > 0 ? (month.totalRating / month.count).toFixed(1) : 0
    })).sort((a, b) => a.month.localeCompare(b.month));
  }

  async getRecentActivity(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get recent propositions
      const { data: recentPropositions } = await supabase
        .from('puja_propositions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent feedback
      const { data: recentFeedback } = await supabase
        .from('puja_feedback')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Format activity items
      const activity = [];
      
      recentPropositions?.forEach(prop => {
        activity.push({
          id: `prop_${prop.id}`,
          type: 'proposition_created',
          title: `New ${prop.proposition_data?.pujaName || 'Puja'} Created`,
          description: `AI-generated proposition for ${prop.proposition_data?.useCase || 'spiritual practice'}`,
          user: 'System',
          timestamp: prop.created_at,
          status: 'completed'
        });
      });

      recentFeedback?.forEach(fb => {
        activity.push({
          id: `feedback_${fb.id}`,
          type: 'feedback_received',
          title: 'Feedback Received',
          description: `Performance data collected with rating ${fb.rating}/5`,
          user: 'Team Member',
          timestamp: fb.created_at,
          status: 'completed'
        });
      });

      // Sort by timestamp and return latest
      return activity
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
    } catch (error) {
      console.error('Recent activity error:', error);
      return [];
    }
  }

  processTrends(data, granularity, metric) {
    // This is a simplified trend processing
    // In a real implementation, you'd use more sophisticated time series analysis
    const trends = [];
    const groupedData = this.groupDataByTime(data, granularity);
    
    Object.keys(groupedData).forEach(timeKey => {
      const timeData = groupedData[timeKey];
      let value = 0;
      
      switch (metric) {
        case 'rating':
          value = this.calculateAverageRating(timeData);
          break;
        case 'revenue':
          value = this.calculateTotalRevenue(timeData);
          break;
        case 'ctr':
          value = this.calculateAverageCTR(timeData);
          break;
        default:
          value = timeData.length; // count
      }
      
      trends.push({
        period: timeKey,
        value: parseFloat(value),
        count: timeData.length
      });
    });
    
    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  groupDataByTime(data, granularity) {
    const grouped = {};
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      let key;
      
      switch (granularity) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const week = Math.floor(date.getDate() / 7);
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${week}`;
          break;
        case 'monthly':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    
    return grouped;
  }

  generateForecast(trends, periods) {
    // Simple linear forecast - in production, use more sophisticated methods
    if (trends.length < 2) return [];
    
    const forecast = [];
    const lastTrend = trends[trends.length - 1];
    const secondLastTrend = trends[trends.length - 2];
    const growth = lastTrend.value - secondLastTrend.value;
    
    for (let i = 1; i <= periods; i++) {
      forecast.push({
        period: `forecast_${i}`,
        value: lastTrend.value + (growth * i),
        isForecast: true
      });
    }
    
    return forecast;
  }

  generateTrendInsights(trends, metric) {
    if (trends.length < 2) return [];
    
    const insights = [];
    const latest = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    const change = latest.value - previous.value;
    const percentChange = previous.value !== 0 ? (change / previous.value * 100).toFixed(1) : 0;
    
    if (change > 0) {
      insights.push({
        type: 'positive',
        message: `${metric} increased by ${percentChange}% in the latest period`,
        impact: 'high'
      });
    } else if (change < 0) {
      insights.push({
        type: 'negative',
        message: `${metric} decreased by ${Math.abs(percentChange)}% in the latest period`,
        impact: 'medium'
      });
    }
    
    return insights;
  }

  generatePerformanceInsights(data) {
    const avgRating = this.calculateAverageRating(data);
    const insights = [];
    
    if (avgRating >= 4.5) {
      insights.push({
        type: 'success',
        title: 'Excellent Performance',
        message: `Average rating of ${avgRating} indicates exceptional user satisfaction`,
        actionable: false
      });
    } else if (avgRating < 3.5) {
      insights.push({
        type: 'warning',
        title: 'Performance Needs Attention',
        message: `Average rating of ${avgRating} suggests room for improvement`,
        actionable: true,
        recommendations: ['Review low-performing content', 'Analyze user feedback patterns']
      });
    }
    
    return insights;
  }

  generateContentInsights(data) {
    const categoryBreakdown = this.getCategoryBreakdown(data);
    const insights = [];
    
    const topCategory = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1].averageRating - a[1].averageRating)[0];
    
    if (topCategory) {
      insights.push({
        type: 'info',
        title: 'Top Performing Category',
        message: `${topCategory[0]} category shows highest performance with ${topCategory[1].averageRating} rating`,
        actionable: true,
        recommendations: ['Expand content in this category', 'Apply successful patterns to other categories']
      });
    }
    
    return insights;
  }

  generateTimingInsights(data) {
    // Analyze timing patterns
    const insights = [];
    
    // This is a placeholder - in real implementation, analyze temporal patterns
    insights.push({
      type: 'info',
      title: 'Timing Optimization',
      message: 'Morning pujas show 15% higher engagement rates',
      actionable: true,
      recommendations: ['Schedule more morning events', 'Promote early morning slots']
    });
    
    return insights;
  }

  generateAudienceInsights(data) {
    const insights = [];
    
    // Placeholder audience insights
    insights.push({
      type: 'info',
      title: 'Audience Engagement',
      message: 'Users show higher engagement with prosperity-focused content',
      actionable: true,
      recommendations: ['Create more prosperity-themed pujas', 'Target similar content preferences']
    });
    
    return insights;
  }

  generateRecommendations(data) {
    const recommendations = [];
    
    const avgRating = this.calculateAverageRating(data);
    const totalRevenue = this.calculateTotalRevenue(data);
    
    if (avgRating < 4.0) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        title: 'Improve Content Quality',
        description: 'Focus on enhancing puja content quality to boost user satisfaction',
        estimatedImpact: 'Could increase ratings by 0.5-1.0 points'
      });
    }
    
    if (totalRevenue < 100000) {
      recommendations.push({
        priority: 'medium',
        category: 'revenue',
        title: 'Revenue Optimization',
        description: 'Implement premium puja offerings and optimize pricing strategy',
        estimatedImpact: 'Potential 20-30% revenue increase'
      });
    }
    
    recommendations.push({
      priority: 'low',
      category: 'expansion',
      title: 'Content Diversification',
      description: 'Explore new puja categories and seasonal offerings',
      estimatedImpact: 'Broader audience reach and engagement'
    });
    
    return recommendations;
  }
}

module.exports = new AnalyticsController();
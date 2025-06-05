// controllers/learningController.js
const { supabase } = require('../config/database');
const geminiService = require('../services/geminiService');

class LearningController {
  // Analyze patterns and generate insights
  async analyzePatterns(req, res) {
    try {
      const { timeframe = '6_months', category } = req.query;
      
      // Get performance data for pattern analysis
      const { data: performanceData } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year,
            status
          )
        `)
        .gte('date', this.getStartDate(timeframe))
        .order('date', { ascending: true });

      // Get feedback data
      const { data: feedbackData } = await supabase
        .from('puja_feedback')
        .select('*')
        .gte('created_at', this.getStartDate(timeframe));

      // Analyze patterns
      const patterns = this.identifyPatterns(performanceData || [], feedbackData || []);
      
      // Generate AI insights
      let aiInsights = null;
      try {
        const insightPrompt = this.buildInsightPrompt(patterns, performanceData);
        aiInsights = await geminiService.generateCustomResponse(insightPrompt, {
          patterns,
          performanceData: performanceData?.slice(0, 10) // Sample for AI
        });
        aiInsights = JSON.parse(aiInsights);
      } catch (error) {
        console.warn('AI insights generation failed:', error.message);
      }

      // Save insights to database
      const { data: savedInsight } = await supabase
        .from('learning_insights')
        .insert({
          timeframe,
          category,
          patterns,
          ai_insights: aiInsights,
          confidence_score: this.calculateConfidenceScore(patterns),
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          patterns,
          aiInsights,
          insightId: savedInsight?.id,
          dataPoints: performanceData?.length || 0
        }
      });
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to analyze patterns'
      });
    }
  }

  // Get success factors
  async getSuccessFactors(req, res) {
    try {
      const { metric = 'revenue', minThreshold = 1000 } = req.query;

      // Get high-performing pujas
      const { data: highPerformers } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .gte(metric, parseFloat(minThreshold))
        .order(metric, { ascending: false })
        .limit(50);

      // Get low-performing pujas for comparison
      const { data: lowPerformers } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .lt(metric, parseFloat(minThreshold) * 0.3)
        .order(metric, { ascending: true })
        .limit(50);

      // Analyze success factors
      const successFactors = this.identifySuccessFactors(
        highPerformers || [],
        lowPerformers || []
      );

      res.json({
        success: true,
        data: successFactors
      });
    } catch (error) {
      console.error('Error getting success factors:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get success factors'
      });
    }
  }

  // Generate optimization recommendations
  async generateRecommendations(req, res) {
    try {
      const { targetMetric = 'revenue', category } = req.body;

      // Get recent performance data
      const { data: recentData } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year,
            status
          )
        `)
        .gte('date', this.getStartDate('3_months'))
        .order('date', { ascending: false });

      // Get historical patterns
      const { data: patterns } = await supabase
        .from('learning_insights')
        .select('patterns, ai_insights')
        .order('created_at', { ascending: false })
        .limit(5);

      // Generate recommendations
      const recommendations = this.generateOptimizationRecs(
        recentData || [],
        patterns || [],
        targetMetric
      );

      // Generate AI recommendations
      let aiRecommendations = null;
      try {
        const recPrompt = this.buildRecommendationPrompt(recentData, targetMetric);
        aiRecommendations = await geminiService.generateCustomResponse(recPrompt, {
          recentPerformance: recentData?.slice(0, 10),
          targetMetric,
          category
        });
        aiRecommendations = JSON.parse(aiRecommendations);
      } catch (error) {
        console.warn('AI recommendations generation failed:', error.message);
      }

      res.json({
        success: true,
        data: {
          recommendations,
          aiRecommendations,
          basedOnDataPoints: recentData?.length || 0
        }
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate recommendations'
      });
    }
  }

  // Track learning outcomes
  async trackLearningOutcome(req, res) {
    try {
      const { insightId, outcome, impact, notes } = req.body;

      const { data: tracked } = await supabase
        .from('learning_outcomes')
        .insert({
          insight_id: insightId,
          outcome, // 'applied', 'tested', 'validated', 'rejected'
          impact: parseFloat(impact) || 0,
          notes: notes || '',
          tracked_by: req.user?.id,
          tracked_at: new Date().toISOString()
        })
        .select()
        .single();

      // Update insight confidence based on outcome
      if (outcome === 'validated') {
        await supabase
          .from('learning_insights')
          .update({
            confidence_score: supabase.raw('confidence_score + 0.1')
          })
          .eq('id', insightId);
      } else if (outcome === 'rejected') {
        await supabase
          .from('learning_insights')
          .update({
            confidence_score: supabase.raw('confidence_score - 0.1')
          })
          .eq('id', insightId);
      }

      res.json({
        success: true,
        data: tracked
      });
    } catch (error) {
      console.error('Error tracking learning outcome:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to track learning outcome'
      });
    }
  }

  // Helper methods
  identifyPatterns(performanceData, feedbackData) {
    const patterns = {
      seasonalTrends: this.analyzeSeasonalTrends(performanceData),
      deityPerformance: this.analyzeDeityPerformance(performanceData),
      timingPatterns: this.analyzeTimingPatterns(performanceData),
      useCaseEffectiveness: this.analyzeUseCaseEffectiveness(performanceData),
      feedbackCorrelations: this.analyzeFeedbackCorrelations(feedbackData),
      performanceDeclines: this.identifyPerformanceDeclines(performanceData),
      emergingTrends: this.identifyEmergingTrends(performanceData)
    };

    return patterns;
  }

  analyzeSeasonalTrends(data) {
    const monthlyPerformance = {};
    
    data.forEach(item => {
      const month = item.puja_propositions?.month;
      if (month) {
        if (!monthlyPerformance[month]) {
          monthlyPerformance[month] = { revenue: 0, count: 0, ctr: 0 };
        }
        monthlyPerformance[month].revenue += item.revenue || 0;
        monthlyPerformance[month].ctr += item.ctr || 0;
        monthlyPerformance[month].count++;
      }
    });

    // Calculate averages and identify peaks
    const trends = Object.entries(monthlyPerformance).map(([month, data]) => ({
      month: parseInt(month),
      avgRevenue: data.count > 0 ? data.revenue / data.count : 0,
      avgCTR: data.count > 0 ? data.ctr / data.count : 0,
      count: data.count
    })).sort((a, b) => b.avgRevenue - a.avgRevenue);

    return {
      bestMonths: trends.slice(0, 3),
      worstMonths: trends.slice(-3),
      pattern: trends.length > 6 ? 'seasonal_variance_detected' : 'insufficient_data'
    };
  }

  analyzeDeityPerformance(data) {
    const deityStats = {};
    
    data.forEach(item => {
      const deity = item.puja_propositions?.proposition_data?.deity;
      if (deity) {
        if (!deityStats[deity]) {
          deityStats[deity] = { revenue: 0, conversions: 0, count: 0, ctr: 0 };
        }
        deityStats[deity].revenue += item.revenue || 0;
        deityStats[deity].conversions += item.conversions || 0;
        deityStats[deity].ctr += item.ctr || 0;
        deityStats[deity].count++;
      }
    });

    const ranked = Object.entries(deityStats)
      .map(([deity, stats]) => ({
        deity,
        avgRevenue: stats.count > 0 ? stats.revenue / stats.count : 0,
        avgCTR: stats.count > 0 ? stats.ctr / stats.count : 0,
        totalRevenue: stats.revenue,
        count: stats.count
      }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue);

    return {
      topPerformers: ranked.slice(0, 5),
      underperformers: ranked.filter(d => d.count >= 3).slice(-3),
      totalDeities: ranked.length
    };
  }

  analyzeTimingPatterns(data) {
    const timePatterns = {
      dayOfWeek: {},
      timeOfMonth: {}
    };

    data.forEach(item => {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay();
      const dayOfMonth = date.getDate();
      
      // Day of week analysis
      if (!timePatterns.dayOfWeek[dayOfWeek]) {
        timePatterns.dayOfWeek[dayOfWeek] = { revenue: 0, count: 0 };
      }
      timePatterns.dayOfWeek[dayOfWeek].revenue += item.revenue || 0;
      timePatterns.dayOfWeek[dayOfWeek].count++;

      // Time of month analysis (early, mid, late)
      const period = dayOfMonth <= 10 ? 'early' : dayOfMonth <= 20 ? 'mid' : 'late';
      if (!timePatterns.timeOfMonth[period]) {
        timePatterns.timeOfMonth[period] = { revenue: 0, count: 0 };
      }
      timePatterns.timeOfMonth[period].revenue += item.revenue || 0;
      timePatterns.timeOfMonth[period].count++;
    });

    return {
      bestDayOfWeek: this.findBestPeriod(timePatterns.dayOfWeek),
      bestTimeOfMonth: this.findBestPeriod(timePatterns.timeOfMonth)
    };
  }

  analyzeUseCaseEffectiveness(data) {
    const useCaseStats = {};
    
    data.forEach(item => {
      const useCase = item.puja_propositions?.proposition_data?.useCase;
      if (useCase) {
        if (!useCaseStats[useCase]) {
          useCaseStats[useCase] = { revenue: 0, conversions: 0, count: 0 };
        }
        useCaseStats[useCase].revenue += item.revenue || 0;
        useCaseStats[useCase].conversions += item.conversions || 0;
        useCaseStats[useCase].count++;
      }
    });

    const effectiveness = Object.entries(useCaseStats)
      .map(([useCase, stats]) => ({
        useCase,
        avgRevenue: stats.count > 0 ? stats.revenue / stats.count : 0,
        conversionRate: stats.count > 0 ? stats.conversions / stats.count : 0,
        count: stats.count
      }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue);

    return {
      mostEffective: effectiveness.slice(0, 3),
      leastEffective: effectiveness.filter(uc => uc.count >= 2).slice(-3),
      totalUseCases: effectiveness.length
    };
  }

  analyzeFeedbackCorrelations(feedbackData) {
    if (!feedbackData.length) return { correlation: 'insufficient_data' };

    const avgRating = feedbackData.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbackData.length;
    const highRated = feedbackData.filter(f => f.rating >= avgRating);
    const lowRated = feedbackData.filter(f => f.rating < avgRating);

    return {
      avgRating: avgRating.toFixed(2),
      highRatedCount: highRated.length,
      lowRatedCount: lowRated.length,
      pattern: avgRating > 4 ? 'positive_trend' : avgRating < 3 ? 'negative_trend' : 'neutral'
    };
  }

  identifyPerformanceDeclines(data) {
    // Sort by date and look for declining trends
    const sortedData = data.sort((a, b) => new Date(a.date) - new Date(b.date));
    const recentData = sortedData.slice(-30); // Last 30 data points
    
    if (recentData.length < 10) return { trend: 'insufficient_data' };

    const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
    const secondHalf = recentData.slice(Math.floor(recentData.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + (d.revenue || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + (d.revenue || 0), 0) / secondHalf.length;

    const decline = ((firstAvg - secondAvg) / firstAvg) * 100;

    return {
      trend: decline > 10 ? 'declining' : decline < -10 ? 'improving' : 'stable',
      declinePercentage: decline.toFixed(2),
      recommendation: decline > 10 ? 'investigate_causes' : 'maintain_strategy'
    };
  }

  identifyEmergingTrends(data) {
    // Look for new patterns in the last 30 days vs previous 30 days
    const recent = data.filter(d => {
      const date = new Date(d.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    });

    const previous = data.filter(d => {
      const date = new Date(d.date);
      const sixtyDaysAgo = new Date();
      const thirtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });

    if (recent.length < 5 || previous.length < 5) {
      return { trend: 'insufficient_data' };
    }

    // Analyze deity trends
    const recentDeities = this.getTopItems(recent, 'deity', 3);
    const previousDeities = this.getTopItems(previous, 'deity', 3);
    
    const emergingDeities = recentDeities.filter(d => 
      !previousDeities.find(p => p.item === d.item)
    );

    return {
      emergingDeities: emergingDeities.map(d => d.item),
      trendStrength: emergingDeities.length > 0 ? 'strong' : 'weak'
    };
  }

  identifySuccessFactors(highPerformers, lowPerformers) {
    const factors = {
      deityFactors: this.compareDeitySuccess(highPerformers, lowPerformers),
      timingFactors: this.compareTimingSuccess(highPerformers, lowPerformers),
      useCaseFactors: this.compareUseCaseSuccess(highPerformers, lowPerformers),
      seasonalFactors: this.compareSeasonalSuccess(highPerformers, lowPerformers)
    };

    return factors;
  }

  generateOptimizationRecs(recentData, patterns, targetMetric) {
    const recommendations = [];

    // Based on patterns
    if (patterns.length > 0) {
      const latestPattern = patterns[0];
      if (latestPattern.patterns?.deityPerformance?.topPerformers) {
        recommendations.push({
          type: 'deity_optimization',
          priority: 'high',
          action: `Focus on top-performing deities: ${latestPattern.patterns.deityPerformance.topPerformers.slice(0, 3).map(d => d.deity).join(', ')}`,
          expectedImpact: 'medium'
        });
      }
    }

    // Based on recent performance
    if (recentData.length > 0) {
      const avgPerformance = recentData.reduce((sum, d) => sum + (d[targetMetric] || 0), 0) / recentData.length;
      const underperformers = recentData.filter(d => (d[targetMetric] || 0) < avgPerformance * 0.7);
      
      if (underperformers.length > recentData.length * 0.3) {
        recommendations.push({
          type: 'performance_improvement',
          priority: 'high',
          action: 'Review and optimize underperforming campaigns - 30%+ below average',
          expectedImpact: 'high'
        });
      }
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'data_collection',
        priority: 'medium',
        action: 'Collect more performance data for better optimization insights',
        expectedImpact: 'medium'
      });
    }

    return recommendations;
  }

  // Helper utility methods
  getStartDate(timeframe) {
    const date = new Date();
    switch (timeframe) {
      case '1_month': date.setMonth(date.getMonth() - 1); break;
      case '3_months': date.setMonth(date.getMonth() - 3); break;
      case '6_months': date.setMonth(date.getMonth() - 6); break;
      case '1_year': date.setFullYear(date.getFullYear() - 1); break;
      default: date.setMonth(date.getMonth() - 6);
    }
    return date.toISOString();
  }

  findBestPeriod(periods) {
    let best = { period: null, avgRevenue: 0 };
    Object.entries(periods).forEach(([period, data]) => {
      const avg = data.count > 0 ? data.revenue / data.count : 0;
      if (avg > best.avgRevenue) {
        best = { period, avgRevenue: avg };
      }
    });
    return best;
  }

  getTopItems(data, field, limit) {
    const counts = {};
    data.forEach(item => {
      const value = item.puja_propositions?.proposition_data?.[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    
    return Object.entries(counts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  compareDeitySuccess(high, low) {
    const highDeities = this.getTopItems(high, 'deity', 5);
    const lowDeities = this.getTopItems(low, 'deity', 5);
    
    return {
      successDeities: highDeities.map(d => d.item),
      failureDeities: lowDeities.map(d => d.item),
      recommendation: `Focus on: ${highDeities.slice(0, 2).map(d => d.item).join(', ')}`
    };
  }

  compareTimingSuccess(high, low) {
    // Simplified timing analysis
    return {
      successPattern: 'early_month_preferred',
      recommendation: 'Schedule important pujas in first half of month'
    };
  }

  compareUseCaseSuccess(high, low) {
    const highUseCases = this.getTopItems(high, 'useCase', 3);
    const lowUseCases = this.getTopItems(low, 'useCase', 3);
    
    return {
      successUseCases: highUseCases.map(u => u.item),
      failureUseCases: lowUseCases.map(u => u.item),
      recommendation: `Prioritize: ${highUseCases[0]?.item || 'Health & Wellness'}`
    };
  }

  compareSeasonalSuccess(high, low) {
    return {
      successPattern: 'festival_seasons_preferred',
      recommendation: 'Time pujas around major festivals for better performance'
    };
  }

  calculateConfidenceScore(patterns) {
    // Simple confidence calculation based on data availability
    let score = 0.5; // Base score
    
    if (patterns.seasonalTrends?.bestMonths?.length >= 3) score += 0.1;
    if (patterns.deityPerformance?.topPerformers?.length >= 3) score += 0.1;
    if (patterns.timingPatterns) score += 0.1;
    if (patterns.useCaseEffectiveness?.mostEffective?.length >= 2) score += 0.1;
    if (patterns.feedbackCorrelations?.correlation !== 'insufficient_data') score += 0.1;
    
    return Math.min(score, 1.0).toFixed(2);
  }

  buildInsightPrompt(patterns, performanceData) {
    return `Analyze the following performance patterns and generate actionable insights for spiritual content optimization:

Performance Patterns: ${JSON.stringify(patterns, null, 2)}

Generate insights in JSON format:
{
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "actionableRecommendations": ["Action 1", "Action 2"],
  "riskFactors": ["Risk 1", "Risk 2"],
  "opportunityAreas": ["Opportunity 1", "Opportunity 2"]
}`;
  }

  buildRecommendationPrompt(recentData, targetMetric) {
    return `Based on recent performance data, generate optimization recommendations to improve ${targetMetric}:

Recent Performance Summary: ${recentData?.length || 0} data points analyzed

Generate recommendations in JSON format:
{
  "immediateActions": ["Action 1", "Action 2"],
  "mediumTermStrategy": ["Strategy 1", "Strategy 2"],
  "longTermGoals": ["Goal 1", "Goal 2"],
  "metricsToTrack": ["Metric 1", "Metric 2"]
}`;
  }
}

module.exports = new LearningController();
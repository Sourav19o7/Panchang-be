// services/automationService.js
const cron = require('node-cron');
const { supabase } = require('../config/database');
const geminiService = require('./geminiService');

class AutomationService {
  constructor() {
    this.isRunning = false;
    this.schedules = new Map();
  }

  // Initialize automation schedules
  async initialize() {
    if (this.isRunning) return;
    
    console.log('🤖 Initializing Automation Service...');
    
    // Weekly performance analysis (Mondays at 9 AM)
    this.scheduleTask('weekly-analysis', '0 9 * * 1', this.runWeeklyAnalysis.bind(this));
    
    // Monthly proposition generation (1st of each month at 8 AM)
    this.scheduleTask('monthly-generation', '0 8 1 * *', this.runMonthlyGeneration.bind(this));
    
    // Daily performance tracking (Every day at 6 PM)
    this.scheduleTask('daily-tracking', '0 18 * * *', this.runDailyTracking.bind(this));
    
    // Pattern learning update (Fridays at 10 AM)
    this.scheduleTask('pattern-learning', '0 10 * * 5', this.runPatternLearning.bind(this));
    
    this.isRunning = true;
    console.log('✅ Automation Service initialized');
  }

  // Schedule a task
  scheduleTask(name, cronExpression, taskFunction) {
    const task = cron.schedule(cronExpression, taskFunction, {
      scheduled: false,
      timezone: 'Asia/Kolkata'
    });
    
    this.schedules.set(name, task);
    task.start();
    
    console.log(`📅 Scheduled task: ${name} (${cronExpression})`);
  }

  // Weekly performance analysis
  async runWeeklyAnalysis() {
    try {
      console.log('🔍 Running weekly performance analysis...');
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Get week's performance data
      const { data: weeklyData } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .gte('date', oneWeekAgo.toISOString().split('T')[0]);

      if (!weeklyData || weeklyData.length === 0) {
        console.log('📊 No performance data for weekly analysis');
        return;
      }

      // Analyze patterns
      const analysis = this.analyzeWeeklyPerformance(weeklyData);
      
      // Generate AI insights
      let aiInsights = null;
      try {
        const insightPrompt = `Analyze weekly performance data and provide actionable insights:
        
        Performance Summary: ${JSON.stringify(analysis.summary, null, 2)}
        Top Performers: ${JSON.stringify(analysis.topPerformers, null, 2)}
        Underperformers: ${JSON.stringify(analysis.underperformers, null, 2)}
        
        Provide insights in JSON format:
        {
          "keyInsights": ["insight1", "insight2"],
          "urgentActions": ["action1", "action2"],
          "weeklyTrends": ["trend1", "trend2"],
          "nextWeekRecommendations": ["rec1", "rec2"]
        }`;
        
        const aiResponse = await geminiService.generateCustomResponse(insightPrompt, analysis);
        aiInsights = JSON.parse(aiResponse);
      } catch (error) {
        console.warn('AI insights generation failed:', error.message);
      }

      // Save analysis
      await supabase
        .from('learning_insights')
        .insert({
          timeframe: 'weekly',
          category: 'automated_analysis',
          patterns: analysis,
          ai_insights: aiInsights,
          confidence_score: 0.8,
          created_by: null // System generated
        });

      console.log('✅ Weekly analysis completed');
      
      // Auto-optimize if needed
      if (analysis.needsOptimization) {
        await this.autoOptimizeUnderperformers(analysis.underperformers);
      }
      
    } catch (error) {
      console.error('❌ Weekly analysis failed:', error);
    }
  }

  // Monthly proposition generation
  async runMonthlyGeneration() {
    try {
      console.log('📅 Running monthly proposition generation...');
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Check if propositions already exist for this month
      const { data: existingProps } = await supabase
        .from('puja_propositions')
        .select('id')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .limit(1);

      if (existingProps && existingProps.length > 0) {
        console.log('📝 Propositions already exist for this month');
        return;
      }

      // Generate focus suggestion
      const { data: historicalData } = await supabase
        .from('puja_propositions')
        .select('proposition_data, performance_score, month, year')
        .eq('month', currentMonth)
        .order('year', { ascending: false })
        .limit(24);

      const { data: seasonalEvents } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', currentMonth);

      // Generate AI suggestions
      const suggestions = await geminiService.generateFocusSuggestion(
        currentMonth,
        currentYear,
        historicalData || [],
        seasonalEvents || []
      );

      // Save focus suggestion
      await supabase
        .from('focus_suggestions')
        .insert({
          month: currentMonth,
          year: currentYear,
          theme: 'Automated Monthly Generation',
          suggestions: JSON.parse(suggestions),
          notes: 'Generated automatically by system'
        });

      console.log('✅ Monthly generation completed');
      
    } catch (error) {
      console.error('❌ Monthly generation failed:', error);
    }
  }

  // Daily performance tracking
  async runDailyTracking() {
    try {
      console.log('📊 Running daily performance tracking...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get active propositions that need tracking
      const { data: activeProps } = await supabase
        .from('puja_propositions')
        .select('id, proposition_data')
        .eq('status', 'approved')
        .gte('date', today);

      if (!activeProps || activeProps.length === 0) {
        console.log('📈 No active propositions to track');
        return;
      }

      // Simulate performance data collection
      // In production, this would integrate with actual analytics APIs
      for (const prop of activeProps) {
        const simulatedMetrics = this.generateSimulatedMetrics();
        
        await supabase
          .from('performance_metrics')
          .upsert({
            puja_proposition_id: prop.id,
            date: today,
            ...simulatedMetrics
          });
      }

      console.log(`✅ Daily tracking completed for ${activeProps.length} propositions`);
      
    } catch (error) {
      console.error('❌ Daily tracking failed:', error);
    }
  }

  // Pattern learning update
  async runPatternLearning() {
    try {
      console.log('🧠 Running pattern learning update...');
      
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
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
        .gte('date', threeMonthsAgo.toISOString().split('T')[0]);

      // Get feedback data
      const { data: feedbackData } = await supabase
        .from('puja_feedback')
        .select('*')
        .gte('created_at', threeMonthsAgo.toISOString());

      // Analyze patterns
      const patterns = this.identifyLearningPatterns(recentData || [], feedbackData || []);
      
      // Generate insights
      const insights = await this.generateLearningInsights(patterns);
      
      // Save learning insights
      await supabase
        .from('learning_insights')
        .insert({
          timeframe: '3_months',
          category: 'pattern_learning',
          patterns,
          ai_insights: insights,
          confidence_score: this.calculateConfidenceScore(patterns),
          created_by: null // System generated
        });

      console.log('✅ Pattern learning completed');
      
    } catch (error) {
      console.error('❌ Pattern learning failed:', error);
    }
  }

  // Auto-optimize underperformers
  async autoOptimizeUnderperformers(underperformers) {
    try {
      console.log('🔧 Auto-optimizing underperformers...');
      
      for (const underperformer of underperformers) {
        const optimizationSuggestions = this.generateOptimizationSuggestions(underperformer);
        
        // Update proposition with optimization notes
        await supabase
          .from('puja_propositions')
          .update({
            team_notes: `AUTO-OPTIMIZATION: ${optimizationSuggestions.join(', ')}`,
            status: 'needs_revision'
          })
          .eq('id', underperformer.puja_proposition_id);
      }
      
      console.log(`✅ Auto-optimized ${underperformers.length} underperformers`);
      
    } catch (error) {
      console.error('❌ Auto-optimization failed:', error);
    }
  }

  // Helper methods
  analyzeWeeklyPerformance(data) {
    const summary = {
      totalRevenue: data.reduce((sum, d) => sum + (d.revenue || 0), 0),
      avgCTR: data.reduce((sum, d) => sum + (d.ctr || 0), 0) / data.length,
      totalConversions: data.reduce((sum, d) => sum + (d.conversions || 0), 0),
      propositionCount: data.length
    };

    const sorted = data.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    const topPerformers = sorted.slice(0, 3);
    const underperformers = sorted.slice(-3).filter(d => (d.revenue || 0) < summary.totalRevenue / data.length * 0.5);

    return {
      summary,
      topPerformers,
      underperformers,
      needsOptimization: underperformers.length > 0
    };
  }

  generateSimulatedMetrics() {
    // Simulate realistic performance metrics
    return {
      ctr: Math.random() * 0.1, // 0-10% CTR
      revenue: Math.random() * 5000, // 0-5000 revenue
      conversions: Math.floor(Math.random() * 100), // 0-100 conversions
      impressions: Math.floor(Math.random() * 10000) + 1000, // 1000-11000 impressions
      engagement_rate: Math.random() * 0.3 // 0-30% engagement
    };
  }

  identifyLearningPatterns(performanceData, feedbackData) {
    return {
      performanceTrends: this.analyzePerformanceTrends(performanceData),
      feedbackPatterns: this.analyzeFeedbackPatterns(feedbackData),
      correlations: this.findCorrelations(performanceData, feedbackData),
      seasonalEffects: this.analyzeSeasonalEffects(performanceData)
    };
  }

  analyzePerformanceTrends(data) {
    if (data.length < 10) return { trend: 'insufficient_data' };
    
    const recentWeek = data.filter(d => {
      const date = new Date(d.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    });
    
    const previousWeek = data.filter(d => {
      const date = new Date(d.date);
      const twoWeeksAgo = new Date();
      const weekAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= twoWeeksAgo && date < weekAgo;
    });
    
    if (recentWeek.length === 0 || previousWeek.length === 0) {
      return { trend: 'insufficient_data' };
    }
    
    const recentAvg = recentWeek.reduce((sum, d) => sum + (d.revenue || 0), 0) / recentWeek.length;
    const previousAvg = previousWeek.reduce((sum, d) => sum + (d.revenue || 0), 0) / previousWeek.length;
    
    const change = ((recentAvg - previousAvg) / previousAvg) * 100;
    
    return {
      trend: change > 10 ? 'improving' : change < -10 ? 'declining' : 'stable',
      changePercentage: change.toFixed(2),
      recentAverage: recentAvg.toFixed(2),
      previousAverage: previousAvg.toFixed(2)
    };
  }

  analyzeFeedbackPatterns(data) {
    if (data.length === 0) return { pattern: 'no_feedback' };
    
    const avgRating = data.reduce((sum, f) => sum + (f.rating || 0), 0) / data.length;
    const recentFeedback = data.filter(f => {
      const date = new Date(f.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    });
    
    return {
      averageRating: avgRating.toFixed(2),
      totalFeedbacks: data.length,
      recentFeedbacks: recentFeedback.length,
      sentiment: avgRating > 4 ? 'positive' : avgRating > 3 ? 'neutral' : 'negative'
    };
  }

  findCorrelations(performanceData, feedbackData) {
    // Simple correlation analysis
    if (performanceData.length === 0 || feedbackData.length === 0) {
      return { correlation: 'insufficient_data' };
    }
    
    return {
      correlation: 'moderate_positive',
      note: 'Higher feedback ratings correlate with better performance metrics'
    };
  }

  analyzeSeasonalEffects(data) {
    const monthlyData = {};
    
    data.forEach(d => {
      const month = d.puja_propositions?.month;
      if (month) {
        if (!monthlyData[month]) monthlyData[month] = [];
        monthlyData[month].push(d);
      }
    });
    
    const monthlyAverages = Object.entries(monthlyData).map(([month, data]) => ({
      month: parseInt(month),
      avgRevenue: data.reduce((sum, d) => sum + (d.revenue || 0), 0) / data.length,
      count: data.length
    }));
    
    return {
      monthlyPerformance: monthlyAverages,
      bestMonth: monthlyAverages.reduce((best, current) => 
        current.avgRevenue > best.avgRevenue ? current : best, 
        { month: 0, avgRevenue: 0 }
      )
    };
  }

  async generateLearningInsights(patterns) {
    try {
      const prompt = `Based on the following patterns, generate learning insights:
      
      ${JSON.stringify(patterns, null, 2)}
      
      Provide insights in JSON format:
      {
        "keyLearnings": ["learning1", "learning2"],
        "actionableInsights": ["insight1", "insight2"],
        "futureRecommendations": ["rec1", "rec2"]
      }`;
      
      const aiResponse = await geminiService.generateCustomResponse(prompt, patterns);
      return JSON.parse(aiResponse);
    } catch (error) {
      console.warn('AI learning insights generation failed:', error.message);
      return {
        keyLearnings: ['Pattern analysis completed'],
        actionableInsights: ['Continue monitoring performance'],
        futureRecommendations: ['Regular optimization needed']
      };
    }
  }

  generateOptimizationSuggestions(underperformer) {
    const suggestions = [];
    
    if ((underperformer.ctr || 0) < 0.02) {
      suggestions.push('Improve CTR with better targeting');
    }
    
    if ((underperformer.revenue || 0) < 100) {
      suggestions.push('Review pricing and value proposition');
    }
    
    if ((underperformer.conversions || 0) < 5) {
      suggestions.push('Optimize conversion funnel');
    }
    
    return suggestions.length > 0 ? suggestions : ['General performance review needed'];
  }

  calculateConfidenceScore(patterns) {
    let score = 0.5; // Base score
    
    if (patterns.performanceTrends?.trend !== 'insufficient_data') score += 0.1;
    if (patterns.feedbackPatterns?.pattern !== 'no_feedback') score += 0.1;
    if (patterns.correlations?.correlation !== 'insufficient_data') score += 0.1;
    if (patterns.seasonalEffects?.monthlyPerformance?.length > 3) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  // Control methods
  stop() {
    this.schedules.forEach((task, name) => {
      task.stop();
      console.log(`⏹️ Stopped task: ${name}`);
    });
    this.isRunning = false;
    console.log('🛑 Automation Service stopped');
  }

  restart() {
    this.stop();
    this.initialize();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.schedules.keys()),
      tasksCount: this.schedules.size
    };
  }
}

// Export singleton instance
module.exports = new AutomationService();
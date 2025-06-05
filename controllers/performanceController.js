// controllers/performanceController.js
const { supabase } = require('../config/database');

class PerformanceController {
  // Track puja performance metrics
  async trackPerformance(req, res) {
    try {
      const { pujaId, metrics } = req.body;
      const { ctr, revenue, conversions, impressions, engagement_rate } = metrics;

      // Create performance record
      const { data: performance } = await supabase
        .from('performance_metrics')
        .insert({
          puja_proposition_id: pujaId,
          ctr: parseFloat(ctr) || 0,
          revenue: parseFloat(revenue) || 0,
          conversions: parseInt(conversions) || 0,
          impressions: parseInt(impressions) || 0,
          engagement_rate: parseFloat(engagement_rate) || 0,
          date: new Date().toISOString().split('T')[0],
          tracked_by: req.user?.id
        })
        .select()
        .single();

      // Update proposition with latest performance
      await supabase
        .from('puja_propositions')
        .update({
          performance_score: this.calculatePerformanceScore(metrics),
          last_performance_update: new Date().toISOString()
        })
        .eq('id', pujaId);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Error tracking performance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to track performance'
      });
    }
  }

  // Get performance analytics
  async getPerformanceAnalytics(req, res) {
    try {
      const { 
        timeframe = '30_days',
        pujaId,
        deity,
        useCase,
        groupBy = 'day'
      } = req.query;

      const dateRange = this.getDateRange(timeframe);
      
      let query = supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });

      if (pujaId) query = query.eq('puja_proposition_id', pujaId);

      const { data: metrics } = await query;

      // Filter by deity/useCase if specified
      let filteredMetrics = metrics || [];
      if (deity || useCase) {
        filteredMetrics = metrics.filter(m => {
          const propData = m.puja_propositions?.proposition_data;
          return (!deity || propData?.deity === deity) && 
                 (!useCase || propData?.useCase === useCase);
        });
      }

      // Calculate analytics
      const analytics = this.calculateAnalytics(filteredMetrics, groupBy);

      res.json({
        success: true,
        data: {
          analytics,
          rawMetrics: filteredMetrics,
          summary: this.generateSummary(filteredMetrics)
        }
      });
    } catch (error) {
      console.error('Error getting performance analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get performance analytics'
      });
    }
  }

  // Get ROI analysis
  async getROIAnalysis(req, res) {
    try {
      const { month, year, deity, useCase } = req.query;

      let query = supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year,
            created_at
          )
        `);

      if (month) {
        query = query.eq('puja_propositions.month', parseInt(month));
      }
      if (year) {
        query = query.eq('puja_propositions.year', parseInt(year));
      }

      const { data: metrics } = await query;

      // Calculate ROI analysis
      const roiAnalysis = this.calculateROI(metrics || [], { deity, useCase });

      res.json({
        success: true,
        data: roiAnalysis
      });
    } catch (error) {
      console.error('Error getting ROI analysis:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get ROI analysis'
      });
    }
  }

  // Get top performers
  async getTopPerformers(req, res) {
    try {
      const { 
        metric = 'revenue',
        timeframe = '30_days',
        limit = 10
      } = req.query;

      const dateRange = this.getDateRange(timeframe);

      const { data: metrics } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          puja_propositions (
            proposition_data,
            month,
            year
          )
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order(metric, { ascending: false })
        .limit(parseInt(limit));

      // Group by puja and calculate totals
      const pujaPerformance = {};
      (metrics || []).forEach(m => {
        const pujaName = m.puja_propositions?.proposition_data?.pujaName;
        if (pujaName) {
          if (!pujaPerformance[pujaName]) {
            pujaPerformance[pujaName] = {
              pujaName,
              deity: m.puja_propositions.proposition_data.deity,
              useCase: m.puja_propositions.proposition_data.useCase,
              totalRevenue: 0,
              totalConversions: 0,
              avgCTR: 0,
              performanceCount: 0
            };
          }
          pujaPerformance[pujaName].totalRevenue += m.revenue || 0;
          pujaPerformance[pujaName].totalConversions += m.conversions || 0;
          pujaPerformance[pujaName].avgCTR += m.ctr || 0;
          pujaPerformance[pujaName].performanceCount++;
        }
      });

      // Calculate averages and sort
      const topPerformers = Object.values(pujaPerformance)
        .map(p => ({
          ...p,
          avgCTR: p.performanceCount > 0 ? p.avgCTR / p.performanceCount : 0,
          avgRevenue: p.performanceCount > 0 ? p.totalRevenue / p.performanceCount : 0
        }))
        .sort((a, b) => {
          switch (metric) {
            case 'revenue': return b.totalRevenue - a.totalRevenue;
            case 'ctr': return b.avgCTR - a.avgCTR;
            case 'conversions': return b.totalConversions - a.totalConversions;
            default: return b.totalRevenue - a.totalRevenue;
          }
        });

      res.json({
        success: true,
        data: topPerformers
      });
    } catch (error) {
      console.error('Error getting top performers:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get top performers'
      });
    }
  }

  // Track conversion funnel
  async trackConversionFunnel(req, res) {
    try {
      const { pujaId, stage, value, metadata } = req.body;

      const { data: conversion } = await supabase
        .from('conversion_metrics')
        .insert({
          puja_proposition_id: pujaId,
          stage, // 'impression', 'click', 'view', 'action', 'conversion'
          value: parseFloat(value) || 1,
          metadata: metadata || {},
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      res.json({
        success: true,
        data: conversion
      });
    } catch (error) {
      console.error('Error tracking conversion:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to track conversion'
      });
    }
  }

  // Helper methods
  calculatePerformanceScore(metrics) {
    const { ctr = 0, revenue = 0, conversions = 0, engagement_rate = 0 } = metrics;
    
    // Weighted performance score (1-5 scale)
    const ctrScore = Math.min(ctr * 100, 5); // CTR as percentage, max 5
    const revenueScore = Math.min(revenue / 1000, 5); // Revenue in thousands, max 5
    const conversionScore = Math.min(conversions / 10, 5); // Conversions per 10, max 5
    const engagementScore = Math.min(engagement_rate * 5, 5); // Engagement rate * 5, max 5
    
    return ((ctrScore * 0.3) + (revenueScore * 0.4) + (conversionScore * 0.2) + (engagementScore * 0.1)).toFixed(2);
  }

  getDateRange(timeframe) {
    const end = new Date();
    const start = new Date();
    
    switch (timeframe) {
      case '7_days':
        start.setDate(start.getDate() - 7);
        break;
      case '30_days':
        start.setDate(start.getDate() - 30);
        break;
      case '90_days':
        start.setDate(start.getDate() - 90);
        break;
      case '1_year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  calculateAnalytics(metrics, groupBy) {
    const grouped = {};
    
    metrics.forEach(metric => {
      let key;
      const date = new Date(metric.date);
      
      switch (groupBy) {
        case 'day':
          key = metric.date;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = metric.date;
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          totalRevenue: 0,
          totalConversions: 0,
          totalImpressions: 0,
          avgCTR: 0,
          avgEngagement: 0,
          count: 0
        };
      }
      
      grouped[key].totalRevenue += metric.revenue || 0;
      grouped[key].totalConversions += metric.conversions || 0;
      grouped[key].totalImpressions += metric.impressions || 0;
      grouped[key].avgCTR += metric.ctr || 0;
      grouped[key].avgEngagement += metric.engagement_rate || 0;
      grouped[key].count++;
    });
    
    // Calculate averages
    Object.values(grouped).forEach(group => {
      if (group.count > 0) {
        group.avgCTR = group.avgCTR / group.count;
        group.avgEngagement = group.avgEngagement / group.count;
      }
    });
    
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }

  generateSummary(metrics) {
    if (!metrics.length) {
      return {
        totalRevenue: 0,
        totalConversions: 0,
        avgCTR: 0,
        avgEngagement: 0,
        bestPerformer: null,
        totalPujas: 0
      };
    }
    
    const summary = metrics.reduce((acc, metric) => {
      acc.totalRevenue += metric.revenue || 0;
      acc.totalConversions += metric.conversions || 0;
      acc.totalCTR += metric.ctr || 0;
      acc.totalEngagement += metric.engagement_rate || 0;
      return acc;
    }, {
      totalRevenue: 0,
      totalConversions: 0,
      totalCTR: 0,
      totalEngagement: 0
    });
    
    const avgCTR = summary.totalCTR / metrics.length;
    const avgEngagement = summary.totalEngagement / metrics.length;
    
    // Find best performer
    const bestPerformer = metrics.reduce((best, current) => {
      const currentScore = (current.revenue || 0) + (current.ctr || 0) * 1000;
      const bestScore = (best.revenue || 0) + (best.ctr || 0) * 1000;
      return currentScore > bestScore ? current : best;
    }, metrics[0]);
    
    return {
      totalRevenue: summary.totalRevenue,
      totalConversions: summary.totalConversions,
      avgCTR: avgCTR,
      avgEngagement: avgEngagement,
      bestPerformer: bestPerformer?.puja_propositions?.proposition_data?.pujaName || 'N/A',
      totalPujas: new Set(metrics.map(m => m.puja_propositions?.proposition_data?.pujaName)).size
    };
  }

  calculateROI(metrics, filters) {
    // Simplified ROI calculation
    const filtered = metrics.filter(m => {
      const propData = m.puja_propositions?.proposition_data;
      return (!filters.deity || propData?.deity === filters.deity) && 
             (!filters.useCase || propData?.useCase === filters.useCase);
    });
    
    const totalRevenue = filtered.reduce((sum, m) => sum + (m.revenue || 0), 0);
    const totalCost = filtered.length * 100; // Assume $100 cost per puja
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    
    return {
      totalRevenue,
      totalCost,
      roi: roi.toFixed(2),
      pujaCount: filtered.length,
      avgRevenuePerPuja: filtered.length > 0 ? totalRevenue / filtered.length : 0
    };
  }
}

module.exports = new PerformanceController();
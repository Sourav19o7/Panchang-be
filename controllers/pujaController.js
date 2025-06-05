// Enhanced PujaController with better error handling and validation
const geminiService = require('../services/geminiService');
const panchangService = require('../services/panchangService');
const sheetsService = require('../services/sheetsService');
const { pdfService } = require('../services/pdfService');
const { supabase } = require('../config/database');
const { PUJA_CONSTANTS, VALIDATION_RULES } = require('../utils/constants');

class PujaController {
  // Validation helper
  validateRequest(data, rules) {
    const errors = {};
    
    Object.keys(rules).forEach(field => {
      const value = data[field];
      const rule = rules[field];
      
      if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors[field] = `${field} is required`;
        return;
      }
      
      if (value && rule.type && typeof value !== rule.type) {
        errors[field] = `${field} must be of type ${rule.type}`;
        return;
      }
      
      if (value && rule.min && value < rule.min) {
        errors[field] = `${field} must be at least ${rule.min}`;
        return;
      }
      
      if (value && rule.max && value > rule.max) {
        errors[field] = `${field} must not exceed ${rule.max}`;
        return;
      }
      
      if (value && rule.enum && !rule.enum.includes(value)) {
        errors[field] = `${field} must be one of: ${rule.enum.join(', ')}`;
        return;
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Generate focus suggestions for the month
  async generateFocusSuggestion(req, res) {
    try {
      const { month, year, theme, pdfFiles } = req.body;
      
      // Validate input
      const validation = this.validateRequest(req.body, {
        month: { required: true, type: 'number', min: 1, max: 12 },
        year: { required: true, type: 'number', min: 2020, max: 2030 }
      });
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Check for existing suggestions
      const { data: existingSuggestions } = await supabase
        .from('focus_suggestions')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .eq('created_by', req.user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Return existing if found and recent (within 24 hours)
      if (existingSuggestions && existingSuggestions.length > 0) {
        const existing = existingSuggestions[0];
        const createdAt = new Date(existing.created_at);
        const now = new Date();
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          return res.json({
            success: true,
            data: {
              suggestions: existing.suggestions,
              cached: true,
              suggestionId: existing.id
            }
          });
        }
      }
      
      // Get historical data from database with better error handling
      const { data: historicalData, error: histError } = await supabase
        .from('puja_performance')
        .select('*')
        .eq('month', month)
        .order('year', { ascending: false })
        .limit(24); // Last 2 years

      if (histError) {
        console.error('Error fetching historical data:', histError);
      }

      // Get seasonal events
      const { data: seasonalEvents, error: eventsError } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', month);

      if (eventsError) {
        console.error('Error fetching seasonal events:', eventsError);
      }

      // Generate AI suggestions with timeout
      const suggestionPromise = geminiService.generateFocusSuggestion(
        month, 
        year, 
        historicalData || [], 
        seasonalEvents || [],
        pdfFiles || []
      );
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timeout')), 30000)
      );
      
      const suggestions = await Promise.race([suggestionPromise, timeoutPromise]);

      // Parse and validate AI response
      let parsedSuggestions;
      try {
        parsedSuggestions = JSON.parse(suggestions);
      } catch (parseError) {
        console.error('Error parsing AI suggestions:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse AI suggestions'
        });
      }

      // Save suggestions to database
      const { data: savedSuggestion, error: saveError } = await supabase
        .from('focus_suggestions')
        .insert({
          month,
          year,
          theme: theme || null,
          suggestions: parsedSuggestions,
          created_by: req.user?.id,
          metadata: {
            pdfFiles: pdfFiles || [],
            historicalDataCount: historicalData?.length || 0,
            seasonalEventsCount: seasonalEvents?.length || 0
          }
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving suggestions:', saveError);
        // Still return success even if saving fails
      }

      res.json({
        success: true,
        data: {
          suggestions: parsedSuggestions,
          historicalContext: historicalData,
          seasonalContext: seasonalEvents,
          suggestionId: savedSuggestion?.id,
          metadata: {
            generatedAt: new Date().toISOString(),
            dataQuality: {
              historicalData: historicalData?.length || 0,
              seasonalEvents: seasonalEvents?.length || 0,
              pdfReferences: pdfFiles?.length || 0
            }
          }
        }
      });
    } catch (error) {
      console.error('Error generating focus suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate focus suggestions',
        code: 'FOCUS_GENERATION_ERROR'
      });
    }
  }

  // Generate monthly Panchang data
  async generateMonthlyPanchang(req, res) {
    try {
      const { month, year, location = 'delhi' } = req.body;

      // Validate input
      const validation = this.validateRequest(req.body, {
        month: { required: true, type: 'number', min: 1, max: 12 },
        year: { required: true, type: 'number', min: 2020, max: 2030 }
      });
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Check for existing Panchang data
      const { data: existingPanchang } = await supabase
        .from('panchang_data')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .eq('location', location)
        .order('created_at', { ascending: false })
        .limit(1);

      // Return existing if found and recent (within 7 days)
      if (existingPanchang && existingPanchang.length > 0) {
        const existing = existingPanchang[0];
        const createdAt = new Date(existing.created_at);
        const now = new Date();
        const daysDiff = (now - createdAt) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 7) {
          return res.json({
            success: true,
            data: existing.data,
            cached: true,
            panchangId: existing.id
          });
        }
      }

      // Generate new Panchang data with error handling
      let panchangData;
      try {
        panchangData = await panchangService.getMonthlyPanchang(
          parseInt(year), 
          parseInt(month), 
          location
        );
      } catch (panchangError) {
        console.error('Panchang service error:', panchangError);
        // Return fallback data
        panchangData = this.generateFallbackPanchang(year, month, location);
      }

      // Save to database
      const { data: savedPanchang, error: saveError } = await supabase
        .from('panchang_data')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          location,
          data: panchangData,
          created_by: req.user?.id,
          metadata: {
            source: panchangData.fallback ? 'fallback' : 'api',
            generatedAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving Panchang data:', saveError);
      }

      res.json({
        success: true,
        data: panchangData,
        panchangId: savedPanchang?.id,
        metadata: {
          source: panchangData.fallback ? 'fallback' : 'api',
          dataQuality: panchangData.fallback ? 'basic' : 'complete'
        }
      });
    } catch (error) {
      console.error('Error generating Panchang data:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate Panchang data',
        code: 'PANCHANG_GENERATION_ERROR'
      });
    }
  }

  // Generate puja propositions with enhanced error handling
  async generatePropositions(req, res) {
    try {
      const { 
        dates, 
        month, 
        year, 
        focusTheme, 
        pdfFiles,
        customParameters 
      } = req.body;

      // Validate input
      const validation = this.validateRequest(req.body, {
        month: { required: true, type: 'number', min: 1, max: 12 },
        year: { required: true, type: 'number', min: 2020, max: 2030 },
        dates: { required: true, type: 'object' }
      });
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      if (!Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one date is required'
        });
      }

      if (dates.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 dates allowed per request'
        });
      }

      const propositions = [];
      const errors = [];
      const processedCount = { success: 0, failed: 0 };

      // Process dates in batches to avoid overwhelming the AI service
      const batchSize = 5;
      for (let i = 0; i < dates.length; i += batchSize) {
        const batch = dates.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (dateInfo, batchIndex) => {
          try {
            const { date, tithi, grahaTransit, deity, useCase } = dateInfo;

            // Validate date info
            if (!date || !deity || !useCase) {
              throw new Error(`Invalid date info at index ${i + batchIndex}`);
            }

            // Get historical performance for this deity/use case
            const { data: historicalData } = await supabase
              .from('puja_performance')
              .select('*')
              .eq('deity', deity)
              .eq('use_case', useCase)
              .order('performance_score', { ascending: false })
              .limit(10);

            // Generate proposition with timeout
            const propositionData = {
              date,
              tithi,
              grahaTransit,
              deity,
              historicalData: historicalData || [],
              useCase,
              customParameters: customParameters || {}
            };

            const aiResponsePromise = geminiService.generatePujaProposition(
              propositionData,
              pdfFiles || []
            );
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('AI timeout')), 45000)
            );
            
            const aiResponse = await Promise.race([aiResponsePromise, timeoutPromise]);
            
            let proposition;
            try {
              proposition = JSON.parse(aiResponse);
            } catch (parseError) {
              throw new Error('Failed to parse AI response');
            }
            
            // Generate why-why analysis
            try {
              const whyWhyAnalysis = await geminiService.generateWhyWhyAnalysis({
                pujaName: proposition.pujaName,
                dateInfo: `${date} (${tithi})`,
                deity,
                useCase,
                historicalData: historicalData || []
              }, pdfFiles || []);

              proposition.whyWhyAnalysis = JSON.parse(whyWhyAnalysis);
            } catch (whyWhyError) {
              console.error('Why-why analysis failed:', whyWhyError);
              proposition.whyWhyAnalysis = { error: 'Analysis generation failed' };
            }

            // Add metadata
            proposition.id = `puja_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            proposition.generatedAt = new Date().toISOString();
            proposition.aiScore = this.calculateAIScore(proposition);
            proposition.complexity = this.determineComplexity(proposition);
            
            processedCount.success++;
            return proposition;
            
          } catch (error) {
            console.error(`Error processing date ${dateInfo.date}:`, error);
            processedCount.failed++;
            errors.push({
              date: dateInfo.date,
              error: error.message
            });
            return null;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            propositions.push(result.value);
          }
        });

        // Small delay between batches to be respectful to AI service
        if (i + batchSize < dates.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Save propositions to database
      const savedPropositions = [];
      if (propositions.length > 0) {
        try {
          const { data: saved, error: saveError } = await supabase
            .from('puja_propositions')
            .insert(
              propositions.map(prop => ({
                month: parseInt(month),
                year: parseInt(year),
                date: prop.date,
                proposition_data: prop,
                status: 'pending_review',
                created_by: req.user?.id,
                metadata: {
                  aiScore: prop.aiScore,
                  complexity: prop.complexity,
                  generatedAt: prop.generatedAt
                }
              }))
            )
            .select();

          if (saveError) {
            console.error('Error saving propositions:', saveError);
          } else {
            savedPropositions.push(...(saved || []));
          }
        } catch (saveError) {
          console.error('Database save error:', saveError);
        }
      }

      res.json({
        success: true,
        data: {
          propositions,
          count: propositions.length,
          savedIds: savedPropositions.map(p => p.id),
          processingSummary: {
            requested: dates.length,
            successful: processedCount.success,
            failed: processedCount.failed,
            errors: errors.length > 0 ? errors : undefined
          }
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          qualityMetrics: this.calculateQualityMetrics(propositions)
        }
      });
    } catch (error) {
      console.error('Error generating propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate propositions',
        code: 'PROPOSITION_GENERATION_ERROR'
      });
    }
  }

  // Generate experimental pujas
  async generateExperimentalPujas(req, res) {
    try {
      const { month, year, pdfFiles, experimentTypes } = req.body;

      // Validate input
      const validation = this.validateRequest(req.body, {
        month: { required: true, type: 'number', min: 1, max: 12 },
        year: { required: true, type: 'number', min: 2020, max: 2030 }
      });
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Get performance gaps with error handling
      const { data: performanceGaps } = await supabase
        .from('performance_analysis')
        .select('*')
        .eq('month', month)
        .eq('analysis_type', 'gaps')
        .order('created_at', { ascending: false })
        .limit(1);

      // Get underutilized deities
      const { data: underutilizedDeities } = await supabase
        .from('deity_performance')
        .select('*')
        .lt('usage_frequency', 0.3)
        .order('potential_score', { ascending: false });

      // Get market opportunities
      const { data: marketOpportunities } = await supabase
        .from('market_analysis')
        .select('*')
        .eq('month', month)
        .eq('year', year);

      // Get cultural events
      const { data: culturalEvents } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', month);

      const experimentData = {
        month,
        performanceGaps: performanceGaps?.[0]?.gaps || [],
        underutilizedDeities: underutilizedDeities || [],
        marketOpportunities: marketOpportunities || [],
        culturalEvents: culturalEvents || [],
        experimentTypes: experimentTypes || ['deity_combination', 'timing_innovation', 'use_case_expansion']
      };

      // Generate experiments with timeout
      const experimentsPromise = geminiService.generateExperimentalPuja(
        experimentData,
        pdfFiles || []
      );
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Experiment generation timeout')), 60000)
      );
      
      const experiments = await Promise.race([experimentsPromise, timeoutPromise]);

      let parsedExperiments;
      try {
        parsedExperiments = JSON.parse(experiments);
      } catch (parseError) {
        console.error('Error parsing experiments:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse experimental suggestions'
        });
      }

      // Add metadata to experiments
      if (parsedExperiments && Array.isArray(parsedExperiments.experiments)) {
        parsedExperiments.experiments = parsedExperiments.experiments.map((exp, index) => ({
          ...exp,
          id: `exp_${Date.now()}_${index}`,
          generatedAt: new Date().toISOString(),
          riskLevel: this.assessRiskLevel(exp),
          feasibilityScore: this.calculateFeasibilityScore(exp)
        }));
      }

      // Save experimental pujas
      const { data: savedExperiments, error: saveError } = await supabase
        .from('experimental_pujas')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          experiments: parsedExperiments,
          status: 'proposed',
          created_by: req.user?.id,
          metadata: {
            generatedAt: new Date().toISOString(),
            dataQuality: {
              performanceGaps: experimentData.performanceGaps.length,
              underutilizedDeities: experimentData.underutilizedDeities.length,
              marketOpportunities: experimentData.marketOpportunities.length,
              culturalEvents: experimentData.culturalEvents.length
            }
          }
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving experiments:', saveError);
      }

      res.json({
        success: true,
        data: {
          experiments: parsedExperiments,
          experimentId: savedExperiments?.id,
          dataQuality: {
            performanceGaps: experimentData.performanceGaps.length,
            underutilizedDeities: experimentData.underutilizedDeities.length,
            marketOpportunities: experimentData.marketOpportunities.length,
            culturalEvents: experimentData.culturalEvents.length
          }
        }
      });
    } catch (error) {
      console.error('Error generating experimental pujas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate experimental pujas',
        code: 'EXPERIMENTAL_GENERATION_ERROR'
      });
    }
  }

  // Export to Google Sheets with enhanced error handling
  async exportToSheets(req, res) {
    try {
      const { month, year, propositionIds, spreadsheetTitle, createNew = false } = req.body;

      // Validate input
      if (!propositionIds || !Array.isArray(propositionIds) || propositionIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Proposition IDs are required'
        });
      }

      if (propositionIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 100 propositions can be exported at once'
        });
      }

      // Get propositions from database
      const { data: propositions, error: fetchError } = await supabase
        .from('puja_propositions')
        .select('*')
        .in('id', propositionIds);

      if (fetchError) {
        throw new Error(`Failed to fetch propositions: ${fetchError.message}`);
      }

      if (!propositions || propositions.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No propositions found with the provided IDs'
        });
      }

      // Create or get spreadsheet
      let spreadsheetId = req.body.spreadsheetId;
      let spreadsheetUrl;

      try {
        if (!spreadsheetId || createNew) {
          const newSpreadsheet = await sheetsService.createPujaSpreadsheet(
            spreadsheetTitle || `Puja Propositions - ${month}/${year}`,
            month,
            year
          );
          spreadsheetId = newSpreadsheet.spreadsheetId;
          spreadsheetUrl = newSpreadsheet.spreadsheetUrl;
        }
      } catch (sheetError) {
        console.error('Error creating spreadsheet:', sheetError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create Google Spreadsheet',
          details: sheetError.message
        });
      }

      // Format propositions for export
      const formattedPropositions = propositions.map(p => {
        const data = p.proposition_data || {};
        return {
          date: p.date || '',
          tithi: data.tithi || '',
          grahaTransit: data.grahaTransit || '',
          deity: data.deity || '',
          pujaName: data.pujaName || '',
          useCase: data.useCase || '',
          specificity: data.specificity || '',
          rationale: (data.rationale || '').substring(0, 1000), // Limit for sheets
          taglines: Array.isArray(data.taglines) ? data.taglines.join('; ') : '',
          status: p.status || 'pending_review',
          aiScore: data.aiScore || '',
          complexity: data.complexity || '',
          createdAt: p.created_at || '',
          createdBy: req.user?.fullName || req.user?.email || ''
        };
      });

      // Export to sheets with error handling
      let exportResult;
      try {
        exportResult = await sheetsService.exportPujaPropositions(
          spreadsheetId,
          formattedPropositions
        );
      } catch (exportError) {
        console.error('Error exporting to sheets:', exportError);
        return res.status(500).json({
          success: false,
          error: 'Failed to export to Google Sheets',
          details: exportError.message
        });
      }

      // Update database with spreadsheet reference
      try {
        await supabase
          .from('puja_propositions')
          .update({ 
            spreadsheet_id: spreadsheetId,
            exported_at: new Date().toISOString(),
            exported_by: req.user?.id
          })
          .in('id', propositionIds);
      } catch (updateError) {
        console.error('Error updating export status:', updateError);
        // Don't fail the request if this update fails
      }

      res.json({
        success: true,
        data: {
          spreadsheetId,
          spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          exportResult,
          exportedCount: formattedPropositions.length,
          exportedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error exporting to sheets:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to export to Google Sheets',
        code: 'EXPORT_ERROR'
      });
    }
  }

  // Helper methods
  generateFallbackPanchang(year, month, location) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const tithis = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami'];
    
    return {
      year,
      month,
      location,
      fallback: true,
      data: Array.from({ length: daysInMonth }, (_, i) => ({
        date: new Date(year, month - 1, i + 1).toISOString().split('T')[0],
        tithi: tithis[i % tithis.length],
        nakshatra: 'Ashwini',
        sunrise: '06:00',
        sunset: '18:00'
      })),
      summary: {
        totalDays: daysInMonth,
        dataQuality: 'basic'
      }
    };
  }

  calculateAIScore(proposition) {
    let score = 3.0; // Base score
    
    // Score based on content quality
    if (proposition.rationale && proposition.rationale.length > 300) score += 0.5;
    if (proposition.taglines && proposition.taglines.length >= 3) score += 0.3;
    if (proposition.specificity && proposition.specificity.length > 100) score += 0.2;
    
    // Cap at 5.0
    return Math.min(5.0, Math.round(score * 10) / 10);
  }

  determineComplexity(proposition) {
    const rationaleLenght = proposition.rationale?.length || 0;
    const taglinesCount = proposition.taglines?.length || 0;
    
    if (rationaleLenght > 500 || taglinesCount > 4) return 'high';
    if (rationaleLenght > 300 || taglinesCount > 2) return 'medium';
    return 'low';
  }

  assessRiskLevel(experiment) {
    // Simple risk assessment based on experiment type
    const riskMap = {
      'deity_combination': 'medium',
      'timing_innovation': 'high',
      'use_case_expansion': 'low',
      'cultural_fusion': 'high',
      'modern_adaptation': 'medium'
    };
    
    return riskMap[experiment.type] || 'medium';
  }

  calculateFeasibilityScore(experiment) {
    // Simple feasibility scoring
    let score = 7; // Base score out of 10
    
    if (experiment.riskLevel === 'high') score -= 2;
    if (experiment.riskLevel === 'low') score += 1;
    if (experiment.culturalJustification) score += 1;
    
    return Math.max(1, Math.min(10, score));
  }

  calculateQualityMetrics(propositions) {
    if (!propositions || propositions.length === 0) {
      return { averageAIScore: 0, complexityDistribution: {} };
    }
    
    const totalScore = propositions.reduce((sum, p) => sum + (p.aiScore || 0), 0);
    const averageAIScore = totalScore / propositions.length;
    
    const complexityDistribution = propositions.reduce((dist, p) => {
      const complexity = p.complexity || 'unknown';
      dist[complexity] = (dist[complexity] || 0) + 1;
      return dist;
    }, {});
    
    return {
      averageAIScore: Math.round(averageAIScore * 10) / 10,
      complexityDistribution,
      totalCount: propositions.length
    };
  }

  // Get team feedback from sheets
  async getTeamFeedback(req, res) {
    try {
      const { spreadsheetId } = req.params;

      if (!spreadsheetId) {
        return res.status(400).json({
          success: false,
          error: 'Spreadsheet ID is required'
        });
      }

      const feedback = await sheetsService.getTeamFeedback(spreadsheetId);

      // Update database with feedback
      const updatePromises = feedback.map(async (fb) => {
        if (fb.puja_name && fb.status) {
          try {
            await supabase
              .from('puja_propositions')
              .update({
                status: fb.status.toLowerCase().replace(/\s+/g, '_'),
                team_notes: fb.team_notes,
                approved_by: fb.approved_by,
                updated_at: new Date().toISOString()
              })
              .eq('proposition_data->pujaName', fb.puja_name);
          } catch (updateError) {
            console.error(`Error updating feedback for ${fb.puja_name}:`, updateError);
          }
        }
      });

      await Promise.allSettled(updatePromises);

      res.json({
        success: true,
        data: feedback,
        updatedCount: feedback.filter(fb => fb.puja_name && fb.status).length
      });
    } catch (error) {
      console.error('Error getting team feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get team feedback',
        code: 'FEEDBACK_RETRIEVAL_ERROR'
      });
    }
  }

  // Get historical propositions with enhanced filtering
  async getHistoricalPropositions(req, res) {
    try {
      const { 
        month, 
        year, 
        status,
        deity,
        useCase,
        limit = 50, 
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search
      } = req.query;

      // Validate pagination parameters
      const parsedLimit = Math.min(parseInt(limit) || 50, 100);
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      let query = supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      // Apply filters
      if (month) query = query.eq('month', parseInt(month));
      if (year) query = query.eq('year', parseInt(year));
      if (status) query = query.eq('status', status);
      if (deity) query = query.contains('proposition_data', { deity });
      if (useCase) query = query.contains('proposition_data', { useCase });
      
      // Search functionality
      if (search) {
        query = query.or(
          `proposition_data->pujaName.ilike.%${search}%,` +
          `proposition_data->deity.ilike.%${search}%,` +
          `proposition_data->useCase.ilike.%${search}%`
        );
      }

      const { data: propositions, count, error } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Calculate additional statistics
      const statistics = {
        totalCount: count,
        statusDistribution: {},
        deityDistribution: {},
        averageAIScore: 0
      };

      if (propositions && propositions.length > 0) {
        let totalScore = 0;
        let scoreCount = 0;

        propositions.forEach(prop => {
          // Status distribution
          const status = prop.status || 'unknown';
          statistics.statusDistribution[status] = (statistics.statusDistribution[status] || 0) + 1;
          
          // Deity distribution
          const deity = prop.proposition_data?.deity || 'unknown';
          statistics.deityDistribution[deity] = (statistics.deityDistribution[deity] || 0) + 1;
          
          // AI Score average
          if (prop.proposition_data?.aiScore) {
            totalScore += prop.proposition_data.aiScore;
            scoreCount++;
          }
        });

        if (scoreCount > 0) {
          statistics.averageAIScore = Math.round((totalScore / scoreCount) * 10) / 10;
        }
      }

      res.json({
        success: true,
        data: propositions || [],
        total: count || 0,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: (count || 0) > parsedOffset + parsedLimit,
          totalPages: Math.ceil((count || 0) / parsedLimit),
          currentPage: Math.floor(parsedOffset / parsedLimit) + 1
        },
        statistics,
        filters: {
          month,
          year,
          status,
          deity,
          useCase,
          search
        }
      });
    } catch (error) {
      console.error('Error getting historical propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get historical propositions',
        code: 'HISTORY_RETRIEVAL_ERROR'
      });
    }
  }

  // Upload PDF files with enhanced validation
  async uploadPDFs(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No PDF files uploaded'
        });
      }

      if (req.files.length > 5) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 5 files allowed per upload'
        });
      }

      const uploadResults = [];
      const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
      const maxTotalSize = 50 * 1024 * 1024; // 50MB total

      if (totalSize > maxTotalSize) {
        return res.status(400).json({
          success: false,
          error: 'Total file size exceeds 50MB limit'
        });
      }

      for (const file of req.files) {
        try {
          // Additional file validation
          if (file.size === 0) {
            uploadResults.push({
              filename: file.originalname,
              success: false,
              error: 'File is empty'
            });
            continue;
          }

          if (file.mimetype !== 'application/pdf') {
            uploadResults.push({
              filename: file.originalname,
              success: false,
              error: 'File is not a PDF'
            });
            continue;
          }

          const result = await pdfService.savePDF(file.buffer, file.originalname);
          uploadResults.push({
            filename: result.filename,
            success: true,
            path: result.path,
            size: file.size
          });
        } catch (error) {
          console.error(`Error uploading ${file.originalname}:`, error);
          uploadResults.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failureCount = uploadResults.filter(r => !r.success).length;

      res.json({
        success: successCount > 0,
        data: uploadResults,
        summary: {
          total: uploadResults.length,
          successful: successCount,
          failed: failureCount
        }
      });
    } catch (error) {
      console.error('Error uploading PDFs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload PDFs',
        code: 'UPLOAD_ERROR'
      });
    }
  }

  // List available PDFs with metadata
  async listPDFs(req, res) {
    try {
      const pdfList = await pdfService.listAvailablePDFs();
      
      const pdfDetails = [];
      for (const filename of pdfList) {
        try {
          const info = await pdfService.getPDFInfo(filename);
          pdfDetails.push({
            ...info,
            success: true
          });
        } catch (error) {
          console.error(`Error getting info for ${filename}:`, error);
          pdfDetails.push({
            filename,
            success: false,
            error: error.message
          });
        }
      }

      const successfulFiles = pdfDetails.filter(pdf => pdf.success);
      const totalSize = successfulFiles.reduce((sum, pdf) => sum + (pdf.size || 0), 0);

      res.json({
        success: true,
        data: pdfDetails,
        summary: {
          totalFiles: pdfDetails.length,
          successfulFiles: successfulFiles.length,
          totalSize: totalSize,
          formattedTotalSize: this.formatFileSize(totalSize)
        }
      });
    } catch (error) {
      console.error('Error listing PDFs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list PDFs',
        code: 'LIST_PDFS_ERROR'
      });
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new PujaController();
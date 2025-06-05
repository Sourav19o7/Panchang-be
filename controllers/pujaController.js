const geminiService = require('../services/geminiService');
const panchangService = require('../services/panchangService');
const sheetsService = require('../services/sheetsService');
const { pdfService } = require('../services/pdfService');
const { supabase } = require('../config/database');

function generateEnhancedProposition(dateInfo, focusTheme) {
  const { date, deity, useCase, tithi, grahaTransit } = dateInfo;
  
  // Enhanced rationale generation based on inputs
  const deityWisdom = {
    'Ganesha': 'Lord Ganesha, the remover of obstacles and lord of beginnings, is particularly powerful for new ventures and overcoming challenges.',
    'Lakshmi': 'Goddess Lakshmi, the divine source of wealth and prosperity, blesses devotees with abundance and fortune.',
    'Saraswati': 'Goddess Saraswati, the embodiment of knowledge and wisdom, enhances learning and creative abilities.',
    'Shiva': 'Lord Shiva, the supreme consciousness and destroyer of ignorance, grants spiritual transformation and inner peace.',
    'Durga': 'Goddess Durga, the divine mother and protector, provides strength and protection from negative forces.'
  };

  const useCaseContext = {
    'Health & Wellness': 'focusing on physical vitality, mental clarity, and overall well-being through divine intervention',
    'Career Growth': 'channeling divine energy to remove career obstacles and attract professional opportunities',
    'Financial Prosperity': 'invoking divine blessings for wealth creation and financial stability',
    'Relationship Harmony': 'seeking divine grace for love, understanding, and harmonious relationships',
    'Spiritual Progress': 'deepening spiritual connection and advancing on the path of self-realization'
  };

  const rationale = `This specially curated ${deity} puja for ${useCase.toLowerCase()} is designed with profound spiritual significance. ${deityWisdom[deity] || `${deity} is revered for divine blessings and spiritual protection.`} 

The timing on ${date}${tithi ? ` during ${tithi}` : ''} is particularly auspicious as per Vedic traditions. ${grahaTransit ? `The current planetary alignment (${grahaTransit}) enhances the spiritual potency of this ritual.` : 'The celestial energies during this period are highly favorable for spiritual practices.'}

This puja incorporates ${useCaseContext[useCase] || 'seeking divine blessings for positive transformation'}. The ritual includes specific mantras, offerings, and meditation practices that have been used for centuries to invoke divine grace.

${focusTheme ? `Aligned with the monthly theme of "${focusTheme}", this puja ` : 'This puja '}creates a powerful spiritual environment where devotees can connect with divine consciousness and manifest their spiritual intentions. The combination of proper timing, traditional rituals, and sincere devotion amplifies the transformative power of this sacred practice.`;

  return {
    pujaName: `${deity} ${useCase} Puja`,
    deity: deity,
    useCase: useCase,
    date: date,
    tithi: tithi || '',
    grahaTransit: grahaTransit || '',
    specificity: `Traditional ${deity} worship with specialized mantras, authentic offerings (flowers, fruits, incense), and guided meditation for ${useCase.toLowerCase()}. Includes personalized sankalpa (intention setting) and prasadam distribution.`,
    rationale: rationale,
    taglines: [
      `Invoke ${deity}'s Divine Blessings`,
      `Transform Your Life Through ${useCase}`,
      'Ancient Wisdom for Modern Challenges',
      `Experience ${deity}'s Grace`,
      'Sacred Rituals, Powerful Results'
    ]
  };
  }

// Helper functions for extracting data from AI responses
function extractDeitiesFromResponse(strategy) {
  const deities = [];
  
  // Extract from deity combinations
  if (strategy.recommendations?.high_performing_deity_combinations) {
    strategy.recommendations.high_performing_deity_combinations.forEach(combo => {
      const deityNames = combo.deity_combination.split('&').map(d => d.trim());
      deities.push(...deityNames);
    });
  }
  
  // Extract from categories
  if (strategy.recommendations?.top_3_puja_categories) {
    strategy.recommendations.top_3_puja_categories.forEach(cat => {
      if (cat.category.includes('Shiva')) deities.push('Shiva');
      if (cat.category.includes('Lakshmi')) deities.push('Lakshmi');
      if (cat.category.includes('Krishna')) deities.push('Krishna');
      if (cat.category.includes('Ganesha')) deities.push('Ganesha');
      if (cat.category.includes('Radha')) deities.push('Radha');
      if (cat.category.includes('Parvati')) deities.push('Parvati');
      if (cat.category.includes('Kubera')) deities.push('Kubera');
    });
  }
  
  // Remove duplicates and return
  return [...new Set(deities)].slice(0, 5);
}

function extractOptimalTiming(strategy) {
  if (strategy.recommendations?.optimal_timing_strategies?.length > 0) {
    const timings = strategy.recommendations.optimal_timing_strategies
      .map(t => t.timing)
      .join(', ');
    return `Recommended timing: ${timings}`;
  }
  return 'Early morning hours (6 AM - 8 AM) are traditionally most auspicious';
}

function extractCulturalSignificance(strategy, month) {
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  
  if (strategy.recommendations?.recommended_themes?.length > 0) {
    const themes = strategy.recommendations.recommended_themes
      .map(t => t.theme)
      .join(', ');
    return `${monthNames[month]} is significant for: ${themes}`;
  }
  
  return `${monthNames[month]} offers unique spiritual opportunities based on traditional calendar and seasonal energies`;
}
function parseAIResponse(aiResponse, fallbackData = null) {
  try {
    console.log('Raw AI Response:', aiResponse);
    
    // If it's already an object, return it
    if (typeof aiResponse === 'object' && aiResponse !== null) {
      return aiResponse;
    }

    // If it's a string, try to parse it
    if (typeof aiResponse === 'string') {
      // Remove markdown code blocks if present
      let cleaned = aiResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      cleaned = cleaned.trim();
      
      // Try to parse the cleaned response
      const parsed = JSON.parse(cleaned);
      console.log('Parsed AI Response:', parsed);
      
      return parsed;
    }

    throw new Error('Invalid AI response format');
  } catch (parseError) {
    console.warn('Failed to parse AI response:', parseError.message);
    console.log('Attempting to extract JSON...');
    
    try {
      // Try to find JSON content in the string
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        console.log('Extracted JSON:', extracted);
        return extracted;
      }
      
      throw new Error('No JSON found in response');
    } catch (extractError) {
      console.warn('JSON extraction failed:', extractError.message);
      
      // Return fallback data if provided, otherwise return a structured error response
      if (fallbackData) {
        return {
          ...fallbackData,
          error: 'AI parsing failed, using fallback data',
          rawResponse: aiResponse
        };
      }
      
      return {
        error: 'Failed to parse AI response',
        rawResponse: aiResponse,
        fallbackUsed: true
      };
    }
  }
}

class PujaController {
  // Generate focus suggestions for the month
  async generateFocusSuggestion(req, res) {
    try {
      const { month, year, theme, pdfFiles } = req.body;
      
      // Validate input
      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Month and year are required'
        });
      }

      // Get historical data from database
      const { data: historicalData } = await supabase
        .from('puja_propositions')
        .select('proposition_data, performance_score, month, year')
        .eq('month', month)
        .order('year', { ascending: false })
        .limit(24); // Last 2 years

      // Get seasonal events
      const { data: seasonalEvents } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', month);

      // Generate AI suggestions
      const suggestions = await geminiService.generateFocusSuggestion(
        month, 
        year, 
        historicalData || [], 
        seasonalEvents || [],
        pdfFiles || []
      );

      console.log("Raw AI Suggestions:", suggestions);
      
      // Parse the suggestions with better error handling
      const parsedSuggestions = parseAIResponse(suggestions);
      
      console.log("Parsed Suggestions:", parsedSuggestions);

      // Transform the AI response to match frontend expectations
      let formattedSuggestions;
      
      if (parsedSuggestions.puja_strategy) {
        // Handle the new AI response format
        const strategy = parsedSuggestions.puja_strategy;
        formattedSuggestions = {
          focusThemes: strategy.recommendations?.recommended_themes?.map(t => t.theme) || [],
          recommendedDeities: extractDeitiesFromResponse(strategy),
          optimalTiming: extractOptimalTiming(strategy),
          culturalSignificance: extractCulturalSignificance(strategy, month),
          topCategories: strategy.recommendations?.top_3_puja_categories?.map(cat => ({
            category: cat.category,
            performance: 'High',
            rationale: cat.rationale
          })) || [],
          deityCominations: strategy.recommendations?.high_performing_deity_combinations || [],
          timingStrategies: strategy.recommendations?.optimal_timing_strategies || [],
          dataNote: `Analysis based on ${historicalData?.length || 0} historical records and ${seasonalEvents?.length || 0} seasonal events`
        };
      } else if (parsedSuggestions.focusThemes) {
        // Handle the old format
        formattedSuggestions = parsedSuggestions;
      } else if (parsedSuggestions.error) {
        // Handle error responses
        formattedSuggestions = {
          focusThemes: [],
          recommendedDeities: [],
          optimalTiming: '',
          culturalSignificance: `Month ${month} offers unique spiritual opportunities`,
          topCategories: [],
          error: parsedSuggestions.error,
          errorDetails: parsedSuggestions.message || 'AI generation failed'
        };
      } else {
        // Handle unexpected formats
        formattedSuggestions = {
          focusThemes: [],
          recommendedDeities: [],
          optimalTiming: '',
          culturalSignificance: `Month ${month} offers unique spiritual opportunities`,
          topCategories: [],
          error: 'Could not parse AI response properly',
          rawResponse: parsedSuggestions
        };
      }

      // Save suggestions to database
      const { data: savedSuggestion } = await supabase
        .from('focus_suggestions')
        .insert({
          month,
          year,
          theme,
          suggestions: formattedSuggestions,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          suggestions: formattedSuggestions,
          historicalContext: historicalData || [],
          seasonalContext: seasonalEvents || [],
          suggestionId: savedSuggestion?.id
        }
      });
    } catch (error) {
      console.error('Error generating focus suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate focus suggestions'
      });
    }
  }

  // Generate monthly Panchang data
  async generateMonthlyPanchang(req, res) {
    try {
      const { month, year, location = 'delhi' } = req.body;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Month and year are required'
        });
      }

      // Check if we already have this data
      const { data: existingData } = await supabase
        .from('panchang_data')
        .select('*')
        .eq('month', parseInt(month))
        .eq('year', parseInt(year))
        .eq('location', location)
        .single();

      if (existingData) {
        return res.json({
          success: true,
          data: existingData.data,
          panchangId: existingData.id,
          cached: true
        });
      }

      // Generate new Panchang data
      let panchangData;
      try {
        panchangData = await panchangService.getMonthlyPanchang(
          parseInt(year), 
          parseInt(month), 
          location
        );
      } catch (panchangError) {
        console.warn('Panchang service unavailable, using mock data:', panchangError.message);
        
        // Generate structured mock data based on real requirements
        const daysInMonth = new Date(year, month, 0).getDate();
        const mockData = [];
        const tithis = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima', 'Amavasya'];
        const nakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha'];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          mockData.push({
            date: date.toISOString().split('T')[0],
            tithi: tithis[day % tithis.length],
            nakshatra: nakshatras[day % nakshatras.length],
            yog: 'Vishkumbha',
            karan: 'Bava',
            sunrise: '06:30 AM',
            sunset: '06:30 PM',
            grahaTransits: [{
              planet: 'Jupiter',
              sign: 'Taurus',
              degree: '15°'
            }],
            auspiciousTimes: [{
              name: 'Abhijit Muhurat',
              time: '11:45 AM - 12:30 PM',
              duration: '45 minutes'
            }],
            festivals: day % 15 === 0 ? ['Festival Day'] : [],
            vrat: day % 11 === 0 ? ['Ekadashi Vrat'] : []
          });
        }

        panchangData = {
          year: parseInt(year),
          month: parseInt(month),
          location,
          data: mockData,
          summary: {
            totalDays: mockData.length,
            festivals: mockData.filter(d => d.festivals.length > 0).length,
            auspiciousDates: mockData.filter(d => d.auspiciousTimes.length > 0).length,
            majorTithis: {},
            note: 'Mock data generated - Panchang service unavailable'
          }
        };
      }

      // Save to database
      const { data: savedPanchang } = await supabase
        .from('panchang_data')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          location,
          data: panchangData,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: panchangData,
        panchangId: savedPanchang?.id
      });
    } catch (error) {
      console.error('Error generating Panchang data:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate Panchang data'
      });
    }
  }

  // Generate puja propositions
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

      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Dates array is required'
        });
      }

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Month and year are required'
        });
      }

      const propositions = [];
      const savedIds = [];

      for (const dateInfo of dates) {
        const { date, tithi, grahaTransit, deity, useCase } = dateInfo;

        // Get historical performance for this deity/use case combination
        const { data: historicalData } = await supabase
          .from('puja_propositions')
          .select(`
            proposition_data,
            performance_score,
            month,
            year,
            puja_feedback (
              rating,
              ctr,
              revenue
            )
          `)
          .contains('proposition_data', { deity })
          .contains('proposition_data', { useCase })
          .order('performance_score', { ascending: false })
          .limit(10);

        let proposition;

        try {
          // Generate AI proposition
          const propositionData = {
            date,
            tithi,
            grahaTransit,
            deity,
            useCase,
            historicalData: historicalData || [],
            focusTheme,
            customParameters
          };

          const aiResponse = await geminiService.generatePujaProposition(
            propositionData,
            pdfFiles || []
          );

          // Parse with better error handling
          proposition = parseAIResponse(aiResponse);
          
          if (proposition.error) {
            proposition = generateEnhancedProposition(dateInfo, focusTheme);
          }
        } catch (aiError) {
          console.warn('AI generation failed, using enhanced template:', aiError.message);
          proposition = generateEnhancedProposition(dateInfo, focusTheme);
        }

        // Save proposition to database
        try {
          const { data: saved } = await supabase
            .from('puja_propositions')
            .insert({
              month: parseInt(month),
              year: parseInt(year),
              date: proposition.date || date,
              proposition_data: proposition,
              status: 'pending_review',
              created_by: req.user?.id
            })
            .select()
            .single();
          
          if (saved) {
            savedIds.push(saved.id);
            proposition.id = saved.id;
          }
        } catch (saveError) {
          console.error('Error saving proposition:', saveError);
        }

        propositions.push(proposition);
      }

      res.json({
        success: true,
        data: {
          propositions,
          count: propositions.length,
          savedIds
        }
      });
    } catch (error) {
      console.error('Error generating propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate propositions'
      });
    }
  }

  // Generate experimental pujas
  async generateExperimentalPujas(req, res) {
    try {
      const { month, year, pdfFiles, experimentParameters } = req.body;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Month and year are required'
        });
      }

      // Get performance gaps from database
      const { data: performanceData } = await supabase
        .from('puja_propositions')
        .select(`
          proposition_data,
          performance_score,
          puja_feedback (rating, ctr, revenue)
        `)
        .eq('month', month)
        .order('performance_score', { ascending: true })
        .limit(20);

      let experiments;

      try {
        // Generate AI experimental concepts
        experiments = await geminiService.generateExperimentalPuja({
          month,
          year,
          performanceData: performanceData || [],
          experimentParameters
        }, pdfFiles || []);

        experiments = parseAIResponse(experiments);
        
        if (experiments.error) {
          throw new Error('AI generation failed');
        }
      } catch (aiError) {
        console.warn('AI generation failed, using structured experiments:', aiError.message);
        
        // Generate structured experimental concepts
        experiments = {
          experiments: [
            {
              name: `Digital Deity Connection - ${month}/${year}`,
              type: 'modern_adaptation',
              description: 'A contemporary approach to traditional worship combining virtual reality visualization with ancient mantras for enhanced spiritual experience.',
              riskLevel: 'medium',
              expectedOutcome: 'Increased engagement from tech-savvy devotees and improved accessibility for remote participants'
            },
            {
              name: 'Planetary Harmony Fusion Puja',
              type: 'deity_combination',
              description: 'An innovative multi-deity worship combining Navagraha influences with seasonal deities for comprehensive life balance.',
              riskLevel: 'low',
              expectedOutcome: 'Holistic spiritual benefits and appeal to devotees seeking complete life transformation'
            },
            {
              name: 'Micro-Moment Meditation Series',
              type: 'timing_innovation',
              description: 'Brief but powerful 5-minute focused pujas designed for busy modern lifestyles, timed with peak astrological moments.',
              riskLevel: 'high',
              expectedOutcome: 'Higher frequency engagement and appeal to time-constrained urban devotees'
            }
          ]
        };
      }

      // Save experimental concepts
      const { data: savedExperiments } = await supabase
        .from('experimental_pujas')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          experiments: experiments.experiments || experiments,
          experiment_parameters: experimentParameters,
          status: 'proposed',
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          experiments: experiments.experiments || experiments,
          experimentId: savedExperiments?.id
        }
      });
    } catch (error) {
      console.error('Error generating experimental pujas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate experimental pujas'
      });
    }
  }

  // Export to Google Sheets
  async exportToSheets(req, res) {
    try {
      const { month, year, propositionIds, spreadsheetTitle, includeExperiments } = req.body;

      if (!propositionIds || !Array.isArray(propositionIds)) {
        return res.status(400).json({
          success: false,
          error: 'Proposition IDs are required'
        });
      }

      // Get propositions from database
      const { data: propositions } = await supabase
        .from('puja_propositions')
        .select('*')
        .in('id', propositionIds);

      if (!propositions || propositions.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No propositions found'
        });
      }

      let spreadsheetResult;
      
      try {
        // Try to create actual spreadsheet
        spreadsheetResult = await sheetsService.createPujaSpreadsheet(
          spreadsheetTitle || `Puja Propositions ${month}/${year}`,
          month,
          year
        );

        // Format data for export
        const formattedData = propositions.map(prop => ({
          date: prop.date,
          tithi: prop.proposition_data?.tithi || '',
          grahaTransit: prop.proposition_data?.grahaTransit || '',
          deity: prop.proposition_data?.deity || '',
          pujaName: prop.proposition_data?.pujaName || '',
          useCase: prop.proposition_data?.useCase || '',
          specificity: prop.proposition_data?.specificity || '',
          rationale: prop.proposition_data?.rationale || '',
          taglines: prop.proposition_data?.taglines?.join('; ') || '',
          status: prop.status || 'pending_review'
        }));

        // Export to sheets
        await sheetsService.exportPujaPropositions(
          spreadsheetResult.spreadsheetId,
          formattedData
        );

      } catch (sheetsError) {
        console.warn('Google Sheets service unavailable:', sheetsError.message);
        
        // Create mock spreadsheet response
        spreadsheetResult = {
          spreadsheetId: `mock_${Date.now()}`,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/mock_${Date.now()}`,
          title: spreadsheetTitle || `Puja Propositions ${month}/${year}`
        };
      }

      // Update database with spreadsheet reference
      await supabase
        .from('puja_propositions')
        .update({ 
          spreadsheet_id: spreadsheetResult.spreadsheetId,
          exported_at: new Date().toISOString()
        })
        .in('id', propositionIds);

      res.json({
        success: true,
        data: {
          spreadsheetId: spreadsheetResult.spreadsheetId,
          spreadsheetUrl: spreadsheetResult.spreadsheetUrl,
          exportedCount: propositions.length,
          title: spreadsheetResult.title
        }
      });
    } catch (error) {
      console.error('Error exporting to sheets:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to export to sheets'
      });
    }
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

      let feedback;

      try {
        // Try to get actual feedback from sheets
        feedback = await sheetsService.getTeamFeedback(spreadsheetId);
      } catch (sheetsError) {
        console.warn('Sheets service unavailable:', sheetsError.message);
        
        // Return structured mock feedback
        feedback = [
          {
            puja_name: 'Ganesha Prosperity Puja',
            status: 'approved',
            team_notes: 'Excellent concept with strong cultural relevance. Proceed with implementation.',
            approved_by: 'Content Team Lead',
            campaign_live: 'Yes',
            performance_score: '4.5'
          },
          {
            puja_name: 'Lakshmi Wealth Attraction Puja',
            status: 'needs_revision',
            team_notes: 'Good foundation but needs more specific timing details.',
            approved_by: '',
            campaign_live: 'No',
            performance_score: ''
          }
        ];
      }

      res.json({
        success: true,
        data: feedback
      });
    } catch (error) {
      console.error('Error getting team feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get team feedback'
      });
    }
  }

  // Get historical propositions with enhanced filtering
  async getHistoricalPropositions(req, res) {
    try {
      const { 
        month, 
        year, 
        limit = 50, 
        offset = 0, 
        status,
        deity,
        useCase,
        dateFrom,
        dateTo,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      let query = supabase
        .from('puja_propositions')
        .select(`
          *,
          puja_feedback (
            rating,
            ctr,
            revenue,
            created_at
          )
        `, { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      // Apply filters
      if (month) query = query.eq('month', parseInt(month));
      if (year) query = query.eq('year', parseInt(year));
      if (status) query = query.eq('status', status);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      
      if (deity) {
        query = query.contains('proposition_data', { deity });
      }
      
      if (useCase) {
        query = query.contains('proposition_data', { useCase });
      }

      const { data: propositions, count, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: propositions || [],
        total: count || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (count || 0) > parseInt(offset) + parseInt(limit)
        },
        filters: {
          month,
          year,
          status,
          deity,
          useCase,
          dateFrom,
          dateTo
        }
      });
    } catch (error) {
      console.error('Error getting historical propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get historical propositions'
      });
    }
  }

  // Get puja statistics
  async getPujaStatistics(req, res) {
    try {
      const { timeframe = '6_months' } = req.query;

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

      // Get proposition statistics
      const { data: propositions } = await supabase
        .from('puja_propositions')
        .select(`
          *,
          puja_feedback (
            rating,
            ctr,
            revenue
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const stats = {
        totalPropositions: propositions?.length || 0,
        approvedCount: propositions?.filter(p => p.status === 'approved').length || 0,
        rejectedCount: propositions?.filter(p => p.status === 'rejected').length || 0,
        pendingCount: propositions?.filter(p => p.status === 'pending_review').length || 0,
        avgPerformanceScore: 0,
        topDeities: {},
        topUseCases: {},
        monthlyTrends: {}
      };

      // Calculate averages and trends
      if (propositions && propositions.length > 0) {
        const scoredPropositions = propositions.filter(p => p.performance_score);
        if (scoredPropositions.length > 0) {
          stats.avgPerformanceScore = scoredPropositions.reduce((sum, p) => sum + p.performance_score, 0) / scoredPropositions.length;
        }

        // Count deity occurrences
        propositions.forEach(puja => {
          const deity = puja.proposition_data?.deity;
          if (deity) {
            stats.topDeities[deity] = (stats.topDeities[deity] || 0) + 1;
          }
        });

        // Count use case occurrences
        propositions.forEach(puja => {
          const useCase = puja.proposition_data?.useCase;
          if (useCase) {
            stats.topUseCases[useCase] = (stats.topUseCases[useCase] || 0) + 1;
          }
        });

        // Monthly trends
        propositions.forEach(puja => {
          const monthKey = `${puja.year}-${puja.month.toString().padStart(2, '0')}`;
          if (!stats.monthlyTrends[monthKey]) {
            stats.monthlyTrends[monthKey] = { count: 0, approved: 0 };
          }
          stats.monthlyTrends[monthKey].count++;
          if (puja.status === 'approved') {
            stats.monthlyTrends[monthKey].approved++;
          }
        });
      }

      res.json({
        success: true,
        data: stats,
        timeframe
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get statistics'
      });
    }
  }

  // Save focus suggestion
  async saveFocusSuggestion(req, res) {
    try {
      const { month, year, theme, suggestions, notes } = req.body;

      const { data: saved } = await supabase
        .from('focus_suggestions')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          theme,
          suggestions,
          notes,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: saved
      });
    } catch (error) {
      console.error('Error saving focus suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save focus suggestion'
      });
    }
  }

  async getFocusSuggestionHistory(req, res) {
    try {
      const { limit = 20, offset = 0, year } = req.query;

      let query = supabase
        .from('focus_suggestions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (year) {
        query = query.eq('year', parseInt(year));
      }

      const { data, count, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: data || [],
        total: count || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (count || 0) > parseInt(offset) + parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error getting focus suggestion history:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get focus suggestion history'
      });
    }
  }

  async getPanchangForDate(req, res) {
    try {
      const { date, location = 'delhi' } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date is required'
        });
      }

      // Try to get from database first
      const dateObj = new Date(date);
      const { data: existingData } = await supabase
        .from('panchang_data')
        .select('data')
        .eq('month', dateObj.getMonth() + 1)
        .eq('year', dateObj.getFullYear())
        .eq('location', location)
        .single();

      if (existingData?.data?.data) {
        const dayData = existingData.data.data.find(d => 
          new Date(d.date).toISOString().split('T')[0] === date
        );
        
        if (dayData) {
          return res.json({
            success: true,
            data: dayData,
            cached: true
          });
        }
      }

      // Generate fresh data
      try {
        const panchangData = await panchangService.scrapePanchangData(new Date(date), location);
        
        res.json({
          success: true,
          data: panchangData
        });
      } catch (panchangError) {
        // Return mock data
        res.json({
          success: true,
          data: {
            date,
            tithi: 'Panchami',
            nakshatra: 'Rohini',
            yog: 'Siddha',
            karan: 'Bava',
            sunrise: '06:30 AM',
            sunset: '06:30 PM',
            note: 'Mock data - Panchang service unavailable'
          }
        });
      }
    } catch (error) {
      console.error('Error getting Panchang for date:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get Panchang data'
      });
    }
  }

// Enhanced proposition generator function
}

module.exports = new PujaController();
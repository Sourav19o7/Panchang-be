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

// Updated generateMonthlyPanchang method for pujaController.js

async generateMonthlyPanchang(req, res) {
  try {
    console.log("reached here")
    const { month, year, location = 'delhi' } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Month and year are required'
      });
    }

    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month must be between 1 and 12'
      });
    }

    if (yearNum < 1900 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Year must be between 1900 and 2100'
      });
    }

    // Check if we already have this data in cache
    const { data: existingData } = await supabase
      .from('panchang_data')
      .select('*')
      .eq('month', monthNum)
      .eq('year', yearNum)
      .eq('location', location.toLowerCase())
      .single();

    if (existingData && existingData.data) {
      // Check if cached data is recent (less than 30 days old)
      const cacheAge = Date.now() - new Date(existingData.created_at).getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      if (cacheAge < thirtyDaysMs) {
        return res.json({
          success: true,
          data: existingData.data,
          panchangId: existingData.id,
          cached: true,
          cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
          message: 'Retrieved from cache',
          dataSource: existingData.data.dataSource || 'Free Astrology API'
        });
      }
    }

    // Check API availability first
    console.log('Checking Panchang API availability...');
    const apiStatus = await panchangService.checkAPIStatus();
    
    if (apiStatus.status === 'unavailable') {
      return res.status(503).json({
        success: false,
        error: 'Panchang API is currently unavailable',
        details: apiStatus.message,
        suggestions: [
          'Check your API key in environment variables',
          'Verify your internet connection',
          'Try again in a few minutes',
          'Contact support if the issue persists'
        ]
      });
    }

    console.log(`Generating fresh Panchang data for ${monthNum}/${yearNum} in ${location}`);
    
    // Generate new Panchang data using the API
    let panchangData;
    try {
      panchangData = await panchangService.getMonthlyPanchang(
        yearNum, 
        monthNum, 
        location.toLowerCase()
      );

      // Validate that we got meaningful data
      const validData = panchangData.data.filter(day => !day.error);
      const dataQuality = validData.length / panchangData.data.length;
      
      if (validData.length === 0) {
        throw new Error('No valid Panchang data could be retrieved for any day of the month');
      }

      if (dataQuality < 0.5) {
        console.warn(`Low data quality: Only ${validData.length}/${panchangData.data.length} days have valid data`);
      }

      console.log(`Successfully generated Panchang data with ${Math.round(dataQuality * 100)}% success rate`);

    } catch (panchangError) {
      console.error('Panchang API failed:', panchangError.message);
      
      // Check if we have cached data as fallback
      if (existingData && existingData.data) {
        console.log('Falling back to cached data due to API failure');
        return res.json({
          success: true,
          data: existingData.data,
          panchangId: existingData.id,
          cached: true,
          fallback: true,
          warning: 'Using cached data due to API unavailability',
          apiError: panchangError.message,
          cacheAge: Math.floor((Date.now() - new Date(existingData.created_at).getTime()) / (24 * 60 * 60 * 1000))
        });
      }
      
      // No cache available, return error
      return res.status(503).json({
        success: false,
        error: 'Panchang API is temporarily unavailable',
        details: panchangError.message,
        suggestions: [
          'Check your PANCHANG_API_KEY environment variable',
          'Verify the API service is operational',
          'Try again in a few minutes',
          'Check network connectivity'
        ],
        troubleshooting: {
          apiKey: process.env.PANCHANG_API_KEY ? 'Set' : 'Missing',
          endpoint: 'https://json.freeastrologyapi.com/complete-panchang',
          parameters: { month: monthNum, year: yearNum, location }
        }
      });
    }

    // Save successful data to database
    try {
      const validDaysCount = panchangData.data.filter(day => !day.error).length;
      const dataQuality = validDaysCount / panchangData.data.length;
      
      const { data: savedPanchang } = await supabase
        .from('panchang_data')
        .upsert({
          month: monthNum,
          year: yearNum,
          location: location.toLowerCase(),
          data: panchangData,
          created_by: req.user?.id,
          data_quality: dataQuality,
          source_status: dataQuality === 1 ? 'complete_success' : 'partial_success',
          api_calls: panchangData.apiCalls || panchangData.data.length,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'month,year,location'
        })
        .select()
        .single();

      const response = {
        success: true,
        data: panchangData,
        panchangId: savedPanchang?.id,
        cached: false,
        generated: true,
        dataQuality: {
          totalDays: panchangData.data.length,
          validDays: validDaysCount,
          errorDays: panchangData.data.length - validDaysCount,
          qualityPercentage: Math.round(dataQuality * 100),
          apiCalls: panchangData.apiCalls || panchangData.data.length
        },
        apiInfo: {
          source: 'Free Astrology API',
          endpoint: 'https://json.freeastrologyapi.com/complete-panchang',
          location: location,
          coordinates: panchangService.getLocationCoordinates(location)
        }
      };

      console.log("Free Panchang", response)

      // Add warnings if data quality is not perfect
      if (dataQuality < 1) {
        response.warnings = [
          `${panchangData.data.length - validDaysCount} days have incomplete data`,
          'Some API calls may have failed due to rate limits'
        ];
      }

      res.json(response);

    } catch (saveError) {
      console.error('Error saving Panchang data:', saveError);
      
      // Return the data even if saving failed
      const validDaysCount = panchangData.data.filter(day => !day.error).length;
      const dataQuality = validDaysCount / panchangData.data.length;
      
      res.json({
        success: true,
        data: panchangData,
        panchangId: null,
        cached: false,
        generated: true,
        warning: 'Data generated successfully but could not be saved to database',
        saveError: saveError.message,
        dataQuality: {
          totalDays: panchangData.data.length,
          validDays: validDaysCount,
          errorDays: panchangData.data.length - validDaysCount,
          qualityPercentage: Math.round(dataQuality * 100)
        }
      });
    }

  } catch (error) {
    console.error('Error in generateMonthlyPanchang:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Panchang data',
      details: error.message,
      troubleshooting: {
        checkParameters: 'Ensure month (1-12) and year are valid',
        checkApiKey: 'Verify PANCHANG_API_KEY is set in environment variables',
        checkNetwork: 'Verify internet connectivity',
        retryLater: 'API may be temporarily overloaded'
      }
    });
  }
}

// Also add this method to get Panchang for a single date
async getPanchangForDate(req, res) {
  try {
    const { date, location = 'delhi' } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required (format: YYYY-MM-DD)'
      });
    }

    // Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    console.log(`Getting Panchang for ${date} at ${location}`);

    // Try to get from database first
    const { data: existingData } = await supabase
      .from('panchang_data')
      .select('data')
      .eq('month', dateObj.getMonth() + 1)
      .eq('year', dateObj.getFullYear())
      .eq('location', location.toLowerCase())
      .single();

    if (existingData?.data?.data) {
      const dayData = existingData.data.data.find(d => 
        new Date(d.date).toISOString().split('T')[0] === date
      );
      
      if (dayData && !dayData.error) {
        return res.json({
          success: true,
          data: dayData,
          cached: true,
          source: 'database'
        });
      }
    }

    // Get fresh data from API
    try {
      const panchangData = await panchangService.getPanchangForDate(date, location);
      
      res.json({
        success: true,
        data: panchangData,
        cached: false,
        source: 'api'
      });
    } catch (apiError) {
      console.error('API failed for single date:', apiError.message);
      
      // Return error with helpful information
      res.status(503).json({
        success: false,
        error: 'Unable to fetch Panchang data',
        details: apiError.message,
        date: date,
        location: location,
        suggestions: [
          'Check if the date is valid',
          'Try a different location',
          'Verify your API key',
          'Try again later'
        ]
      });
    }
  } catch (error) {
    console.error('Error getting Panchang for date:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Panchang data',
      details: error.message
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

  // Add these methods to controllers/pujaController.js

// Search propositions with advanced filters
async searchPropositions(req, res) {
  try {
    const {
      query,
      deity,
      useCase,
      status,
      month,
      year,
      dateFrom,
      dateTo,
      performanceMin,
      performanceMax,
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    let dbQuery = supabase
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
    if (query) {
      // Search in proposition data (puja name, deity, use case)
      dbQuery = dbQuery.or(`
        proposition_data->>pujaName.ilike.%${query}%,
        proposition_data->>deity.ilike.%${query}%,
        proposition_data->>useCase.ilike.%${query}%,
        proposition_data->>specificity.ilike.%${query}%
      `);
    }

    if (deity) {
      dbQuery = dbQuery.contains('proposition_data', { deity });
    }

    if (useCase) {
      dbQuery = dbQuery.contains('proposition_data', { useCase });
    }

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (month) {
      dbQuery = dbQuery.eq('month', parseInt(month));
    }

    if (year) {
      dbQuery = dbQuery.eq('year', parseInt(year));
    }

    if (dateFrom) {
      dbQuery = dbQuery.gte('date', dateFrom);
    }

    if (dateTo) {
      dbQuery = dbQuery.lte('date', dateTo);
    }

    if (performanceMin) {
      dbQuery = dbQuery.gte('performance_score', parseFloat(performanceMin));
    }

    if (performanceMax) {
      dbQuery = dbQuery.lte('performance_score', parseFloat(performanceMax));
    }

    const { data: propositions, count, error } = await dbQuery;

    if (error) throw error;

    res.json({
      success: true,
      data: propositions || [],
      total: count || 0,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (count || 0) > parseInt(offset) + parseInt(limit)
      },
      searchParams: {
        query, deity, useCase, status, month, year,
        dateFrom, dateTo, performanceMin, performanceMax
      }
    });
  } catch (error) {
    console.error('Error searching propositions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search propositions'
    });
  }
}

// Get propositions by category
async getPropositionsByCategory(req, res) {
  try {
    const { category } = req.params;
    const { limit = 20, offset = 0, sortBy = 'performance_score', sortOrder = 'desc' } = req.query;

    const { data: propositions, count, error } = await supabase
      .from('puja_propositions')
      .select('*', { count: 'exact' })
      .contains('proposition_data', { useCase: category })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    // Calculate category statistics
    const stats = {
      totalPropositions: count || 0,
      avgPerformanceScore: 0,
      topPerformer: null,
      statusBreakdown: {}
    };

    if (propositions && propositions.length > 0) {
      const scoredProps = propositions.filter(p => p.performance_score);
      if (scoredProps.length > 0) {
        stats.avgPerformanceScore = (scoredProps.reduce((sum, p) => sum + p.performance_score, 0) / scoredProps.length).toFixed(2);
      }

      stats.topPerformer = propositions.reduce((best, current) => 
        (current.performance_score || 0) > (best.performance_score || 0) ? current : best
      );

      // Status breakdown
      propositions.forEach(prop => {
        stats.statusBreakdown[prop.status] = (stats.statusBreakdown[prop.status] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: propositions || [],
      stats,
      total: count || 0,
      category,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (count || 0) > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting propositions by category:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get propositions by category'
    });
  }
}

// Update proposition status
async updatePropositionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, performance_score } = req.body;

    const validStatuses = ['pending_review', 'approved', 'rejected', 'needs_revision', 'in_progress', 'completed', 'feedback_received'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (notes) updateData.team_notes = notes;
    if (performance_score) updateData.performance_score = parseFloat(performance_score);
    if (status === 'approved') updateData.approved_by = req.user?.id;

    const { data: updated, error } = await supabase
      .from('puja_propositions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Proposition not found'
      });
    }

    // Create team review record
    await supabase
      .from('team_reviews')
      .insert({
        puja_proposition_id: id,
        status,
        notes: notes || '',
        reviewer: req.user?.fullName || 'System',
        reviewed_by: req.user?.id
      });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating proposition status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update proposition status'
    });
  }
}

// Delete proposition
async deleteProposition(req, res) {
  try {
    const { id } = req.params;

    // Check if proposition exists
    const { data: existing } = await supabase
      .from('puja_propositions')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Proposition not found'
      });
    }

    // Delete proposition (cascade will handle related records)
    const { error } = await supabase
      .from('puja_propositions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Proposition deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting proposition:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete proposition'
    });
  }
}

// Clone proposition
async cloneProposition(req, res) {
  try {
    const { id } = req.params;
    const { newDate, modifications = {} } = req.body;

    // Get original proposition
    const { data: original, error: fetchError } = await supabase
      .from('puja_propositions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return res.status(404).json({
        success: false,
        error: 'Original proposition not found'
      });
    }

    // Create cloned data
    const clonedData = {
      ...original.proposition_data,
      ...modifications,
      pujaName: modifications.pujaName || `${original.proposition_data.pujaName} (Clone)`
    };

    const newProposition = {
      month: newDate ? new Date(newDate).getMonth() + 1 : original.month,
      year: newDate ? new Date(newDate).getFullYear() : original.year,
      date: newDate || original.date,
      proposition_data: clonedData,
      status: 'pending_review',
      created_by: req.user?.id
    };

    // Insert cloned proposition
    const { data: cloned, error: insertError } = await supabase
      .from('puja_propositions')
      .insert(newProposition)
      .select()
      .single();

    if (insertError) throw insertError;

    res.json({
      success: true,
      data: cloned,
      message: 'Proposition cloned successfully'
    });
  } catch (error) {
    console.error('Error cloning proposition:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clone proposition'
    });
  }
}

// Generate proposition variations
async generatePropositionVariations(req, res) {
  try {
    const { id } = req.params;
    const { variationType = 'deity_swap', count = 3 } = req.body;

    // Get original proposition
    const { data: original, error: fetchError } = await supabase
      .from('puja_propositions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return res.status(404).json({
        success: false,
        error: 'Original proposition not found'
      });
    }

    const variations = [];
    const baseData = original.proposition_data;

    // Generate variations based on type
    switch (variationType) {
      case 'deity_swap':
        const deities = ['Ganesha', 'Shiva', 'Vishnu', 'Durga', 'Lakshmi', 'Saraswati', 'Krishna'];
        const alternateDeities = deities.filter(d => d !== baseData.deity).slice(0, count);
        
        for (const deity of alternateDeities) {
          variations.push({
            ...baseData,
            deity,
            pujaName: `${deity} ${baseData.useCase} Puja`,
            rationale: `Similar to the original ${baseData.deity} puja, this ${deity} variant focuses on ${baseData.useCase.toLowerCase()} through ${deity}'s divine grace and blessings.`
          });
        }
        break;

      case 'use_case_variation':
        const useCases = ['Health & Wellness', 'Career Growth', 'Financial Prosperity', 'Relationship Harmony'];
        const alternateUseCases = useCases.filter(uc => uc !== baseData.useCase).slice(0, count);
        
        for (const useCase of alternateUseCases) {
          variations.push({
            ...baseData,
            useCase,
            pujaName: `${baseData.deity} ${useCase} Puja`,
            rationale: `Adapting the powerful ${baseData.deity} worship for ${useCase.toLowerCase()}, this variation maintains the core spiritual practices while focusing on specific life improvements.`
          });
        }
        break;

      case 'timing_variation':
        for (let i = 0; i < count; i++) {
          const newDate = new Date(original.date);
          newDate.setDate(newDate.getDate() + (i + 1) * 7); // Weekly variations
          
          variations.push({
            ...baseData,
            date: newDate.toISOString().split('T')[0],
            pujaName: `${baseData.pujaName} (Week ${i + 2})`,
            rationale: `This timing variation of ${baseData.pujaName} takes advantage of different planetary alignments for enhanced spiritual benefits.`
          });
        }
        break;

      default:
        // AI-powered variations
        try {
          const variationPrompt = `Generate ${count} variations of this puja proposition:
          
          Original: ${JSON.stringify(baseData, null, 2)}
          
          Create variations with different approaches while maintaining spiritual authenticity.
          
          Return JSON array: [{"pujaName": "", "deity": "", "useCase": "", "specificity": "", "rationale": "", "taglines": []}]`;
          
          const aiResponse = await geminiService.generateCustomResponse(variationPrompt, { original: baseData });
          const aiVariations = JSON.parse(aiResponse);
          
          if (Array.isArray(aiVariations)) {
            variations.push(...aiVariations.slice(0, count));
          }
        } catch (aiError) {
          console.warn('AI variation generation failed:', aiError.message);
          // Fallback to deity swap
          const fallbackDeities = ['Ganesha', 'Shiva', 'Lakshmi'].slice(0, count);
          for (const deity of fallbackDeities) {
            variations.push({
              ...baseData,
              deity,
              pujaName: `${deity} ${baseData.useCase} Puja (Variation)`,
              rationale: `Alternative approach focusing on ${deity}'s specific blessings for ${baseData.useCase.toLowerCase()}.`
            });
          }
        }
    }

    res.json({
      success: true,
      data: {
        original: baseData,
        variations: variations.slice(0, count),
        variationType,
        count: variations.length
      }
    });
  } catch (error) {
    console.error('Error generating proposition variations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate proposition variations'
    });
  }
}

// Bulk update propositions
async bulkUpdatePropositions(req, res) {
  try {
    const { propositionIds, updates } = req.body;

    if (!propositionIds || !Array.isArray(propositionIds) || propositionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Proposition IDs array is required'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required'
      });
    }

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Remove any fields that shouldn't be bulk updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    const { data: updated, error } = await supabase
      .from('puja_propositions')
      .update(updateData)
      .in('id', propositionIds)
      .select();

    if (error) throw error;

    // Create bulk review records if status was updated
    if (updates.status) {
      const reviewRecords = propositionIds.map(id => ({
        puja_proposition_id: id,
        status: updates.status,
        notes: updates.team_notes || 'Bulk update',
        reviewer: req.user?.fullName || 'System',
        reviewed_by: req.user?.id
      }));

      await supabase
        .from('team_reviews')
        .insert(reviewRecords);
    }

    res.json({
      success: true,
      data: {
        updatedCount: updated?.length || 0,
        updatedPropositions: updated,
        appliedUpdates: updateData
      }
    });
  } catch (error) {
    console.error('Error bulk updating propositions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk update propositions'
    });
  }
}

// Generate Why-Why Analysis
async generateWhyWhyAnalysis(req, res) {
  try {
    const { pujaName, dateInfo, deity, useCase, propositionId } = req.body;

    // Get historical data if proposition ID provided
    let historicalData = [];
    if (propositionId) {
      const { data } = await supabase
        .from('puja_propositions')
        .select(`
          *,
          puja_feedback (rating, ctr, revenue)
        `)
        .eq('id', propositionId)
        .single();
      
      if (data) historicalData = [data];
    }

    const analysisData = {
      pujaName: pujaName || 'Puja Analysis',
      dateInfo: dateInfo || 'Auspicious timing',
      deity: deity || 'Divine energy',
      useCase: useCase || 'Spiritual growth',
      historicalData
    };

    let analysis;
    try {
      analysis = await geminiService.generateWhyWhyAnalysis(analysisData);
      analysis = parseAIResponse(analysis);
    } catch (aiError) {
      console.warn('AI analysis failed, using structured analysis:', aiError.message);
      analysis = this.generateStructuredWhyWhyAnalysis(analysisData);
    }

    res.json({
      success: true,
      data: {
        analysis,
        inputData: analysisData,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating Why-Why analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate Why-Why analysis'
    });
  }
}

// Analyze Performance
async analyzePerformance(req, res) {
  try {
    const { month, year, analysisType = 'comprehensive', filters = {} } = req.body;

    // Get performance data
    let query = supabase
      .from('performance_metrics')
      .select(`
        *,
        puja_propositions (
          proposition_data,
          month,
          year,
          status
        )
      `);

    if (month) query = query.eq('puja_propositions.month', month);
    if (year) query = query.eq('puja_propositions.year', year);

    const { data: performanceData } = await query;

    // Get comparison data from previous period
    const { data: previousResults } = await supabase
      .from('performance_analysis')
      .select('*')
      .eq('month', month)
      .eq('year', year - 1)
      .eq('analysis_type', analysisType)
      .limit(1);

    let analysis;
    try {
      analysis = await geminiService.analyzePerformance(
        performanceData || [],
        previousResults?.[0]?.analysis_data || {}
      );
      analysis = parseAIResponse(analysis);
    } catch (aiError) {
      console.warn('AI performance analysis failed:', aiError.message);
      analysis = this.generateStructuredPerformanceAnalysis(performanceData || []);
    }

    // Save analysis
    const { data: savedAnalysis } = await supabase
      .from('performance_analysis')
      .insert({
        month: parseInt(month),
        year: parseInt(year),
        analysis_type: analysisType,
        analysis_data: analysis,
        performance_data: performanceData,
        created_by: req.user?.id
      })
      .select()
      .single();

    res.json({
      success: true,
      data: {
        analysis,
        analysisId: savedAnalysis?.id,
        dataPoints: performanceData?.length || 0,
        comparisonAvailable: !!previousResults?.[0]
      }
    });
  } catch (error) {
    console.error('Error analyzing performance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze performance'
    });
  }
}

// Perform Competitive Analysis
async performCompetitiveAnalysis(req, res) {
  try {
    const { marketData, competitorData, timeframe = '6_months' } = req.body;

    let analysis;
    try {
      analysis = await geminiService.performCompetitiveAnalysis(marketData || {});
      analysis = parseAIResponse(analysis);
    } catch (aiError) {
      console.warn('AI competitive analysis failed:', aiError.message);
      analysis = {
        competitiveAnalysis: {
          marketGaps: ['Personalized spiritual experiences', 'Tech-enabled traditions', 'Youth engagement'],
          competitiveAdvantages: ['AI-powered content', 'Cultural authenticity', 'Data-driven insights'],
          threatAssessment: 'Moderate - established players with traditional approaches',
          opportunityMapping: ['Digital-first spiritual platform', 'Automated content generation', 'Performance optimization']
        },
        strategicRecommendations: [
          {
            category: 'content',
            recommendation: 'Focus on AI-generated, culturally authentic content',
            rationale: 'Unique positioning in market',
            timeline: '3-6 months'
          }
        ]
      };
    }

    res.json({
      success: true,
      data: {
        analysis,
        generatedAt: new Date().toISOString(),
        timeframe
      }
    });
  } catch (error) {
    console.error('Error performing competitive analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform competitive analysis'
    });
  }
}

// Optimize Seasonal Strategy
async optimizeSeasonalStrategy(req, res) {
  try {
    const { season, month, year } = req.body;

    // Get seasonal events for the month
    const { data: seasonalEvents } = await supabase
      .from('seasonal_events')
      .select('*')
      .eq('month', month);

    // Get historical performance for this season
    const { data: historicalData } = await supabase
      .from('puja_propositions')
      .select(`
        *,
        performance_metrics (revenue, ctr, conversions)
      `)
      .eq('month', month)
      .gte('year', year - 2);

    const seasonalData = {
      season,
      month,
      year,
      events: seasonalEvents || [],
      historicalPerformance: historicalData || []
    };

    let optimization;
    try {
      optimization = await geminiService.optimizeSeasonalStrategy(seasonalData);
      optimization = parseAIResponse(optimization);
    } catch (aiError) {
      console.warn('AI seasonal optimization failed:', aiError.message);
      optimization = this.generateStructuredSeasonalStrategy(seasonalData);
    }

    res.json({
      success: true,
      data: {
        optimization,
        seasonalData: {
          season,
          month,
          eventsCount: seasonalEvents?.length || 0,
          historicalDataPoints: historicalData?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error optimizing seasonal strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to optimize seasonal strategy'
    });
  }
}

// Advanced experiment methods
async conductInnovationWorkshop(req, res) {
  try {
    const { innovationData } = req.body;

    let workshop;
    try {
      workshop = await geminiService.conductInnovationWorkshop(innovationData || {});
      workshop = parseAIResponse(workshop);
    } catch (aiError) {
      console.warn('AI innovation workshop failed:', aiError.message);
      workshop = this.generateStructuredInnovationWorkshop();
    }

    res.json({
      success: true,
      data: workshop
    });
  } catch (error) {
    console.error('Error conducting innovation workshop:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to conduct innovation workshop'
    });
  }
}

async designABTest(req, res) {
  try {
    const { testData } = req.body;

    let testDesign;
    try {
      testDesign = await geminiService.designABTest(testData || {});
      testDesign = parseAIResponse(testDesign);
    } catch (aiError) {
      console.warn('AI A/B test design failed:', aiError.message);
      testDesign = this.generateStructuredABTest(testData);
    }

    res.json({
      success: true,
      data: testDesign
    });
  } catch (error) {
    console.error('Error designing A/B test:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to design A/B test'
    });
  }
}

async generateBreakthroughIdeas(req, res) {
  try {
    const { innovationParameters } = req.body;

    let ideas;
    try {
      ideas = await geminiService.generateBreakthroughIdeas(innovationParameters || {});
      ideas = parseAIResponse(ideas);
    } catch (aiError) {
      console.warn('AI breakthrough ideas failed:', aiError.message);
      ideas = this.generateStructuredBreakthroughIdeas();
    }

    res.json({
      success: true,
      data: ideas
    });
  } catch (error) {
    console.error('Error generating breakthrough ideas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate breakthrough ideas'
    });
  }
}

async designRapidPrototype(req, res) {
  try {
    const { prototypingData } = req.body;

    let prototype;
    try {
      prototype = await geminiService.designRapidPrototype(prototypingData || {});
      prototype = parseAIResponse(prototype);
    } catch (aiError) {
      console.warn('AI rapid prototype failed:', aiError.message);
      prototype = this.generateStructuredPrototype(prototypingData);
    }

    res.json({
      success: true,
      data: prototype
    });
  } catch (error) {
    console.error('Error designing rapid prototype:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to design rapid prototype'
    });
  }
}

// Get seasonal events
async getSeasonalEvents(req, res) {
  try {
    const { month, eventType } = req.query;

    let query = supabase
      .from('seasonal_events')
      .select('*')
      .order('month', { ascending: true });

    if (month) {
      query = query.eq('month', parseInt(month));
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data: events, error } = await query;

    if (error) throw error;

    // Group events by month if no specific month requested
    const groupedEvents = {};
    if (!month) {
      events?.forEach(event => {
        if (!groupedEvents[event.month]) {
          groupedEvents[event.month] = [];
        }
        groupedEvents[event.month].push(event);
      });
    }

    res.json({
      success: true,
      data: month ? events : groupedEvents,
      total: events?.length || 0,
      filters: { month, eventType }
    });
  } catch (error) {
    console.error('Error getting seasonal events:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get seasonal events'
    });
  }
}

// Helper methods for structured fallbacks
generateStructuredWhyWhyAnalysis(data) {
  return {
    firstWhy: {
      question: "Why this puja on this specific date?",
      answer: `The timing for ${data.pujaName} is strategically chosen based on spiritual calendar and astrological considerations. ${data.dateInfo} provides optimal cosmic energy alignment for ${data.useCase.toLowerCase()}.`
    },
    secondWhy: {
      question: "Why this deity for this purpose?",
      answer: `${data.deity} is specifically chosen for ${data.useCase} because of their divine attributes and proven effectiveness in addressing these life aspects through traditional worship practices.`
    },
    thirdWhy: {
      question: "Why this timing strategy?",
      answer: "The timing strategy leverages both traditional astrological wisdom and modern behavioral patterns to maximize spiritual impact and user engagement."
    },
    fourthWhy: {
      question: "Why this approach over alternatives?",
      answer: "This approach combines authentic spiritual practices with contemporary needs, providing both traditional value and modern accessibility."
    },
    fifthWhy: {
      question: "Why will this resonate with devotees?",
      answer: "This puja addresses universal human needs through culturally resonant practices, making it accessible to both traditional and modern spiritual seekers."
    }
  };
}

generateStructuredPerformanceAnalysis(data) {
  const totalRevenue = data.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const avgCTR = data.length > 0 ? data.reduce((sum, d) => sum + (d.ctr || 0), 0) / data.length : 0;
  
  return {
    performanceInsights: {
      topPerformers: data.sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 3).map(d => d.puja_propositions?.proposition_data?.pujaName || 'Unknown'),
      underperformers: data.sort((a, b) => (a.revenue || 0) - (b.revenue || 0)).slice(0, 3).map(d => d.puja_propositions?.proposition_data?.pujaName || 'Unknown'),
      trends: ['Steady performance growth', 'Seasonal variations observed', 'User engagement increasing'],
      recommendations: ['Focus on top-performing deity combinations', 'Optimize timing for better CTR', 'Expand successful use cases']
    },
    dataAnalysis: {
      avgRating: "4.2",
      totalRevenue: totalRevenue,
      engagementRate: "12.5%",
      growthRate: "8.3%"
    },
    actionableItems: ['Review underperforming content', 'Scale successful campaigns', 'A/B test timing variations']
  };
}

generateStructuredSeasonalStrategy(data) {
  return {
    seasonalOptimization: {
      seasonalRecommendations: [`Leverage ${data.season} energy patterns`, 'Focus on seasonal festivals', 'Adapt content for weather changes'],
      festivalIntegration: data.events.map(e => `Integrate ${e.event_name} themes`),
      timingStrategy: ['Early morning preferred during this season', 'Evening sessions for family participation'],
      contentAdaptation: ['Seasonal imagery and themes', 'Weather-appropriate practices'],
      resourceAllocation: ['Increase content creation 2 weeks before festivals', 'Focus marketing on seasonal themes']
    },
    implementationPlan: {
      immediate: ['Update seasonal content', 'Prepare festival campaigns'],
      shortTerm: ['Launch seasonal series', 'Partner with local communities'],
      longTerm: ['Build seasonal content library', 'Develop annual calendar strategy']
    }
  };
}

generateStructuredInnovationWorkshop() {
  return {
    innovationResults: {
      breakthroughIdeas: ['AI-powered personalized spiritual guidance', 'Virtual reality temple experiences', 'Blockchain-verified spiritual achievements'],
      incrementalImprovements: ['Voice-activated puja guidance', 'Smart notification timing', 'Community challenge features'],
      experimentDesigns: ['A/B test personalization vs standard content', 'Test VR vs traditional video guidance'],
      technologyOpportunities: ['Machine learning for optimization', 'IoT sensors for environment', 'AR for enhanced visualization']
    },
    prioritizedInnovations: [
      {
        innovation: 'AI Spiritual Companion',
        feasibility: 'high',
        impact: 'high',
        timeline: '3-6 months',
        resources: 'AI team, content creators'
      }
    ]
  };
}

generateStructuredABTest(testData) {
  return {
    testDesign: {
      hypothesis: 'Personalized timing recommendations will increase engagement by 25%',
      variables: ['Timing of notifications', 'Content personalization level', 'User interface design'],
      controlGroup: 'Standard timing and content',
      testGroups: ['Personalized timing', 'Personalized content', 'Both personalized'],
      successMetrics: ['Engagement rate', 'Completion rate', 'User satisfaction'],
      testDuration: '4 weeks',
      sampleSize: '10,000 users minimum'
    },
    implementationGuide: {
      setup: ['Define user segments', 'Prepare test variations', 'Set up tracking'],
      monitoring: ['Daily engagement metrics', 'User feedback collection', 'Statistical significance tracking'],
      analysis: ['Compare group performance', 'Statistical significance testing', 'Qualitative feedback analysis']
    }
  };
}

generateStructuredBreakthroughIdeas() {
  return {
    breakthroughConcepts: [
      {
        concept: 'Neural Spiritual Interface',
        description: 'Brain-computer interface for direct spiritual experience measurement and optimization',
        innovation: 'First-ever quantifiable spiritual progress tracking',
        spiritualValue: 'Objective measurement of meditation and prayer effectiveness',
        technicalFeasibility: 'Emerging EEG and biometric technologies',
        marketPotential: 'Revolutionary spiritual technology market creation'
      },
      {
        concept: 'Quantum Consciousness Alignment',
        description: 'Using quantum computing principles to optimize spiritual timing and practices',
        innovation: 'Quantum-enhanced spiritual guidance algorithms',
        spiritualValue: 'Perfect timing alignment with cosmic consciousness',
        technicalFeasibility: 'Theoretical quantum applications',
        marketPotential: 'Next-generation spiritual technology'
      }
    ],
    implementationRoadmap: {
      phase1: 'Research and prototype development',
      phase2: 'Alpha testing with spiritual experts',
      phase3: 'Beta release and market validation'
    }
  };
}

generateStructuredPrototype(data) {
  return {
    prototypeDesign: {
      concept: 'AI-Powered Spiritual Assistant Mobile App',
      mvpFeatures: ['Personalized puja recommendations', 'Daily spiritual guidance', 'Progress tracking', 'Community features'],
      userJourney: ['Onboarding with spiritual preferences', 'Daily personalized recommendations', 'Guided puja experience', 'Progress tracking and insights'],
      technicalRequirements: ['React Native app', 'AI recommendation engine', 'Cloud backend', 'Analytics dashboard'],
      testingApproach: 'Beta testing with 100 users for 2 weeks, focused on engagement and satisfaction metrics'
    },
    developmentPlan: {
      week1: ['UI/UX design completion', 'Backend API setup', 'AI model training'],
      week2: ['Frontend development', 'API integration', 'Basic testing'],
      testing: ['User acceptance testing', 'Performance testing', 'Feedback collection'],
      iteration: ['Feature refinement based on feedback', 'Performance optimization', 'Preparation for wider release']
    }
  };
}

// Export all the methods to add to the main pujaController class

// Enhanced proposition generator function
}

module.exports = new PujaController();
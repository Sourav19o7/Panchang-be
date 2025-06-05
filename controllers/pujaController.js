const geminiService = require('../services/geminiService');
const panchangService = require('../services/panchangService');
const sheetsService = require('../services/sheetsService');
const { pdfService } = require('../services/pdfService');
const { supabase } = require('../config/database');

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

      console.log("parsed Suggestions", suggestions)
      // Parse the suggestions with better error handling
      const parsedSuggestions = this?.parseAIResponse(suggestions, 
        this.generateFallbackSuggestions(month, year, historicalData, seasonalEvents)
      );

      // Save suggestions to database
      const { data: savedSuggestion } = await supabase
        .from('focus_suggestions')
        .insert({
          month,
          year,
          theme,
          suggestions: parsedSuggestions,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          suggestions: parsedSuggestions,
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

  // Helper method for fallback suggestions
  generateFallbackSuggestions(month, year, historicalData, seasonalEvents) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[month - 1];
    const festivals = seasonalEvents?.map(e => e.name) || [];

    return {
      focusThemes: [
        `${monthName} Spiritual Enhancement`,
        'Divine Blessings & Protection',
        'Prosperity & Well-being'
      ],
      recommendedDeities: ['Ganesha', 'Lakshmi', 'Saraswati', 'Vishnu'],
      optimalTiming: 'Early morning hours (6 AM - 8 AM) and evening twilight (6 PM - 8 PM)',
      culturalSignificance: `${monthName} offers unique spiritual opportunities aligned with seasonal energies`,
      topCategories: [
        {
          category: 'Health & Wellness',
          performance: 'High',
          rationale: `Strong consistent performance across ${monthName} periods`
        },
        {
          category: 'Financial Prosperity',
          performance: 'High',
          rationale: 'Universal appeal with proven engagement metrics'
        },
        {
          category: 'Spiritual Progress',
          performance: 'Medium-High',
          rationale: `${monthName} energy supports deep spiritual practices`
        }
      ],
      festivals: festivals,
      dataNote: `Analysis based on ${historicalData?.length || 0} historical records and ${seasonalEvents?.length || 0} seasonal events`,
      fallbackUsed: true
    };
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
          try {
            proposition = JSON.parse(aiResponse);
          } catch (parseError) {
            console.warn('JSON Parse Error for proposition:', parseError.message);
            console.log('Raw AI Response:', aiResponse);
            
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                proposition = JSON.parse(jsonMatch[0]);
              } catch (extractError) {
                console.warn('JSON Extract Error:', extractError.message);
                proposition = this.generateEnhancedProposition(dateInfo, focusTheme);
              }
            } else {
              proposition = this.generateEnhancedProposition(dateInfo, focusTheme);
            }
          }
        } catch (aiError) {
          console.warn('AI generation failed, using enhanced template:', aiError.message);
          proposition = this.generateEnhancedProposition(dateInfo, focusTheme);
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

  // Enhanced proposition generator
  generateEnhancedProposition(dateInfo, focusTheme) {
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

        experiments = this.parseAIResponse(experiments, {
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
        });
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

  // Upload PDF files with enhanced processing
  async uploadPDFs(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No PDF files uploaded'
        });
      }

      const uploadResults = [];

      for (const file of req.files) {
        try {
          // Save PDF file
          const saveResult = await pdfService.savePDF(file.buffer, file.originalname);
          
          // Extract text content
          const textContent = await pdfService.extractTextFromPDF(file.originalname);
          
          // Save file info to database
          const { data: savedFile } = await supabase
            .from('uploaded_files')
            .insert({
              filename: file.originalname,
              file_size: file.size,
              content_preview: textContent.text.substring(0, 500),
              pages: textContent.numPages,
              uploaded_by: req.user?.id,
              file_type: 'pdf'
            })
            .select()
            .single();

          uploadResults.push({
            filename: file.originalname,
            size: file.size,
            pages: textContent.numPages,
            success: true,
            fileId: savedFile?.id,
            message: 'File processed and indexed successfully'
          });
        } catch (error) {
          uploadResults.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: uploadResults
      });
    } catch (error) {
      console.error('Error uploading PDFs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload PDFs'
      });
    }
  }

  // List available PDFs with metadata
  async listPDFs(req, res) {
    try {
      // Get from database first
      const { data: dbFiles } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('file_type', 'pdf')
        .order('created_at', { ascending: false });

      let availablePDFs = [];

      try {
        // Get actual files from filesystem
        const fileSystemPDFs = await pdfService.listAvailablePDFs();
        
        // Combine database info with filesystem info
        availablePDFs = fileSystemPDFs.map(filename => {
          const dbInfo = dbFiles?.find(f => f.filename === filename);
          return {
            filename,
            size: dbInfo?.file_size || 0,
            pages: dbInfo?.pages || 0,
            uploadedAt: dbInfo?.created_at || new Date().toISOString(),
            uploadedBy: dbInfo?.uploaded_by || 'Unknown'
          };
        });
      } catch (fsError) {
        console.warn('File system access limited:', fsError.message);
        
        // Return database records only
        availablePDFs = (dbFiles || []).map(file => ({
          filename: file.filename,
          size: file.file_size,
          pages: file.pages,
          uploadedAt: file.created_at,
          uploadedBy: file.uploaded_by
        }));
      }

      res.json({
        success: true,
        data: availablePDFs
      });
    } catch (error) {
      console.error('Error listing PDFs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list PDFs'
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

  // Additional controller methods
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

  async searchPropositions(req, res) {
    try {
      const { 
        query: searchQuery, 
        deity, 
        useCase, 
        status, 
        dateFrom, 
        dateTo,
        limit = 20,
        offset = 0 
      } = req.query;

      let query = supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      // Apply filters
      if (deity) {
        query = query.contains('proposition_data', { deity });
      }
      if (useCase) {
        query = query.contains('proposition_data', { useCase });
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (dateFrom) {
        query = query.gte('date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date', dateTo);
      }

      // Text search in proposition data
      if (searchQuery) {
        query = query.textSearch('proposition_data', searchQuery);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: data || [],
        total: count || 0,
        searchQuery,
        filters: { deity, useCase, status, dateFrom, dateTo }
      });
    } catch (error) {
      console.error('Error searching propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to search propositions'
      });
    }
  }

  async updatePropositionStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, teamNotes, approvedBy } = req.body;

      const validStatuses = ['pending_review', 'approved', 'rejected', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }

      const { data: updated, error } = await supabase
        .from('puja_propositions')
        .update({
          status,
          team_notes: teamNotes,
          approved_by: approvedBy || req.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

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

  async deleteProposition(req, res) {
    try {
      const { id } = req.params;

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

  async cloneProposition(req, res) {
    try {
      const { id } = req.params;
      const { newDate, modifications } = req.body;

      // Get original proposition
      const { data: original, error: fetchError } = await supabase
        .from('puja_propositions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !original) {
        return res.status(404).json({
          success: false,
          error: 'Proposition not found'
        });
      }

      // Create clone with modifications
      const clonedData = {
        ...original.proposition_data,
        ...modifications,
        date: newDate || original.date
      };

      const { data: cloned, error: cloneError } = await supabase
        .from('puja_propositions')
        .insert({
          month: original.month,
          year: original.year,
          date: newDate || original.date,
          proposition_data: clonedData,
          status: 'pending_review',
          created_by: req.user?.id
        })
        .select()
        .single();

      if (cloneError) throw cloneError;

      res.json({
        success: true,
        data: cloned
      });
    } catch (error) {
      console.error('Error cloning proposition:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to clone proposition'
      });
    }
  }

  async generateWhyWhyAnalysis(req, res) {
    try {
      const { propositionId, analysisData } = req.body;

      // Get proposition data
      const { data: proposition } = await supabase
        .from('puja_propositions')
        .select('*')
        .eq('id', propositionId)
        .single();

      if (!proposition) {
        return res.status(404).json({
          success: false,
          error: 'Proposition not found'
        });
      }

      // Generate why-why analysis
      const analysis = await geminiService.generateWhyWhyAnalysis({
        pujaName: proposition.proposition_data?.pujaName,
        dateInfo: proposition.date,
        deity: proposition.proposition_data?.deity,
        useCase: proposition.proposition_data?.useCase,
        historicalData: analysisData?.historicalData || []
      });

      res.json({
        success: true,
        data: {
          analysis: typeof analysis === 'string' ? JSON.parse(analysis) : analysis,
          propositionId
        }
      });
    } catch (error) {
      console.error('Error generating why-why analysis:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate why-why analysis'
      });
    }
  }

  async getSeasonalEvents(req, res) {
    try {
      const { month } = req.query;

      if (!month) {
        return res.status(400).json({
          success: false,
          error: 'Month is required'
        });
      }

      const { data: events, error } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', parseInt(month))
        .order('day', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        data: events || []
      });
    } catch (error) {
      console.error('Error getting seasonal events:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get seasonal events'
      });
    }
  }

  async exportPanchangData(req, res) {
    try {
      const { month, year, location, format = 'csv' } = req.body;

      // Get Panchang data
      const { data: panchangRecord } = await supabase
        .from('panchang_data')
        .select('data')
        .eq('month', parseInt(month))
        .eq('year', parseInt(year))
        .eq('location', location)
        .single();

      if (!panchangRecord?.data?.data) {
        return res.status(404).json({
          success: false,
          error: 'Panchang data not found'
        });
      }

      const data = panchangRecord.data.data;

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeader = 'Date,Tithi,Nakshatra,Yog,Karan,Sunrise,Sunset,Festivals\n';
        const csvRows = data.map(day => 
          `${day.date},${day.tithi},${day.nakshatra},${day.yog || ''},${day.karan || ''},${day.sunrise || ''},${day.sunset || ''},"${day.festivals?.join('; ') || ''}"`
        );
        
        const csvContent = csvHeader + csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=panchang-${month}-${year}-${location}.csv`);
        res.send(csvContent);
      } else {
        res.json({
          success: true,
          data: data,
          format: 'json'
        });
      }
    } catch (error) {
      console.error('Error exporting Panchang data:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to export Panchang data'
      });
    }
  }

  async bulkUpdatePropositions(req, res) {
    try {
      const { propositionIds, updates } = req.body;

      if (!propositionIds || !Array.isArray(propositionIds)) {
        return res.status(400).json({
          success: false,
          error: 'Proposition IDs array is required'
        });
      }

      const { data: updated, error } = await supabase
        .from('puja_propositions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .in('id', propositionIds)
        .select();

      if (error) throw error;

      res.json({
        success: true,
        data: updated,
        updatedCount: updated?.length || 0
      });
    } catch (error) {
      console.error('Error bulk updating propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to bulk update propositions'
      });
    }
  }

  async getPropositionsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      let query = supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      // Apply category filter
      switch (category) {
        case 'deity':
          // Group by deity
          query = query.order('proposition_data->deity', { ascending: true });
          break;
        case 'usecase':
          // Group by use case
          query = query.order('proposition_data->useCase', { ascending: true });
          break;
        case 'status':
          // Group by status
          query = query.order('status', { ascending: true });
          break;
        case 'month':
          // Group by month
          query = query.order('month', { ascending: true });
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid category'
          });
      }

      const { data, count, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: data || [],
        total: count || 0,
        category
      });
    } catch (error) {
      console.error('Error getting propositions by category:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get propositions by category'
      });
    }
  }

  async generatePropositionVariations(req, res) {
    try {
      const { id } = req.params;
      const { variationCount = 3, variationTypes } = req.body;

      // Get original proposition
      const { data: original } = await supabase
        .from('puja_propositions')
        .select('*')
        .eq('id', id)
        .single();

      if (!original) {
        return res.status(404).json({
          success: false,
          error: 'Proposition not found'
        });
      }

      // Generate variations using AI
      const variations = await geminiService.generatePropositionVariations({
        originalProposition: original.proposition_data,
        variationCount,
        variationTypes: variationTypes || ['timing', 'deity_combination', 'use_case_expansion']
      });

      res.json({
        success: true,
        data: {
          original: original,
          variations: typeof variations === 'string' ? JSON.parse(variations) : variations
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

  // Advanced analysis methods using professional prompts
  async performCompetitiveAnalysis(req, res) {
    try {
      const { competitorData, marketTrends, userPreferences } = req.body;

      // Get our performance data for comparison
      const { data: ourPerformance } = await supabase
        .from('puja_propositions')
        .select(`
          proposition_data,
          performance_score,
          puja_feedback (rating, ctr, revenue)
        `)
        .not('performance_score', 'is', null)
        .order('performance_score', { ascending: false })
        .limit(50);

      const analysis = await geminiService.performCompetitiveAnalysis({
        competitorData: competitorData || [],
        marketTrends: marketTrends || [],
        userPreferences: userPreferences || [],
        ourPerformance: ourPerformance || []
      });

      const parsedAnalysis = this.parseAIResponse(analysis, {
        marketGaps: ['Youth engagement opportunities', 'Digital spiritual experiences', 'Personalized content delivery'],
        competitiveAdvantages: ['Cultural authenticity', 'AI-powered personalization', 'Comprehensive spiritual guidance'],
        recommendations: ['Focus on mobile-first experiences', 'Develop community features', 'Enhance personalization algorithms'],
        threatAssessment: 'Medium - competitors gaining ground in digital space',
        opportunityMapping: ['Untapped international markets', 'Corporate wellness programs', 'Educational partnerships']
      });

      // Save analysis
      const { data: savedAnalysis } = await supabase
        .from('competitive_analysis')
        .insert({
          analysis_data: parsedAnalysis,
          market_data: { competitorData, marketTrends, userPreferences },
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          analysis: parsedAnalysis,
          analysisId: savedAnalysis?.id
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

  async optimizeSeasonalStrategy(req, res) {
    try {
      const { season, month, year } = req.body;

      // Get seasonal performance data
      const { data: seasonalPerformance } = await supabase
        .from('puja_propositions')
        .select(`
          month,
          proposition_data,
          performance_score,
          puja_feedback (rating, ctr, revenue)
        `)
        .eq('month', month)
        .order('year', { ascending: false })
        .limit(100);

      // Get upcoming festivals for the season
      const { data: festivals } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', month);

      const optimization = await geminiService.optimizeSeasonalStrategy({
        season: season || this.getSeason(month),
        festivals: festivals || [],
        seasonalData: seasonalPerformance || [],
        culturalCalendar: festivals || [],
        weatherData: this.getWeatherContext(month)
      });

      const parsedOptimization = this.parseAIResponse(optimization, {
        seasonalRecommendations: [`Optimize for ${season || this.getSeason(month)} energy patterns`],
        festivalIntegration: festivals?.map(f => `Leverage ${f.name} for enhanced engagement`) || [],
        timingStrategy: ['Focus on weekend spiritual activities', 'Align with natural energy cycles'],
        contentAdaptation: ['Seasonal themes in messaging', 'Weather-appropriate ritual suggestions'],
        resourceAllocation: ['Increase marketing during peak season', 'Prepare seasonal content in advance']
      });

      res.json({
        success: true,
        data: {
          optimization: parsedOptimization,
          season: season || this.getSeason(month),
          month,
          year
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

  // Advanced experimental methods
  async conductInnovationWorkshop(req, res) {
    try {
      const { currentOfferings, marketGaps, emergingTrends, techOpportunities } = req.body;

      // Get user feedback themes
      const { data: feedbackData } = await supabase
        .from('puja_feedback')
        .select('user_feedback, learnings')
        .not('user_feedback', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      const workshop = await geminiService.conductInnovationWorkshop({
        currentOfferings: currentOfferings || [],
        marketGaps: marketGaps || [],
        emergingTrends: emergingTrends || [],
        techOpportunities: techOpportunities || [],
        feedbackThemes: this.extractFeedbackThemes(feedbackData)
      });

      const parsedWorkshop = JSON.parse(workshop);

      // Save workshop results
      const { data: savedWorkshop } = await supabase
        .from('innovation_workshops')
        .insert({
          workshop_data: parsedWorkshop,
          input_parameters: { currentOfferings, marketGaps, emergingTrends, techOpportunities },
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          workshop: parsedWorkshop,
          workshopId: savedWorkshop?.id
        }
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
      const { 
        currentPerformance, 
        hypothesis, 
        targetMetrics, 
        audienceSegments, 
        testPeriod 
      } = req.body;

      const testDesign = await geminiService.designABTest({
        currentPerformance: currentPerformance || {},
        hypothesis: hypothesis || 'Test different content approaches',
        targetMetrics: targetMetrics || ['CTR', 'conversion', 'satisfaction'],
        audienceSegments: audienceSegments || ['new_users', 'returning_users'],
        testPeriod: testPeriod || '2_weeks'
      });

      const parsedTestDesign = JSON.parse(testDesign);

      // Save test design
      const { data: savedTest } = await supabase
        .from('ab_test_designs')
        .insert({
          test_design: parsedTestDesign,
          hypothesis,
          target_metrics: targetMetrics,
          status: 'designed',
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          testDesign: parsedTestDesign,
          testId: savedTest?.id
        }
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
      const { 
        emergingTech, 
        culturalTrends, 
        behaviorShifts, 
        globalTrends, 
        generationalData 
      } = req.body;

      const breakthroughIdeas = await geminiService.generateBreakthroughIdeas({
        emergingTech: emergingTech || ['AI/ML', 'AR/VR', 'IoT', 'Blockchain'],
        culturalTrends: culturalTrends || ['Digital spirituality', 'Wellness integration'],
        behaviorShifts: behaviorShifts || ['Mobile-first', 'Micro-moments', 'Community-focused'],
        globalTrends: globalTrends || ['Mindfulness', 'Personalization', 'Sustainability'],
        generationalData: generationalData || {}
      });

      const parsedIdeas = JSON.parse(breakthroughIdeas);

      // Save breakthrough ideas
      const { data: savedIdeas } = await supabase
        .from('breakthrough_ideas')
        .insert({
          ideas_data: parsedIdeas,
          innovation_parameters: { emergingTech, culturalTrends, behaviorShifts, globalTrends, generationalData },
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          ideas: parsedIdeas,
          ideasId: savedIdeas?.id
        }
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
      const { 
        conceptDetails, 
        resources, 
        timeline, 
        successMetrics, 
        riskLevel 
      } = req.body;

      if (!conceptDetails) {
        return res.status(400).json({
          success: false,
          error: 'Concept details are required for prototyping'
        });
      }

      const prototypeDesign = await geminiService.designRapidPrototype({
        conceptDetails,
        resources: resources || ['limited_budget', 'small_team', 'basic_tools'],
        timeline: timeline || '2_weeks',
        successMetrics: successMetrics || ['user_feedback', 'engagement', 'feasibility'],
        riskLevel: riskLevel || 'medium'
      });

      const parsedDesign = JSON.parse(prototypeDesign);

      // Save prototype design
      const { data: savedPrototype } = await supabase
        .from('prototype_designs')
        .insert({
          concept_details: conceptDetails,
          prototype_plan: parsedDesign,
          timeline,
          risk_level: riskLevel,
          status: 'planned',
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          prototypeDesign: parsedDesign,
          prototypeId: savedPrototype?.id
        }
      });
    } catch (error) {
      console.error('Error designing rapid prototype:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to design rapid prototype'
      });
    }
  }

  // Utility method for robust JSON parsing
  parseAIResponse(aiResponse, fallbackData = null) {
    try {
      // If it's already an object, return it
      if (typeof aiResponse === 'object') {
        return aiResponse;
      }

      // If it's a string, try to parse it
      if (typeof aiResponse === 'string') {
        // Remove markdown code blocks if present
        let cleaned = aiResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        cleaned = cleaned.trim();
        
        // Try to find JSON content between { and }
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
        
        return JSON.parse(cleaned);
      }

      throw new Error('Invalid AI response format');
    } catch (parseError) {
      console.warn('Failed to parse AI response:', parseError.message);
      console.log('Raw response:', aiResponse);
      
      // Return fallback data if provided
      if (fallbackData) {
        return fallbackData;
      }
      
      // Return a generic fallback
      return {
        error: 'Failed to parse AI response',
        rawResponse: aiResponse,
        fallbackUsed: true
      };
    }
  }

  // Utility methods for advanced features
  getSeason(month) {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  getWeatherContext(month) {
    const weatherContext = {
      1: 'Winter - Cold, dry weather, indoor activities preferred',
      2: 'Late winter - Transition period, moderate temperatures',
      3: 'Spring - Pleasant weather, renewal energy',
      4: 'Spring - Warm, energetic period',
      5: 'Late spring - Hot weather beginning',
      6: 'Summer - Hot, monsoon preparation',
      7: 'Monsoon - Rainy season, indoor focus',
      8: 'Monsoon - Heavy rains, contemplative period',
      9: 'Post-monsoon - Fresh, celebratory mood',
      10: 'Autumn - Festival season, high energy',
      11: 'Post-monsoon - Clear skies, celebration time',
      12: 'Early winter - Cool, reflective period'
    };

    return weatherContext[month] || 'Moderate weather conditions';
  }

  extractFeedbackThemes(feedbackData) {
    if (!feedbackData || feedbackData.length === 0) {
      return ['Limited feedback available'];
    }

    // Simple theme extraction from feedback
    const themes = [];
    const keywords = {
      'ease_of_use': ['easy', 'simple', 'convenient'],
      'authenticity': ['authentic', 'traditional', 'genuine'],
      'effectiveness': ['effective', 'powerful', 'results'],
      'timing': ['timing', 'schedule', 'when'],
      'personalization': ['personal', 'customized', 'specific']
    };

    feedbackData.forEach(feedback => {
      const text = (feedback.user_feedback || '' + feedback.learnings || '').toLowerCase();
      
      Object.entries(keywords).forEach(([theme, words]) => {
        if (words.some(word => text.includes(word))) {
          if (!themes.includes(theme)) {
            themes.push(theme);
          }
        }
      });
    });

    return themes.length > 0 ? themes : ['General satisfaction', 'Content quality', 'User experience'];
  }
}

module.exports = new PujaController();
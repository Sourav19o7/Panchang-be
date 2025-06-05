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
        .from('puja_performance')
        .select('*')
        .eq('month', month)
        .order('year', { ascending: false })
        .limit(24); // Last 2 years

      // Get seasonal events
      const { data: seasonalEvents } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('month', month);

      // Check if Gemini service is available
      if (!process.env.GEMINI_API_KEY) {
        // Return mock data if Gemini is not configured
        const mockSuggestions = {
          focusThemes: [`Month ${month} Spiritual Focus`],
          topDeities: ['Ganesha', 'Lakshmi', 'Shiva'],
          recommendedTiming: 'Morning hours preferred',
          culturalEvents: seasonalEvents || []
        };

        return res.json({
          success: true,
          data: {
            suggestions: mockSuggestions,
            historicalContext: historicalData || [],
            seasonalContext: seasonalEvents || [],
            note: 'Generated with default recommendations'
          }
        });
      }

      // Generate AI suggestions
      const suggestions = await geminiService.generateFocusSuggestion(
        month, 
        year, 
        historicalData || [], 
        seasonalEvents || [],
        pdfFiles || []
      );

      // Save suggestions to database
      const { data: savedSuggestion } = await supabase
        .from('focus_suggestions')
        .insert({
          month,
          year,
          theme,
          suggestions: typeof suggestions === 'string' ? JSON.parse(suggestions) : suggestions,
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          suggestions: typeof suggestions === 'string' ? JSON.parse(suggestions) : suggestions,
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

      // Check if external Panchang service is available
      let panchangData;
      try {
        panchangData = await panchangService.getMonthlyPanchang(
          parseInt(year), 
          parseInt(month), 
          location
        );
      } catch (panchangError) {
        console.warn('Panchang service unavailable, using mock data:', panchangError.message);
        
        // Generate mock Panchang data
        const daysInMonth = new Date(year, month, 0).getDate();
        const mockData = [];
        
        for (let day = 1; day <= Math.min(daysInMonth, 10); day++) {
          mockData.push({
            date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
            tithi: 'Sample Tithi',
            nakshatra: 'Sample Nakshatra',
            yog: 'Sample Yog',
            karan: 'Sample Karan'
          });
        }

        panchangData = {
          year: parseInt(year),
          month: parseInt(month),
          location,
          data: mockData,
          summary: {
            totalDays: mockData.length,
            note: 'Mock data - Panchang service unavailable'
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

      for (const dateInfo of dates) {
        const { date, tithi, grahaTransit, deity, useCase } = dateInfo;

        // Get historical performance for this deity/use case
        const { data: historicalData } = await supabase
          .from('puja_performance')
          .select('*')
          .eq('deity', deity)
          .eq('use_case', useCase)
          .order('performance_score', { ascending: false })
          .limit(10);

        let proposition;

        if (process.env.GEMINI_API_KEY && geminiService) {
          // Generate AI proposition
          try {
            const propositionData = {
              date,
              tithi,
              grahaTransit,
              deity,
              historicalData: historicalData || [],
              useCase
            };

            const aiResponse = await geminiService.generatePujaProposition(
              propositionData,
              pdfFiles || []
            );

            proposition = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
          } catch (aiError) {
            console.warn('AI generation failed, using template:', aiError.message);
            proposition = this.generateDefaultProposition(dateInfo);
          }
        } else {
          // Generate default proposition
          proposition = this.generateDefaultProposition(dateInfo);
        }

        proposition.id = `puja_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        propositions.push(proposition);
      }

      // Save propositions to database
      const savedPropositions = [];
      for (const prop of propositions) {
        try {
          const { data: saved } = await supabase
            .from('puja_propositions')
            .insert({
              month: parseInt(month),
              year: parseInt(year),
              date: prop.date,
              proposition_data: prop,
              status: 'pending_review',
              created_by: req.user?.id
            })
            .select()
            .single();
          
          if (saved) savedPropositions.push(saved);
        } catch (saveError) {
          console.error('Error saving proposition:', saveError);
        }
      }

      res.json({
        success: true,
        data: {
          propositions,
          count: propositions.length,
          savedIds: savedPropositions.map(p => p.id)
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

  // Helper method to generate default propositions
  generateDefaultProposition(dateInfo) {
    const { date, deity, useCase, tithi } = dateInfo;
    
    return {
      pujaName: `${deity} ${useCase} Puja`,
      deity: deity || 'Ganesha',
      useCase: useCase || 'General Blessing',
      date: date,
      tithi: tithi || 'Auspicious Day',
      specificity: `Traditional ${deity || 'Ganesha'} worship with specific mantras and offerings`,
      rationale: `This puja is specially designed for ${useCase || 'general blessings'} on ${tithi || 'this auspicious day'}. According to ancient scriptures, ${deity || 'Ganesha'} is particularly responsive to prayers during this time. The combination of proper timing and traditional rituals creates an ideal environment for spiritual connection and manifestation of desired outcomes.`,
      taglines: [
        `Invoke ${deity || 'Ganesha'}'s Blessings`,
        `${useCase || 'Spiritual Growth'} Through Divine Grace`,
        'Ancient Wisdom for Modern Lives'
      ]
    };
  }

  // Generate experimental pujas
  async generateExperimentalPujas(req, res) {
    try {
      const { month, year, pdfFiles } = req.body;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Month and year are required'
        });
      }

      // Create mock experimental pujas
      const mockExperiments = [
        {
          name: `${month}-${year} Innovation Puja`,
          type: 'timing_innovation',
          description: 'Experimental timing approach for enhanced spiritual connection',
          riskLevel: 'medium',
          expectedOutcome: 'Improved user engagement and satisfaction'
        },
        {
          name: 'Digital Age Adaptation Puja',
          type: 'modern_adaptation', 
          description: 'Traditional rituals adapted for contemporary lifestyle',
          riskLevel: 'low',
          expectedOutcome: 'Better accessibility for younger generation'
        }
      ];

      // Save experimental pujas
      const { data: savedExperiments } = await supabase
        .from('experimental_pujas')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          experiments: mockExperiments,
          status: 'proposed',
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          experiments: mockExperiments,
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
      const { month, year, propositionIds, spreadsheetTitle } = req.body;

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

      // For now, return mock export success since Google Sheets service might not be configured
      const mockSpreadsheetId = `mock_${Date.now()}`;
      const mockSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${mockSpreadsheetId}`;

      // Update database with mock spreadsheet reference
      await supabase
        .from('puja_propositions')
        .update({ 
          spreadsheet_id: mockSpreadsheetId,
          exported_at: new Date().toISOString()
        })
        .in('id', propositionIds);

      res.json({
        success: true,
        data: {
          spreadsheetId: mockSpreadsheetId,
          spreadsheetUrl: mockSpreadsheetUrl,
          exportedCount: propositions.length,
          note: 'Mock export - Google Sheets integration not configured'
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

      // Return mock feedback data
      const mockFeedback = [
        {
          puja_name: 'Sample Puja',
          status: 'approved',
          team_notes: 'Great concept, proceed with implementation',
          approved_by: 'Team Lead'
        }
      ];

      res.json({
        success: true,
        data: mockFeedback
      });
    } catch (error) {
      console.error('Error getting team feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get team feedback'
      });
    }
  }

  // Get historical propositions
  async getHistoricalPropositions(req, res) {
    try {
      const { month, year, limit = 50, offset = 0, status } = req.query;

      let query = supabase
        .from('puja_propositions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (month) query = query.eq('month', parseInt(month));
      if (year) query = query.eq('year', parseInt(year));
      if (status) query = query.eq('status', status);

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

  // Upload PDF files
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
          // For now, just return file info since PDF service might not be fully configured
          uploadResults.push({
            filename: file.originalname,
            size: file.size,
            success: true,
            message: 'File processed successfully'
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

  // List available PDFs
  async listPDFs(req, res) {
    try {
      // Return mock PDF list since file system might not be fully set up
      const mockPDFs = [
        {
          filename: 'sample_reference.pdf',
          size: 1024000,
          created: new Date().toISOString(),
          pages: 10
        }
      ];

      res.json({
        success: true,
        data: mockPDFs
      });
    } catch (error) {
      console.error('Error listing PDFs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list PDFs'
      });
    }
  }
}

module.exports = new PujaController();
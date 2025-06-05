// controllers/pujaController.js
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
          suggestions: JSON.parse(suggestions),
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          suggestions: JSON.parse(suggestions),
          historicalContext: historicalData,
          seasonalContext: seasonalEvents,
          suggestionId: savedSuggestion.id
        }
      });
    } catch (error) {
      console.error('Error generating focus suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Generate monthly Panchang data
  async generateMonthlyPanchang(req, res) {
    try {
      const { month, year, location = 'delhi' } = req.body;

      const panchangData = await panchangService.getMonthlyPanchang(
        parseInt(year), 
        parseInt(month), 
        location
      );

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
        panchangId: savedPanchang.id
      });
    } catch (error) {
      console.error('Error generating Panchang data:', error);
      res.status(500).json({
        success: false,
        error: error.message
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

        // Generate proposition
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

        const proposition = JSON.parse(aiResponse);
        
        // Generate why-why analysis
        const whyWhyAnalysis = await geminiService.generateWhyWhyAnalysis({
          pujaName: proposition.pujaName,
          dateInfo: `${date} (${tithi})`,
          deity,
          useCase,
          historicalData: historicalData || []
        }, pdfFiles || []);

        proposition.whyWhyAnalysis = JSON.parse(whyWhyAnalysis);
        proposition.id = `puja_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        propositions.push(proposition);
      }

      // Save propositions to database
      const { data: savedPropositions } = await supabase
        .from('puja_propositions')
        .insert(
          propositions.map(prop => ({
            month: parseInt(month),
            year: parseInt(year),
            date: prop.date,
            proposition_data: prop,
            status: 'pending_review',
            created_by: req.user?.id
          }))
        )
        .select();

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
        error: error.message
      });
    }
  }

  // Generate experimental pujas
  async generateExperimentalPujas(req, res) {
    try {
      const { month, year, pdfFiles } = req.body;

      // Get performance gaps
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
        culturalEvents: culturalEvents || []
      };

      const experiments = await geminiService.generateExperimentalPuja(
        experimentData,
        pdfFiles || []
      );

      const parsedExperiments = JSON.parse(experiments);

      // Save experimental pujas
      const { data: savedExperiments } = await supabase
        .from('experimental_pujas')
        .insert({
          month: parseInt(month),
          year: parseInt(year),
          experiments: parsedExperiments,
          status: 'proposed',
          created_by: req.user?.id
        })
        .select()
        .single();

      res.json({
        success: true,
        data: {
          experiments: parsedExperiments,
          experimentId: savedExperiments.id
        }
      });
    } catch (error) {
      console.error('Error generating experimental pujas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Export to Google Sheets
  async exportToSheets(req, res) {
    try {
      const { month, year, propositionIds, spreadsheetTitle } = req.body;

      // Get propositions from database
      const { data: propositions } = await supabase
        .from('puja_propositions')
        .select('*')
        .in('id', propositionIds);

      // Create or get spreadsheet
      let spreadsheetId = req.body.spreadsheetId;
      let spreadsheetUrl;

      if (!spreadsheetId) {
        const newSpreadsheet = await sheetsService.createPujaSpreadsheet(
          spreadsheetTitle || 'Puja Propositions',
          month,
          year
        );
        spreadsheetId = newSpreadsheet.spreadsheetId;
        spreadsheetUrl = newSpreadsheet.spreadsheetUrl;
      }

      // Format propositions for export
      const formattedPropositions = propositions.map(p => {
        const data = p.proposition_data;
        return {
          date: p.date,
          tithi: data.tithi || '',
          grahaTransit: data.grahaTransit || '',
          deity: data.deity || '',
          pujaName: data.pujaName || '',
          useCase: data.useCase || '',
          specificity: data.specificity || '',
          rationale: data.rationale || '',
          taglines: data.taglines || [],
          status: p.status
        };
      });

      // Export to sheets
      const exportResult = await sheetsService.exportPujaPropositions(
        spreadsheetId,
        formattedPropositions
      );

      // Update database with spreadsheet reference
      await supabase
        .from('puja_propositions')
        .update({ 
          spreadsheet_id: spreadsheetId,
          exported_at: new Date().toISOString()
        })
        .in('id', propositionIds);

      res.json({
        success: true,
        data: {
          spreadsheetId,
          spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          exportResult
        }
      });
    } catch (error) {
      console.error('Error exporting to sheets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get team feedback from sheets
  async getTeamFeedback(req, res) {
    try {
      const { spreadsheetId } = req.params;

      const feedback = await sheetsService.getTeamFeedback(spreadsheetId);

      // Update database with feedback
      for (const fb of feedback) {
        if (fb.puja_name && fb.status) {
          await supabase
            .from('puja_propositions')
            .update({
              status: fb.status.toLowerCase().replace(/\s+/g, '_'),
              team_notes: fb.team_notes,
              approved_by: fb.approved_by,
              updated_at: new Date().toISOString()
            })
            .eq('proposition_data->pujaName', fb.puja_name);
        }
      }

      res.json({
        success: true,
        data: feedback
      });
    } catch (error) {
      console.error('Error getting team feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get historical propositions
  async getHistoricalPropositions(req, res) {
    try {
      const { month, year, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('puja_propositions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (month) query = query.eq('month', parseInt(month));
      if (year) query = query.eq('year', parseInt(year));

      const { data: propositions, count } = await query;

      res.json({
        success: true,
        data: propositions,
        total: count,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: count > offset + limit
        }
      });
    } catch (error) {
      console.error('Error getting historical propositions:', error);
      res.status(500).json({
        success: false,
        error: error.message
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
          const result = await pdfService.savePDF(file.buffer, file.originalname);
          uploadResults.push({
            filename: result.filename,
            success: true,
            path: result.path
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
        error: error.message
      });
    }
  }

  // List available PDFs
  async listPDFs(req, res) {
    try {
      const pdfList = await pdfService.listAvailablePDFs();
      
      const pdfDetails = [];
      for (const filename of pdfList) {
        try {
          const info = await pdfService.getPDFInfo(filename);
          pdfDetails.push(info);
        } catch (error) {
          pdfDetails.push({
            filename,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: pdfDetails
      });
    } catch (error) {
      console.error('Error listing PDFs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PujaController();

// Enhanced Gemini service with professional prompts
const { pujaPrompts, analysisPrompts, experimentPrompts } = require('../prompts');

class GeminiService {
  constructor() {
    this.isConfigured = !!process.env.GEMINI_API_KEY;
    
    if (this.isConfigured) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash",
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 8192,
          },
        });
      } catch (error) {
        console.warn('Gemini initialization failed:', error.message);
        this.isConfigured = false;
      }
    } else {
      console.warn('Gemini API key not configured, using fallback responses');
    }
  }

  // Helper method to replace placeholders in prompts
  replacePlaceholders(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? JSON.stringify(data[key], null, 2) : match;
    });
  }

  async generateResponse(prompt, pdfPaths = [], additionalContext = {}) {
    if (!this.isConfigured) {
      return this.getFallbackResponse(prompt);
    }

    try {
      let fullPrompt = prompt;
      
      // Add PDF content if available and service is configured
      if (pdfPaths && pdfPaths.length > 0) {
        try {
          const pdfContents = await this.extractPDFContents(pdfPaths);
          fullPrompt += '\n\nAdditional Reference Documents:\n' + pdfContents;
        } catch (pdfError) {
          console.warn('PDF extraction failed:', pdfError.message);
        }
      }

      // Add additional context
      if (Object.keys(additionalContext).length > 0) {
        fullPrompt += '\n\nAdditional Context:\n' + JSON.stringify(additionalContext, null, 2);
      }

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      let responseText = response.text();
      
      // Clean the response to extract JSON
      responseText = this.cleanJsonResponse(responseText);
      
      return responseText;
    } catch (error) {
      console.error('Gemini API Error:', error);
      return this.getFallbackResponse(prompt);
    }
  }

  // Helper method to clean and extract JSON from AI responses
  cleanJsonResponse(responseText) {
    try {
      // Remove markdown code blocks if present
      let cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      
      // Remove any leading/trailing whitespace
      cleaned = cleaned.trim();
      
      // Try to find JSON content between { and }
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      // Validate it's proper JSON
      JSON.parse(cleaned);
      
      return cleaned;
    } catch (parseError) {
      console.warn('Failed to clean JSON response, attempting to extract:', parseError.message);
      
      // If cleaning fails, try to extract just the JSON part
      try {
        const lines = responseText.split('\n');
        const jsonLines = [];
        let insideJson = false;
        let braceCount = 0;
        
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            insideJson = true;
            braceCount = 1;
            jsonLines.push(line);
          } else if (insideJson) {
            jsonLines.push(line);
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0) {
              break;
            }
          }
        }
        
        const extractedJson = jsonLines.join('\n');
        JSON.parse(extractedJson); // Validate
        return extractedJson;
      } catch (extractError) {
        console.warn('JSON extraction failed, returning fallback');
        return this.getFallbackResponse('json_extraction_failed');
      }
    }
  }

  getFallbackResponse(prompt) {
    // Enhanced fallback responses based on prompt type
    if (prompt.includes('FOCUS_SUGGESTION') || prompt.includes('focus suggestion')) {
      return JSON.stringify({
        focusThemes: ['Spiritual Growth & Inner Peace', 'Divine Blessings & Protection', 'Prosperity & Success'],
        recommendedDeities: ['Ganesha', 'Lakshmi', 'Saraswati'],
        optimalTiming: 'Morning hours between 6 AM to 10 AM for maximum spiritual energy',
        culturalSignificance: 'Based on traditional Vedic principles and seasonal alignment',
        topCategories: [
          {
            category: 'Health & Wellness',
            performance: 'High',
            rationale: 'Strong historical performance with consistent user engagement'
          },
          {
            category: 'Career Growth',
            performance: 'Medium-High', 
            rationale: 'Growing demand especially during professional transition periods'
          },
          {
            category: 'Financial Prosperity',
            performance: 'High',
            rationale: 'Consistent performer across all months with peak during festival seasons'
          }
        ],
        note: 'Generated with intelligent fallback system - connect Gemini API for AI-powered insights'
      });
    }
    
    if (prompt.includes('PUJA_PROPOSITION') || prompt.includes('puja proposition')) {
      return JSON.stringify({
        pujaName: 'Divine Blessing Puja for Prosperity',
        deity: 'Ganesha',
        useCase: 'Financial Prosperity',
        specificity: 'Traditional Ganesha worship with specialized mantras for removing financial obstacles, including sacred offerings of modak, red flowers, and durva grass. Includes personalized sankalpa (intention setting) and distribution of blessed prasadam.',
        rationale: 'This specially curated Ganesha puja for financial prosperity combines ancient Vedic wisdom with proven spiritual practices. Lord Ganesha, revered as the remover of obstacles and lord of beginnings, holds special significance for financial matters as He governs the flow of abundance and removes barriers to prosperity. The timing aligns with favorable planetary positions that enhance the manifestation of material success. Historical data shows consistent positive outcomes for devotees who perform this puja with sincere devotion. The ritual incorporates traditional elements that have been used for centuries to invoke divine blessings for wealth creation and financial stability. The combination of proper timing, authentic procedures, and focused intention creates a powerful spiritual environment for attracting prosperity.',
        taglines: [
          'Unlock Divine Prosperity with Ganesha\'s Blessings',
          'Remove Financial Obstacles, Invite Abundance',
          'Ancient Wisdom for Modern Wealth Creation',
          'Transform Your Financial Future Through Divine Grace',
          'Sacred Rituals, Abundant Results'
        ],
        note: 'Generated with intelligent fallback system - connect Gemini API for personalized AI-powered content'
      });
    }

    if (prompt.includes('WHY_WHY_ANALYSIS') || prompt.includes('why-why analysis')) {
      return JSON.stringify({
        firstWhy: {
          question: 'Why this puja on this specific date?',
          answer: 'The astrological alignment and tithi create optimal conditions for spiritual practice and manifestation of desired outcomes.'
        },
        secondWhy: {
          question: 'Why this deity for this purpose?',
          answer: 'Traditional scriptures and historical evidence show this deity has specific domain over the desired area of life.'
        },
        thirdWhy: {
          question: 'Why this timing strategy?',
          answer: 'Market analysis and seasonal patterns indicate peak user readiness and spiritual receptivity during this period.'
        },
        fourthWhy: {
          question: 'Why this approach over alternatives?',
          answer: 'This methodology offers unique competitive advantages and proven effectiveness based on performance data.'
        },
        note: 'Generated with intelligent fallback system - connect Gemini API for deep AI-powered analysis'
      });
    }

    if (prompt.includes('EXPERIMENTAL_PUJA') || prompt.includes('experimental')) {
      return JSON.stringify({
        experiments: [
          {
            name: 'Digital-Physical Harmony Puja',
            type: 'modern_adaptation',
            description: 'Innovative approach combining traditional rituals with modern technology for enhanced spiritual experience.',
            riskLevel: 'medium',
            expectedOutcome: 'Increased engagement from tech-savvy devotees while maintaining spiritual authenticity',
            culturalJustification: 'Adapts ancient practices for contemporary lifestyle without compromising core spiritual values'
          },
          {
            name: 'Multi-Deity Synergy Puja',
            type: 'deity_combination', 
            description: 'Strategic combination of complementary deities for comprehensive life enhancement.',
            riskLevel: 'low',
            expectedOutcome: 'Holistic spiritual benefits appealing to devotees seeking complete life transformation',
            culturalJustification: 'Based on traditional Vedic principles of deity synergy found in classical texts'
          },
          {
            name: 'Micro-Moment Blessing Series',
            type: 'timing_innovation',
            description: 'Brief but powerful focused pujas designed for busy modern schedules.',
            riskLevel: 'high',
            expectedOutcome: 'Higher frequency engagement and appeal to time-constrained urban devotees',
            culturalJustification: 'Concentrates traditional practices into essential elements for maximum spiritual impact'
          }
        ],
        note: 'Generated with intelligent fallback system - connect Gemini API for cutting-edge experimental concepts'
      });
    }

    return JSON.stringify({
      message: 'Intelligent fallback response provided',
      note: 'Connect Gemini API for full AI-powered functionality',
      recommendedAction: 'Configure GEMINI_API_KEY in environment variables for enhanced AI capabilities'
    });
  }

  async extractPDFContents(pdfPaths) {
    try {
      // Only attempt if PDF service is available
      const { extractTextFromPDF } = require('./pdfService');
      const contents = [];
      
      for (const pdfPath of pdfPaths) {
        try {
          const text = await extractTextFromPDF(pdfPath);
          contents.push(`--- Content from ${pdfPath} ---\n${text}\n`);
        } catch (error) {
          console.warn(`Failed to extract ${pdfPath}:`, error.message);
        }
      }
      return contents.join('\n');
    } catch (error) {
      console.warn('PDF service not available:', error.message);
      return '';
    }
  }

  // Enhanced puja-specific methods using professional prompts
  async generateFocusSuggestion(month, year, historicalData, seasonalEvents, pdfPaths = []) {
    const promptData = {
      month,
      year,
      historicalData,
      seasonalEvents
    };

    const prompt = this.replacePlaceholders(pujaPrompts.FOCUS_SUGGESTION, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async generatePujaProposition(propositionData, pdfPaths = []) {
    const { date, tithi, grahaTransit, deity, historicalData, useCase } = propositionData;
    
    const promptData = {
      date,
      tithi: tithi || 'Auspicious timing',
      grahaTransit: grahaTransit || 'Favorable planetary alignment',
      deity,
      historicalData,
      useCase
    };

    const prompt = this.replacePlaceholders(pujaPrompts.PUJA_PROPOSITION, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateWhyWhyAnalysis(analysisData, pdfPaths = []) {
    const { pujaName, dateInfo, deity, useCase, historicalData } = analysisData;
    
    const promptData = {
      pujaName,
      dateInfo,
      deity,
      useCase,
      historicalData
    };

    const prompt = this.replacePlaceholders(pujaPrompts.WHY_WHY_ANALYSIS, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateExperimentalPuja(experimentData, pdfPaths = []) {
    const { month, performanceData, experimentParameters } = experimentData;
    
    const promptData = {
      month,
      performanceGaps: this.analyzePerformanceGaps(performanceData),
      underutilizedDeities: this.findUnderutilizedDeities(performanceData),
      marketOpportunities: this.identifyMarketOpportunities(performanceData),
      culturalEvents: this.getCurrentCulturalEvents(month)
    };

    const prompt = this.replacePlaceholders(pujaPrompts.EXPERIMENTAL_PUJA, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  // Enhanced analysis methods using professional prompts
  async analyzePerformance(performanceData, previousResults, pdfPaths = []) {
    const promptData = {
      performanceData,
      previousResults
    };

    const prompt = this.replacePlaceholders(analysisPrompts.PERFORMANCE_ANALYSIS, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async synthesizeFeedback(feedbackData, pdfPaths = []) {
    const { userFeedback, teamReviews, performanceMetrics, conversionData } = feedbackData;
    
    const promptData = {
      userFeedback,
      teamReviews,
      performanceMetrics,
      conversionData
    };

    const prompt = this.replacePlaceholders(analysisPrompts.FEEDBACK_SYNTHESIS, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async performCompetitiveAnalysis(marketData, pdfPaths = []) {
    const promptData = marketData;
    const prompt = this.replacePlaceholders(analysisPrompts.COMPETITIVE_ANALYSIS, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async optimizeSeasonalStrategy(seasonalData, pdfPaths = []) {
    const promptData = seasonalData;
    const prompt = this.replacePlaceholders(analysisPrompts.SEASONAL_OPTIMIZATION, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  // Advanced experimental methods
  async conductInnovationWorkshop(innovationData, pdfPaths = []) {
    const promptData = innovationData;
    const prompt = this.replacePlaceholders(experimentPrompts.INNOVATION_WORKSHOP, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async designABTest(testData, pdfPaths = []) {
    const promptData = testData;
    const prompt = this.replacePlaceholders(experimentPrompts.AB_TEST_DESIGN, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateBreakthroughIdeas(innovationParameters, pdfPaths = []) {
    const promptData = innovationParameters;
    const prompt = this.replacePlaceholders(experimentPrompts.BREAKTHROUGH_IDEATION, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  async designRapidPrototype(prototypingData, pdfPaths = []) {
    const promptData = prototypingData;
    const prompt = this.replacePlaceholders(experimentPrompts.RAPID_PROTOTYPING, promptData);
    return await this.generateResponse(prompt, pdfPaths);
  }

  // Utility methods for data analysis
  analyzePerformanceGaps(performanceData) {
    if (!performanceData || performanceData.length === 0) {
      return ['Limited historical data available for gap analysis'];
    }

    // Analyze performance gaps from data
    const gaps = [];
    const avgPerformance = performanceData.reduce((sum, item) => sum + (item.performance_score || 0), 0) / performanceData.length;
    
    const underperformers = performanceData.filter(item => (item.performance_score || 0) < avgPerformance * 0.8);
    
    if (underperformers.length > 0) {
      gaps.push(`${underperformers.length} propositions underperforming by 20%+ below average`);
    }

    return gaps;
  }

  findUnderutilizedDeities(performanceData) {
    if (!performanceData || performanceData.length === 0) {
      return ['Hanuman', 'Ketu', 'Rahu']; // Default underutilized
    }

    const deityCounts = {};
    performanceData.forEach(item => {
      const deity = item.proposition_data?.deity;
      if (deity) {
        deityCounts[deity] = (deityCounts[deity] || 0) + 1;
      }
    });

    // Return deities with low frequency
    return Object.entries(deityCounts)
      .filter(([deity, count]) => count <= 2)
      .map(([deity]) => deity);
  }

  identifyMarketOpportunities(performanceData) {
    return [
      'Growing demand for wellness-spirituality integration',
      'Increased interest in personalized spiritual experiences', 
      'Rising popularity of brief, focused spiritual practices',
      'Opportunity in community-based spiritual activities'
    ];
  }

  getCurrentCulturalEvents(month) {
    const monthEvents = {
      1: ['Makar Sankranti', 'Republic Day'],
      2: ['Vasant Panchami', 'Maha Shivratri'],
      3: ['Holi', 'Chaitra Navratri'],
      4: ['Ram Navami', 'Hanuman Jayanti'],
      5: ['Akshaya Tritiya', 'Buddha Purnima'],
      6: ['Jagannath Rath Yatra'],
      7: ['Guru Purnima'],
      8: ['Krishna Janmashtami', 'Independence Day'],
      9: ['Ganesh Chaturthi', 'Pitru Paksha'],
      10: ['Navaratri', 'Dussehra'],
      11: ['Diwali', 'Karva Chauth'],
      12: ['Kartik Purnima', 'Dev Uthani Ekadashi']
    };

    return monthEvents[month] || ['General spiritual observances'];
  }

  // Utility method for custom prompts with professional template structure
  async generateCustomResponse(customPrompt, context = {}, pdfPaths = []) {
    const enhancedPrompt = `
    You are an expert spiritual content strategist for Sri Mandir. 
    
    ${customPrompt}
    
    Context: ${JSON.stringify(context, null, 2)}
    
    Provide a comprehensive, culturally authentic, and actionable response.
    Format your response as structured JSON for easy integration.
    `;
    
    return await this.generateResponse(enhancedPrompt, pdfPaths, context);
  }
}

module.exports = new GeminiService();
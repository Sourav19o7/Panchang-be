// Gemini service with proper error handling
class GeminiService {
  constructor() {
    this.isConfigured = !!process.env.GEMINI_API_KEY;
    
    if (this.isConfigured) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash-exp",
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
      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      return this.getFallbackResponse(prompt);
    }
  }

  getFallbackResponse(prompt) {
    // Provide fallback responses based on prompt type
    if (prompt.includes('focus suggestion') || prompt.includes('FOCUS_SUGGESTION')) {
      return JSON.stringify({
        focusThemes: ['Spiritual Growth', 'Divine Blessings', 'Inner Peace'],
        recommendedDeities: ['Ganesha', 'Lakshmi', 'Saraswati'],
        optimalTiming: 'Morning hours between 6 AM to 10 AM',
        culturalSignificance: 'Based on traditional Vedic principles',
        note: 'Generated with fallback service'
      });
    }
    
    if (prompt.includes('puja proposition') || prompt.includes('PUJA_PROPOSITION')) {
      return JSON.stringify({
        pujaName: 'Divine Blessing Puja',
        deity: 'Ganesha',
        useCase: 'General Wellbeing',
        specificity: 'Traditional worship with offerings and mantras',
        rationale: 'This puja combines ancient wisdom with practical spiritual benefits, designed to bring peace and prosperity to devotees.',
        taglines: ['Invoke Divine Blessings', 'Path to Prosperity', 'Ancient Wisdom for Modern Life'],
        note: 'Generated with fallback service'
      });
    }

    return JSON.stringify({
      message: 'Fallback response',
      note: 'Gemini service not available, using default content'
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

  // Puja-specific methods with fallbacks
  async generateFocusSuggestion(month, year, historicalData, seasonalEvents, pdfPaths = []) {
    const prompt = `Generate focus suggestions for month ${month} of year ${year}.
Historical data: ${JSON.stringify(historicalData)}
Seasonal events: ${JSON.stringify(seasonalEvents)}`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generatePujaProposition(propositionData, pdfPaths = []) {
    const { date, tithi, grahaTransit, deity, historicalData, useCase } = propositionData;
    
    const prompt = `Generate a puja proposition for:
Date: ${date}
Tithi: ${tithi}
Deity: ${deity}
Use Case: ${useCase}
Historical Data: ${JSON.stringify(historicalData)}`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateWhyWhyAnalysis(analysisData, pdfPaths = []) {
    const { pujaName, dateInfo, deity, useCase, historicalData } = analysisData;
    
    const prompt = `Generate why-why analysis for:
Puja: ${pujaName}
Date: ${dateInfo}
Deity: ${deity}
Use Case: ${useCase}`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateExperimentalPuja(experimentData, pdfPaths = []) {
    const { month, performanceGaps, underutilizedDeities, marketOpportunities, culturalEvents } = experimentData;
    
    const prompt = `Generate experimental puja concepts for month ${month}`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  // Analysis methods
  async analyzePerformance(performanceData, previousResults, pdfPaths = []) {
    const prompt = `Analyze performance data: ${JSON.stringify(performanceData)}`;
    return await this.generateResponse(prompt, pdfPaths);
  }

  async synthesizeFeedback(feedbackData, pdfPaths = []) {
    const prompt = `Synthesize feedback: ${JSON.stringify(feedbackData)}`;
    return await this.generateResponse(prompt, pdfPaths);
  }

  // Utility method for custom prompts
  async generateCustomResponse(customPrompt, context = {}, pdfPaths = []) {
    return await this.generateResponse(customPrompt, pdfPaths, context);
  }
}

module.exports = new GeminiService();
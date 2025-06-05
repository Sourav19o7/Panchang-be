const { model } = require('../config/gemini');
const { extractTextFromPDF } = require('./pdfService');
const pujaPrompts = require('../prompts/pujaPrompt');
const analysisPrompts = require('../prompts/analysisPrompt');
const experimentPrompts = require('../prompts/experimentPrompt');

class GeminiService {
  async generateResponse(prompt, pdfPaths = [], additionalContext = {}) {
    try {
      let fullPrompt = prompt;
      
      // Add PDF content if provided
      if (pdfPaths && pdfPaths.length > 0) {
        const pdfContents = await this.extractPDFContents(pdfPaths);
        fullPrompt += '\n\nAdditional Reference Documents:\n' + pdfContents;
      }

      // Add additional context
      if (Object.keys(additionalContext).length > 0) {
        fullPrompt += '\n\nAdditional Context:\n' + JSON.stringify(additionalContext, null, 2);
      }

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  async extractPDFContents(pdfPaths) {
    try {
      const contents = [];
      for (const pdfPath of pdfPaths) {
        const text = await extractTextFromPDF(pdfPath);
        contents.push(`--- Content from ${pdfPath} ---\n${text}\n`);
      }
      return contents.join('\n');
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract PDF contents: ${error.message}`);
    }
  }

  // Puja-specific methods
  async generateFocusSuggestion(month, year, historicalData, seasonalEvents, pdfPaths = []) {
    const prompt = pujaPrompts.FOCUS_SUGGESTION
      .replace('{month}', month)
      .replace('{year}', year)
      .replace('{historicalData}', JSON.stringify(historicalData))
      .replace('{seasonalEvents}', JSON.stringify(seasonalEvents));

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generatePujaProposition(propositionData, pdfPaths = []) {
    const { date, tithi, grahaTransit, deity, historicalData, useCase } = propositionData;
    
    const prompt = pujaPrompts.PUJA_PROPOSITION
      .replace('{date}', date)
      .replace('{tithi}', tithi)
      .replace('{grahaTransit}', grahaTransit)
      .replace('{deity}', deity)
      .replace('{historicalData}', JSON.stringify(historicalData))
      .replace('{useCase}', useCase);

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateWhyWhyAnalysis(analysisData, pdfPaths = []) {
    const { pujaName, dateInfo, deity, useCase, historicalData } = analysisData;
    
    const prompt = pujaPrompts.WHY_WHY_ANALYSIS
      .replace('{pujaName}', pujaName)
      .replace('{dateInfo}', dateInfo)
      .replace('{deity}', deity)
      .replace('{useCase}', useCase)
      .replace('{historicalData}', JSON.stringify(historicalData));

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateExperimentalPuja(experimentData, pdfPaths = []) {
    const { month, performanceGaps, underutilizedDeities, marketOpportunities, culturalEvents } = experimentData;
    
    const prompt = pujaPrompts.EXPERIMENTAL_PUJA
      .replace('{month}', month)
      .replace('{performanceGaps}', JSON.stringify(performanceGaps))
      .replace('{underutilizedDeities}', JSON.stringify(underutilizedDeities))
      .replace('{marketOpportunities}', JSON.stringify(marketOpportunities))
      .replace('{culturalEvents}', JSON.stringify(culturalEvents));

    return await this.generateResponse(prompt, pdfPaths);
  }

  // Analysis methods
  async analyzePerformance(performanceData, previousResults, pdfPaths = []) {
    const prompt = analysisPrompts.PERFORMANCE_ANALYSIS
      .replace('{performanceData}', JSON.stringify(performanceData))
      .replace('{previousResults}', JSON.stringify(previousResults));

    return await this.generateResponse(prompt, pdfPaths);
  }

  async synthesizeFeedback(feedbackData, pdfPaths = []) {
    const { userFeedback, teamReviews, performanceMetrics, conversionData } = feedbackData;
    
    const prompt = analysisPrompts.FEEDBACK_SYNTHESIS
      .replace('{userFeedback}', JSON.stringify(userFeedback))
      .replace('{teamReviews}', JSON.stringify(teamReviews))
      .replace('{performanceMetrics}', JSON.stringify(performanceMetrics))
      .replace('{conversionData}', JSON.stringify(conversionData));

    return await this.generateResponse(prompt, pdfPaths);
  }

  // Experiment methods
  async conductInnovationWorkshop(innovationContext, pdfPaths = []) {
    const { currentOfferings, marketGaps, emergingTrends, techOpportunities, feedbackThemes } = innovationContext;
    
    const prompt = experimentPrompts.INNOVATION_WORKSHOP
      .replace('{currentOfferings}', JSON.stringify(currentOfferings))
      .replace('{marketGaps}', JSON.stringify(marketGaps))
      .replace('{emergingTrends}', JSON.stringify(emergingTrends))
      .replace('{techOpportunities}', JSON.stringify(techOpportunities))
      .replace('{feedbackThemes}', JSON.stringify(feedbackThemes));

    return await this.generateResponse(prompt, pdfPaths);
  }

  async designABTest(testContext, pdfPaths = []) {
    const { currentPerformance, hypothesis, targetMetrics, audienceSegments, testPeriod } = testContext;
    
    const prompt = experimentPrompts.AB_TEST_DESIGN
      .replace('{currentPerformance}', JSON.stringify(currentPerformance))
      .replace('{hypothesis}', hypothesis)
      .replace('{targetMetrics}', JSON.stringify(targetMetrics))
      .replace('{audienceSegments}', JSON.stringify(audienceSegments))
      .replace('{testPeriod}', testPeriod);

    return await this.generateResponse(prompt, pdfPaths);
  }

  // Utility method for custom prompts
  async generateCustomResponse(customPrompt, context = {}, pdfPaths = []) {
    return await this.generateResponse(customPrompt, pdfPaths, context);
  }
}

module.exports = new GeminiService();
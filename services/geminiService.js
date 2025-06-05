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
      console.warn('Gemini API key not configured');
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
    // Only provide fallback for critical errors, not as default content
    if (!this.isConfigured) {
      return JSON.stringify({
        error: 'Gemini API not configured',
        message: 'Please configure GEMINI_API_KEY to enable AI-powered responses',
        fallbackUsed: true
      });
    }

    // For other errors, return a simple error response
    return JSON.stringify({
      error: 'AI generation failed',
      message: 'Unable to generate AI response at this time',
      fallbackUsed: true
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
    const prompt = `You are an expert spiritual content strategist for Sri Mandir, a leading spiritual platform.

Generate a comprehensive monthly focus strategy for ${this.getMonthName(month)} ${year}.

**Analysis Requirements:**
- Historical Data: ${JSON.stringify(historicalData || [], null, 2)}
- Seasonal Events: ${JSON.stringify(seasonalEvents || [], null, 2)}
- Month: ${month} (${this.getMonthName(month)})
- Year: ${year}

**Required Output Format (JSON):**
{
  "puja_strategy": {
    "month": ${month},
    "year": ${year},
    "data_sources": ["Historical Performance Data", "Seasonal Events", "Cultural Calendar"],
    "recommendations": {
      "top_3_puja_categories": [
        {
          "category": "Category Name",
          "rationale": "Detailed explanation of why this category will perform well"
        }
      ],
      "high_performing_deity_combinations": [
        {
          "deity_combination": "Deity 1 & Deity 2",
          "rationale": "Explanation of why this combination works"
        }
      ],
      "recommended_themes": [
        {
          "theme": "Theme Name",
          "rationale": "Why this theme resonates in this month"
        }
      ],
      "optimal_timing_strategies": [
        {
          "timing": "Specific timing recommendation",
          "rationale": "Why this timing is optimal"
        }
      ]
    }
  }
}

**Guidelines:**
1. Base recommendations on actual historical performance data when available
2. Consider major festivals and cultural events for ${this.getMonthName(month)}
3. Provide specific, actionable rationales for each recommendation
4. Focus on authentic spiritual traditions and cultural relevance
5. Consider seasonal energy patterns and astrological significance

Generate a data-driven strategy that balances tradition with modern spiritual needs.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generatePujaProposition(propositionData, pdfPaths = []) {
    const { date, tithi, grahaTransit, deity, historicalData, useCase } = propositionData;
    
    const prompt = `You are an expert spiritual content creator for Sri Mandir. Generate a detailed puja proposition.

**Puja Details:**
- Date: ${date}
- Tithi: ${tithi || 'Auspicious timing'}
- Graha Transit: ${grahaTransit || 'Favorable planetary alignment'}
- Deity: ${deity}
- Use Case: ${useCase}
- Historical Performance: ${JSON.stringify(historicalData || [], null, 2)}

**Required Output Format (JSON):**
{
  "pujaName": "Specific puja name",
  "deity": "${deity}",
  "useCase": "${useCase}",
  "date": "${date}",
  "tithi": "${tithi || ''}",
  "grahaTransit": "${grahaTransit || ''}",
  "specificity": "Detailed ritual description with specific elements",
  "rationale": "400-500 word explanation of timing, deity choice, and expected benefits",
  "taglines": ["5 compelling taglines for marketing"]
}

**Requirements:**
1. Create authentic, culturally grounded content
2. Explain the spiritual significance and timing
3. Include specific ritual elements and offerings
4. Write compelling rationale that educates and inspires
5. Generate marketing taglines that respect tradition while appealing to modern devotees

Generate content that balances authenticity with accessibility.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateWhyWhyAnalysis(analysisData, pdfPaths = []) {
    const { pujaName, dateInfo, deity, useCase, historicalData } = analysisData;
    
    const prompt = `Perform a comprehensive "Why-Why" analysis for this puja proposition.

**Puja Details:**
- Name: ${pujaName}
- Date: ${dateInfo}
- Deity: ${deity}
- Use Case: ${useCase}
- Historical Data: ${JSON.stringify(historicalData || [], null, 2)}

**Required Output Format (JSON):**
{
  "firstWhy": {
    "question": "Why this puja on this specific date?",
    "answer": "Detailed explanation"
  },
  "secondWhy": {
    "question": "Why this deity for this purpose?",
    "answer": "Detailed explanation"
  },
  "thirdWhy": {
    "question": "Why this timing strategy?",
    "answer": "Detailed explanation"
  },
  "fourthWhy": {
    "question": "Why this approach over alternatives?",
    "answer": "Detailed explanation"
  },
  "fifthWhy": {
    "question": "Why will this resonate with devotees?",
    "answer": "Detailed explanation"
  }
}

Provide deep, analytical responses that demonstrate strategic thinking.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateExperimentalPuja(experimentData, pdfPaths = []) {
    const { month, performanceData, experimentParameters } = experimentData;
    
    const prompt = `Design 3 innovative experimental puja concepts for month ${month}.

**Analysis Data:**
- Performance Gaps: ${JSON.stringify(this.analyzePerformanceGaps(performanceData), null, 2)}
- Underutilized Deities: ${JSON.stringify(this.findUnderutilizedDeities(performanceData), null, 2)}
- Market Opportunities: ${JSON.stringify(this.identifyMarketOpportunities(performanceData), null, 2)}

**Required Output Format (JSON):**
{
  "experiments": [
    {
      "name": "Unique experiment name",
      "type": "experiment_category",
      "description": "Detailed description of the experimental approach",
      "riskLevel": "low/medium/high",
      "expectedOutcome": "Specific expected results",
      "culturalJustification": "How this maintains spiritual authenticity"
    }
  ]
}

**Experiment Types:**
- deity_combination: Innovative deity pairings
- timing_innovation: New timing approaches
- use_case_expansion: Exploring new spiritual applications
- cultural_fusion: Blending traditions respectfully
- modern_adaptation: Technology-enhanced spirituality

Design bold but respectful innovations that could revolutionize spiritual engagement.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  // Enhanced analysis methods using professional prompts
  async analyzePerformance(performanceData, previousResults, pdfPaths = []) {
    const prompt = `Analyze performance data and generate actionable insights.

**Current Performance Data:**
${JSON.stringify(performanceData || [], null, 2)}

**Previous Results:**
${JSON.stringify(previousResults || {}, null, 2)}

**Required Output Format (JSON):**
{
  "performanceInsights": {
    "topPerformers": ["List of best performing pujas"],
    "underperformers": ["List of struggling pujas"],
    "trends": ["Key performance trends identified"],
    "recommendations": ["Specific improvement recommendations"]
  },
  "dataAnalysis": {
    "avgRating": "number",
    "totalRevenue": "number",
    "engagementRate": "number",
    "growthRate": "percentage"
  },
  "actionableItems": ["Specific next steps to take"]
}

Provide data-driven insights with specific recommendations.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async synthesizeFeedback(feedbackData, pdfPaths = []) {
    const { userFeedback, teamReviews, performanceMetrics, conversionData } = feedbackData;
    
    const prompt = `Synthesize all feedback sources into actionable insights.

**Feedback Sources:**
- User Feedback: ${JSON.stringify(userFeedback || [], null, 2)}
- Team Reviews: ${JSON.stringify(teamReviews || [], null, 2)}
- Performance Metrics: ${JSON.stringify(performanceMetrics || [], null, 2)}
- Conversion Data: ${JSON.stringify(conversionData || [], null, 2)}

**Required Output Format (JSON):**
{
  "synthesisResults": {
    "keyThemes": ["Major themes identified across all feedback"],
    "userSentiment": "Overall user sentiment analysis",
    "teamConsensus": "Areas where team agrees",
    "performanceCorrelations": ["Connections between feedback and performance"]
  },
  "prioritizedRecommendations": [
    {
      "priority": "high/medium/low",
      "action": "Specific action to take",
      "rationale": "Why this action is important",
      "expectedImpact": "Predicted outcome"
    }
  ]
}

Generate insights that bridge user needs with business objectives.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async performCompetitiveAnalysis(marketData, pdfPaths = []) {
    const prompt = `Perform competitive analysis for spiritual content market.

**Market Data:**
${JSON.stringify(marketData || {}, null, 2)}

**Required Output Format (JSON):**
{
  "competitiveAnalysis": {
    "marketGaps": ["Opportunities not being addressed"],
    "competitiveAdvantages": ["Our unique strengths"],
    "threatAssessment": "Major competitive threats",
    "opportunityMapping": ["Specific opportunities to pursue"]
  },
  "strategicRecommendations": [
    {
      "category": "content/pricing/distribution/marketing",
      "recommendation": "Specific strategic move",
      "rationale": "Why this will work",
      "timeline": "Implementation timeframe"
    }
  ]
}

Focus on actionable competitive intelligence.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async optimizeSeasonalStrategy(seasonalData, pdfPaths = []) {
    const prompt = `Optimize seasonal spiritual content strategy.

**Seasonal Data:**
${JSON.stringify(seasonalData || {}, null, 2)}

**Required Output Format (JSON):**
{
  "seasonalOptimization": {
    "seasonalRecommendations": ["Specific seasonal adjustments"],
    "festivalIntegration": ["How to leverage upcoming festivals"],
    "timingStrategy": ["Optimal timing approaches"],
    "contentAdaptation": ["Content modifications needed"],
    "resourceAllocation": ["Where to invest resources"]
  },
  "implementationPlan": {
    "immediate": ["Actions to take within 1 week"],
    "shortTerm": ["Actions for next month"],
    "longTerm": ["Strategic seasonal planning"]
  }
}

Provide season-specific strategies that maximize spiritual engagement.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  // Advanced experimental methods
  async conductInnovationWorkshop(innovationData, pdfPaths = []) {
    const prompt = `Conduct a virtual innovation workshop for spiritual content.

**Innovation Context:**
${JSON.stringify(innovationData || {}, null, 2)}

**Required Output Format (JSON):**
{
  "innovationResults": {
    "breakthroughIdeas": ["Revolutionary concepts identified"],
    "incrementalImprovements": ["Small but impactful changes"],
    "experimentDesigns": ["Structured experiments to test"],
    "technologyOpportunities": ["Tech-enabled innovations"]
  },
  "prioritizedInnovations": [
    {
      "innovation": "Specific innovation concept",
      "feasibility": "high/medium/low",
      "impact": "high/medium/low",
      "timeline": "Implementation time needed",
      "resources": "Resources required"
    }
  ]
}

Generate bold but practical innovations for spiritual engagement.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async designABTest(testData, pdfPaths = []) {
    const prompt = `Design a comprehensive A/B test for spiritual content.

**Test Parameters:**
${JSON.stringify(testData || {}, null, 2)}

**Required Output Format (JSON):**
{
  "testDesign": {
    "hypothesis": "Clear testable hypothesis",
    "variables": ["Specific variables to test"],
    "controlGroup": "Control group definition",
    "testGroups": ["Test group definitions"],
    "successMetrics": ["How to measure success"],
    "testDuration": "Recommended test duration",
    "sampleSize": "Required sample size"
  },
  "implementationGuide": {
    "setup": ["Setup instructions"],
    "monitoring": ["What to monitor during test"],
    "analysis": ["How to analyze results"]
  }
}

Design rigorous tests that generate reliable insights.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async generateBreakthroughIdeas(innovationParameters, pdfPaths = []) {
    const prompt = `Generate breakthrough ideas for spiritual technology and engagement.

**Innovation Parameters:**
${JSON.stringify(innovationParameters || {}, null, 2)}

**Required Output Format (JSON):**
{
  "breakthroughConcepts": [
    {
      "concept": "Revolutionary idea name",
      "description": "Detailed concept description",
      "innovation": "What makes this breakthrough",
      "spiritualValue": "Spiritual benefit provided",
      "technicalFeasibility": "Technical implementation notes",
      "marketPotential": "Market opportunity size"
    }
  ],
  "implementationRoadmap": {
    "phase1": "Initial development phase",
    "phase2": "Testing and refinement phase",
    "phase3": "Full deployment phase"
  }
}

Think beyond current limitations to imagine revolutionary spiritual experiences.`;

    return await this.generateResponse(prompt, pdfPaths);
  }

  async designRapidPrototype(prototypingData, pdfPaths = []) {
    const prompt = `Design a rapid prototype for spiritual content innovation.

**Prototyping Data:**
${JSON.stringify(prototypingData || {}, null, 2)}

**Required Output Format (JSON):**
{
  "prototypeDesign": {
    "concept": "What we're prototyping",
    "mvpFeatures": ["Minimum viable features"],
    "userJourney": ["Step-by-step user experience"],
    "technicalRequirements": ["Technical needs"],
    "testingApproach": "How to validate the prototype"
  },
  "developmentPlan": {
    "week1": ["Week 1 deliverables"],
    "week2": ["Week 2 deliverables"],
    "testing": ["Testing and feedback collection"],
    "iteration": ["Improvement plan based on feedback"]
  }
}

Design lean, testable prototypes that validate innovative concepts quickly.`;

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

  getMonthName(month) {
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[month] || 'Unknown';
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
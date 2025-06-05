// prompts/index.js
const pujaPrompts = {
  FOCUS_SUGGESTION: `
You are an expert spiritual content strategist for Sri Mandir, a leading spiritual platform.

Generate a comprehensive monthly focus strategy for {month} {year}.

**Analysis Requirements:**
- Historical Data: {historicalData}
- Seasonal Events: {seasonalEvents}
- Month: {month}
- Year: {year}

**Required Output Format (JSON):**
{
  "puja_strategy": {
    "month": {month},
    "year": {year},
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
2. Consider major festivals and cultural events for the specified month
3. Provide specific, actionable rationales for each recommendation
4. Focus on authentic spiritual traditions and cultural relevance
5. Consider seasonal energy patterns and astrological significance

Generate a data-driven strategy that balances tradition with modern spiritual needs.
  `,

  PUJA_PROPOSITION: `
You are an expert spiritual content creator for Sri Mandir. Generate a detailed puja proposition.

**Puja Details:**
- Date: {date}
- Tithi: {tithi}
- Graha Transit: {grahaTransit}
- Deity: {deity}
- Use Case: {useCase}
- Historical Performance: {historicalData}

**Required Output Format (JSON):**
{
  "pujaName": "Specific puja name",
  "deity": "{deity}",
  "useCase": "{useCase}",
  "date": "{date}",
  "tithi": "{tithi}",
  "grahaTransit": "{grahaTransit}",
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

Generate content that balances authenticity with accessibility.
  `,

  WHY_WHY_ANALYSIS: `
Perform a comprehensive "Why-Why" analysis for this puja proposition.

**Puja Details:**
- Name: {pujaName}
- Date: {dateInfo}
- Deity: {deity}
- Use Case: {useCase}
- Historical Data: {historicalData}

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

Provide deep, analytical responses that demonstrate strategic thinking.
  `,

  EXPERIMENTAL_PUJA: `
Design 3 innovative experimental puja concepts for the given timeframe.

**Analysis Data:**
- Performance Gaps: {performanceGaps}
- Underutilized Deities: {underutilizedDeities}
- Market Opportunities: {marketOpportunities}
- Cultural Events: {culturalEvents}

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

Design bold but respectful innovations that could revolutionize spiritual engagement.
  `
};

const analysisPrompts = {
  PERFORMANCE_ANALYSIS: `
Analyze performance data and generate actionable insights.

**Current Performance Data:**
{performanceData}

**Previous Results:**
{previousResults}

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

Provide data-driven insights with specific recommendations.
  `,

  FEEDBACK_SYNTHESIS: `
Synthesize all feedback sources into actionable insights.

**Feedback Sources:**
- User Feedback: {userFeedback}
- Team Reviews: {teamReviews}
- Performance Metrics: {performanceMetrics}
- Conversion Data: {conversionData}

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

Generate insights that bridge user needs with business objectives.
  `,

  COMPETITIVE_ANALYSIS: `
Perform competitive analysis for spiritual content market.

**Market Data:**
{competitorData}
{marketTrends}
{userPreferences}
{ourPerformance}

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

Focus on actionable competitive intelligence.
  `,

  SEASONAL_OPTIMIZATION: `
Optimize seasonal spiritual content strategy.

**Seasonal Data:**
{season}
{festivals}
{seasonalData}
{culturalCalendar}
{weatherData}

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

Provide season-specific strategies that maximize spiritual engagement.
  `
};

const experimentPrompts = {
  INNOVATION_WORKSHOP: `
Conduct a virtual innovation workshop for spiritual content.

**Innovation Context:**
{currentOfferings}
{marketGaps}
{emergingTrends}
{techOpportunities}
{feedbackThemes}

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

Generate bold but practical innovations for spiritual engagement.
  `,

  AB_TEST_DESIGN: `
Design a comprehensive A/B test for spiritual content.

**Test Parameters:**
{currentPerformance}
{hypothesis}
{targetMetrics}
{audienceSegments}
{testPeriod}

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

Design rigorous tests that generate reliable insights.
  `,

  BREAKTHROUGH_IDEATION: `
Generate breakthrough ideas for spiritual technology and engagement.

**Innovation Parameters:**
{emergingTech}
{culturalTrends}
{behaviorShifts}
{globalTrends}
{generationalData}

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

Think beyond current limitations to imagine revolutionary spiritual experiences.
  `,

  RAPID_PROTOTYPING: `
Design a rapid prototype for spiritual content innovation.

**Prototyping Data:**
{conceptDetails}
{resources}
{timeline}
{successMetrics}
{riskLevel}

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

Design lean, testable prototypes that validate innovative concepts quickly.
  `
};

module.exports = {
  pujaPrompts,
  analysisPrompts,
  experimentPrompts
};
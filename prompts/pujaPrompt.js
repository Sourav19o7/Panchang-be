const pujaPrompts = {
  FOCUS_SUGGESTION: `
    You are an expert Puja strategist for Sri Mandir. Based on the provided historical data and current month context, suggest data-backed focus areas for this month's puja calendar.

    Context:
    - Current Month: {month}
    - Year: {year}
    - Historical Performance Data: {historicalData}
    - Seasonal Events: {seasonalEvents}

    Provide recommendations for:
    1. Top 3 puja categories that performed well in this month historically
    2. High-performing deity combinations
    3. Recommended themes based on seasonal relevance
    4. Optimal timing strategies

    Format your response as structured JSON with clear rationale for each recommendation.
  `,

  PUJA_PROPOSITION: `
    You are a Puja Content Creator for Sri Mandir. Generate a comprehensive puja proposition based on the given parameters.

    Input Data:
    - Date: {date}
    - Tithi: {tithi}
    - Graha Transit: {grahaTransit}
    - Deity Focus: {deity}
    - Historical Performance: {historicalData}
    - Use Case Category: {useCase}

    Generate a 5-part puja proposition:

    1. **Specificity**: Detailed puja description with specific rituals
    2. **Puja Name**: Creative, culturally relevant name
    3. **Use Case**: Clear benefit and target audience
    4. **Rationale** (400-500 words): Deep explanation covering:
       - Astrological significance
       - Cultural/mythological background
       - Historical performance data
       - Timing relevance
    5. **Taglines**: 3-5 compelling taglines for marketing

    Ensure the content is:
    - Culturally authentic
    - Astrologically accurate
    - Marketing-friendly
    - Data-backed where possible

    Format as structured JSON.
  `,

  WHY_WHY_ANALYSIS: `
    Perform a detailed "Why-Why" analysis for the given puja proposition.

    Puja Details:
    - Puja Name: {pujaName}
    - Date/Tithi: {dateInfo}
    - Deity: {deity}
    - Use Case: {useCase}
    - Historical Data: {historicalData}

    Analyze and explain:

    **First Why**: Why this puja on this specific date?
    - Astrological alignment
    - Tithi significance
    - Planetary positions

    **Second Why**: Why this deity for this purpose?
    - Mythological connections
    - Traditional associations
    - Historical effectiveness

    **Third Why**: Why this timing strategy?
    - Market readiness
    - Seasonal relevance
    - Performance patterns

    **Fourth Why**: Why this approach over alternatives?
    - Competitive advantages
    - Unique positioning
    - Expected outcomes

    Provide deep, research-backed explanations for each level.
  `,

  EXPERIMENTAL_PUJA: `
    You are an innovative Puja strategist. Design experimental puja propositions that push creative boundaries while maintaining cultural authenticity.

    Context:
    - Month: {month}
    - Recent Performance Gaps: {performanceGaps}
    - Underutilized Deities: {underutilizedDeities}
    - Market Opportunities: {marketOpportunities}
    - Cultural Calendar: {culturalEvents}

    Design 3 experimental puja concepts:

    1. **Bold Deity Combination**: Pair deities not traditionally combined
    2. **Timing Innovation**: Unique timing approach or duration
    3. **Use Case Expansion**: Target new audience or need

    For each experiment:
    - Concept overview
    - Cultural justification
    - Risk assessment
    - Success metrics
    - Implementation strategy

    Ensure experiments are:
    - Culturally respectful
    - Strategically sound
    - Measurably different
    - Market-relevant

    Format as detailed JSON with clear reasoning.
  `
};

module.exports = pujaPrompts;
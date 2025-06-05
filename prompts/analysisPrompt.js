const analysisPrompts = {
  PERFORMANCE_ANALYSIS: `
    Analyze the performance data for puja propositions and provide actionable insights.

    Performance Data:
    {performanceData}

    Previous Month Results:
    {previousResults}

    Analyze:
    1. **Top Performers**: Which pujas exceeded expectations and why?
    2. **Underperformers**: Which pujas missed targets and potential reasons?
    3. **Trend Patterns**: Emerging patterns in user behavior
    4. **Deity Preferences**: Which deities are gaining/losing popularity?
    5. **Timing Insights**: Optimal timing patterns discovered
    6. **Use Case Analysis**: Which use cases resonate most?

    Provide:
    - Key metrics summary
    - Improvement recommendations
    - Strategy adjustments for next month
    - Risk mitigation suggestions

    Format as comprehensive JSON report.
  `,

  FEEDBACK_SYNTHESIS: `
    Synthesize user feedback and team reviews into actionable insights for puja proposition improvement.

    Feedback Data:
    - User Feedback: {userFeedback}
    - Team Reviews: {teamReviews}
    - Performance Metrics: {performanceMetrics}
    - Conversion Data: {conversionData}

    Synthesize insights on:
    1. **Content Quality**: How well do propositions resonate?
    2. **Cultural Accuracy**: Feedback on cultural authenticity
    3. **Marketing Effectiveness**: Which messaging works best?
    4. **User Experience**: Pain points and improvements
    5. **Operational Efficiency**: Team workflow insights

    Generate:
    - Feedback themes and patterns
    - Priority improvement areas
    - Content strategy refinements
    - Process optimization suggestions

    Provide structured analysis with specific recommendations.
  `,

  COMPETITIVE_ANALYSIS: `
    Analyze competitive landscape and market positioning for puja offerings.

    Market Data:
    - Competitor Offerings: {competitorData}
    - Market Trends: {marketTrends}
    - User Preferences: {userPreferences}
    - Our Performance: {ourPerformance}

    Analyze:
    1. **Market Gaps**: Underserved niches or use cases
    2. **Competitive Advantages**: Our unique strengths
    3. **Threat Assessment**: Competitive risks
    4. **Opportunity Mapping**: Growth areas
    5. **Positioning Strategy**: Optimal market position

    Recommend:
    - Differentiation strategies
    - New offering ideas
    - Marketing positioning
    - Competitive responses

    Format as strategic analysis report.
  `,

  SEASONAL_OPTIMIZATION: `
    Optimize puja calendar strategy based on seasonal patterns and cultural events.

    Seasonal Data:
    - Current Season: {season}
    - Upcoming Festivals: {festivals}
    - Historical Seasonal Performance: {seasonalData}
    - Cultural Calendar: {culturalCalendar}
    - Weather Patterns: {weatherData}

    Optimize for:
    1. **Seasonal Relevance**: Align with natural cycles
    2. **Festival Integration**: Leverage major celebrations
    3. **Cultural Timing**: Respect traditional periods
    4. **Market Readiness**: User behavior patterns
    5. **Resource Planning**: Operational considerations

    Provide:
    - Season-specific strategies
    - Festival integration plans
    - Content adaptation guidelines
    - Resource allocation suggestions

    Generate comprehensive seasonal optimization plan.
  `
};

module.exports = analysisPrompts;
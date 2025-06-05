const experimentPrompts = {
  INNOVATION_WORKSHOP: `
    Conduct an innovation workshop to generate breakthrough puja proposition ideas.

    Innovation Context:
    - Current Portfolio: {currentOfferings}
    - Market Gaps: {marketGaps}
    - Emerging Trends: {emergingTrends}
    - Technology Opportunities: {techOpportunities}
    - User Feedback Themes: {feedbackThemes}

    Generate innovative concepts for:
    1. **Digital-Physical Hybrid Pujas**: Blend online and offline elements
    2. **Personalized Ritual Paths**: Customized based on individual needs
    3. **Community Collaboration Pujas**: Group-based spiritual practices
    4. **Micro-Moment Pujas**: Quick, powerful spiritual interventions
    5. **Lifecycle Journey Pujas**: Long-term spiritual progression

    For each concept:
    - Core innovation premise
    - Implementation feasibility
    - Market potential assessment
    - Cultural integration strategy
    - Technology requirements
    - Success measurement plan

    Focus on breakthrough ideas that honor tradition while embracing innovation.
  `,

  AB_TEST_DESIGN: `
    Design A/B test strategies for puja proposition optimization.

    Test Context:
    - Current Baseline: {currentPerformance}
    - Hypothesis to Test: {hypothesis}
    - Target Metrics: {targetMetrics}
    - Audience Segments: {audienceSegments}
    - Test Duration: {testPeriod}

    Design tests for:
    1. **Content Variations**: Different rationale approaches
    2. **Timing Strategies**: Various scheduling options
    3. **Deity Combinations**: Traditional vs. innovative pairings
    4. **Use Case Messaging**: Different benefit positioning
    5. **Pricing Models**: Various offering structures

    For each test:
    - Clear hypothesis statement
    - Test design methodology
    - Success/failure criteria
    - Sample size requirements
    - Risk mitigation plans
    - Learning objectives

    Ensure statistical rigor while maintaining cultural sensitivity.
  `,

  BREAKTHROUGH_IDEATION: `
    Generate breakthrough ideas that could revolutionize puja proposition creation.

    Innovation Parameters:
    - Emerging Technologies: {emergingTech}
    - Cultural Evolution: {culturalTrends}
    - User Behavior Shifts: {behaviorShifts}
    - Global Spiritual Trends: {globalTrends}
    - Generational Preferences: {generationalData}

    Explore breakthrough concepts:
    1. **AI-Powered Personalization**: Deep learning for individual optimization
    2. **Predictive Spiritual Analytics**: Anticipate user needs
    3. **Immersive Experience Design**: AR/VR spiritual experiences
    4. **Social Impact Integration**: Community service within pujas
    5. **Wellness-Spirituality Fusion**: Holistic life enhancement

    For each breakthrough idea:
    - Disruptive potential assessment
    - Implementation roadmap
    - Resource requirements
    - Risk-reward analysis
    - Cultural adaptation strategy
    - Scalability considerations

    Think 10x improvement, not 10% optimization.
  `,

  RAPID_PROTOTYPING: `
    Design rapid prototyping approach for testing experimental puja concepts.

    Prototyping Context:
    - Concept to Test: {conceptDetails}
    - Available Resources: {resources}
    - Timeline Constraints: {timeline}
    - Success Metrics: {successMetrics}
    - Risk Tolerance: {riskLevel}

    Design prototyping plan:
    1. **Minimum Viable Puja (MVP)**: Core essential elements
    2. **Quick Validation Methods**: Fast feedback mechanisms
    3. **Iterative Improvement Process**: Rapid refinement cycles
    4. **Stakeholder Involvement Strategy**: Team and user engagement
    5. **Learning Documentation System**: Capture insights effectively

    Include:
    - Prototype scope definition
    - Build timeline and milestones
    - Testing methodology
    - Feedback collection systems
    - Iteration planning
    - Scale-up strategy

    Optimize for speed of learning while maintaining quality standards.
  `
};

module.exports = experimentPrompts;
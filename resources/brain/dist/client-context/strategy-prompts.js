"use strict";
/**
 * Strategy Engine — AI Prompts for Business Growth Planning
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReviewPrompt = exports.buildCalendarPrompt = exports.buildStrategyPrompt = void 0;
// ============================================================================
// STRATEGY GENERATION PROMPT
// ============================================================================
function buildStrategyPrompt(profile, voice, personas, competitors, relevantDocs) {
    const docContext = relevantDocs.length > 0
        ? `\n\nRELEVANT KNOWLEDGE FROM CLIENT DOCUMENTS:\n${relevantDocs.map(r => `[${r.documentFilename}]: ${r.chunk.content}`).join('\n\n')}`
        : '';
    return `You are CHROMADON's Business Strategist AI. Generate a comprehensive digital growth strategy for this client.

CLIENT PROFILE:
- Business: ${profile.businessName}
- Industry: ${profile.industry}
- Type: ${profile.businessType}
- Location: ${profile.location}
- Website: ${profile.website}
- Mission: ${profile.missionStatement}
- USPs: ${profile.uniqueSellingPoints.join(', ')}
- Products: ${profile.products.map(p => `${p.name} (${p.priceRange})`).join(', ')}
- Services: ${profile.services.map(s => `${s.name} (${s.priceRange})`).join(', ')}
- Goals: ${profile.goals.join(', ')}
- Challenges: ${profile.challenges.join(', ')}
- Budget: ${profile.budget}
- Timeline: ${profile.timeline}

${voice ? `BRAND VOICE:
- Tone: ${voice.tone.join(', ')}
- Personality: ${voice.personality.join(', ')}
- Formality: ${voice.formalityLevel}
- Emoji Usage: ${voice.emojiUsage}
- Avoid Words: ${voice.avoidWords.join(', ')}` : ''}

${personas.length > 0 ? `TARGET AUDIENCES:
${personas.map(p => `- ${p.name}: ${p.demographics}. Pain points: ${p.painPoints.join(', ')}. Motivations: ${p.motivations.join(', ')}. Channels: ${p.preferredChannels.join(', ')}`).join('\n')}` : ''}

${competitors.length > 0 ? `COMPETITORS:
${competitors.map(c => `- ${c.name} (${c.website}): Strengths: ${c.strengths.join(', ')}. Weaknesses: ${c.weaknesses.join(', ')}. Position: ${c.marketPosition}`).join('\n')}` : ''}
${docContext}

Generate a growth strategy as a JSON object with this EXACT structure:
{
  "overview": "2-3 paragraph executive summary of the strategy",
  "targetMarketAnalysis": "Analysis of the target market opportunity",
  "competitiveAdvantages": ["advantage1", "advantage2", ...],
  "channels": [
    {
      "platform": "twitter|linkedin|instagram|facebook|tiktok|pinterest|youtube|google",
      "priority": "high|medium|low",
      "objective": "What this channel achieves",
      "tactics": ["tactic1", "tactic2"],
      "postingFrequency": "e.g. 3x per week",
      "contentTypes": ["type1", "type2"],
      "targetAudience": "Which persona this targets",
      "kpis": ["kpi1", "kpi2"],
      "estimatedReach": "estimated monthly reach"
    }
  ],
  "successMetrics": [
    {
      "name": "metric name",
      "category": "awareness|engagement|conversion|retention|revenue",
      "currentValue": 0,
      "targetValue": 1000,
      "unit": "followers|impressions|clicks|etc",
      "timeframe": "30 days|90 days|etc",
      "trackingMethod": "how to measure"
    }
  ],
  "budgetAllocation": [
    {
      "category": "category name",
      "amount": 0,
      "percentage": 0,
      "description": "what this covers"
    }
  ],
  "shortTermGoals": [
    {
      "goal": "description",
      "timeline": "30 days",
      "milestones": ["milestone1"],
      "resources": ["resource1"],
      "successCriteria": "how to know it's done"
    }
  ],
  "longTermGoals": [
    {
      "goal": "description",
      "timeline": "6 months",
      "milestones": ["milestone1"],
      "resources": ["resource1"],
      "successCriteria": "how to know it's done"
    }
  ],
  "risks": [
    {
      "risk": "description",
      "likelihood": "high|medium|low",
      "impact": "high|medium|low",
      "mitigation": "how to mitigate"
    }
  ]
}

Return ONLY the JSON. No markdown, no explanation.
Focus on actionable, specific tactics tailored to THIS business. Not generic advice.
Recommend only platforms that make sense for their industry and audience.
Be realistic about metrics based on their current stage and budget.`;
}
exports.buildStrategyPrompt = buildStrategyPrompt;
// ============================================================================
// CONTENT CALENDAR PROMPT
// ============================================================================
function buildCalendarPrompt(profile, voice, channels, weeks) {
    return `Generate a ${weeks}-week content calendar for ${profile.businessName}.

BRAND VOICE: ${voice ? `Tone: ${voice.tone.join(', ')}. Formality: ${voice.formalityLevel}. Emoji: ${voice.emojiUsage}` : 'Professional and engaging'}

CHANNELS & FREQUENCY:
${channels.map(c => `- ${c.platform}: ${c.postingFrequency} (types: ${c.contentTypes.join(', ')})`).join('\n')}

PRODUCTS/SERVICES: ${[...profile.products.map(p => p.name), ...profile.services.map(s => s.name)].join(', ')}

Generate as a JSON array:
[
  {
    "id": "cal-001",
    "week": 1,
    "dayOfWeek": 1,
    "platform": "twitter",
    "contentType": "educational",
    "topic": "specific topic",
    "caption": "The actual post text (ready to publish)",
    "hashtags": ["#tag1", "#tag2"],
    "callToAction": "specific CTA",
    "status": "planned"
  }
]

Rules:
- Day 1 = Monday, 7 = Sunday
- Captions must match the brand voice exactly
- Each post should be unique and valuable
- Mix content types (educational, promotional, engagement, behind-scenes)
- Follow the 80/20 rule: 80% value, 20% promotion
- Respect platform character limits

Return ONLY the JSON array.`;
}
exports.buildCalendarPrompt = buildCalendarPrompt;
// ============================================================================
// STRATEGY REVIEW PROMPT
// ============================================================================
function buildReviewPrompt(profile, currentStrategy, feedback) {
    return `Review and update the growth strategy for ${profile.businessName}.

CURRENT STRATEGY:
${currentStrategy}

${feedback ? `CLIENT FEEDBACK:\n${feedback}` : 'Perform a general review and suggest improvements.'}

Provide your analysis as JSON:
{
  "assessment": "Overall assessment of the current strategy",
  "working": ["Things that are working well"],
  "improvements": ["Specific improvements to make"],
  "updatedOverview": "Updated strategy overview incorporating feedback",
  "newTactics": ["Any new tactics to add"],
  "removeTactics": ["Any tactics to remove or replace"]
}

Return ONLY the JSON.`;
}
exports.buildReviewPrompt = buildReviewPrompt;
//# sourceMappingURL=strategy-prompts.js.map
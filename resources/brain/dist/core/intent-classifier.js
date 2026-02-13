"use strict";
/**
 * Intent Classifier
 *
 * Neural RAG Brain Pattern: Dual-Process Router
 *
 * Classifies mission complexity for System 1/2 routing:
 * - System 1: Score < 0.33, fast pattern matching (<200ms)
 * - System 2: Score >= 0.33, LLM reasoning (1-5s)
 *
 * Features analyzed:
 * - Action count (more = more complex)
 * - Conditional branching (increases complexity)
 * - Navigation depth (multi-page = complex)
 * - Ambiguity level (unclear targets = complex)
 * - Dynamic data usage (variables = complex)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifier = void 0;
const types_1 = require("../interfaces/types");
const DEFAULT_CONFIG = {
    system1Threshold: 0.33,
    complexThreshold: 0.66,
    actionCountWeight: 0.25,
    conditionalWeight: 0.20,
    navigationWeight: 0.15,
    ambiguityWeight: 0.25,
    dynamicDataWeight: 0.15,
};
// =============================================================================
// INTENT PATTERNS
// =============================================================================
/**
 * Built-in patterns for intent identification.
 */
const INTENT_PATTERNS = [
    // Click patterns
    {
        name: 'click',
        patterns: [
            /\b(click|tap|press|hit|select)\b.*\b(button|link|element|icon|menu|tab)/i,
            /\b(click|tap|press|hit|select)\b\s+(?:on\s+)?(?:the\s+)?["']?([^"'\n]+)["']?/i,
            /\bclick\b/i,
        ],
        actionType: 'click',
        selectorPatterns: [
            /(?:the\s+)?["']([^"']+)["']\s*(?:button|link)/i,
            /(?:button|link)\s+(?:labeled|named|called)\s+["']?([^"'\n]+)["']?/i,
            /(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+button|\s+link|$)/i,
        ],
        priority: 10,
    },
    // Navigation patterns
    {
        name: 'navigate',
        patterns: [
            /\b(go\s+to|navigate\s+to|open|visit|browse\s+to)\b/i,
            /\burl\b.*\b(https?:\/\/[^\s]+)/i,
        ],
        actionType: 'navigate',
        selectorPatterns: [
            /(https?:\/\/[^\s]+)/i,
            /(?:go\s+to|navigate\s+to|open|visit)\s+(.+?)(?:\s+page|\s+site|$)/i,
        ],
        priority: 9,
    },
    // Fill/Type patterns
    {
        name: 'fill',
        patterns: [
            /\b(type|enter|input|fill|write)\b.*\b(into|in|field|input|box)/i,
            /\b(type|enter|input|fill)\b\s+["']([^"']+)["']/i,
        ],
        actionType: 'fill',
        selectorPatterns: [
            /(?:into|in)\s+(?:the\s+)?["']?([^"'\n]+)["']?\s*(?:field|input|box)/i,
            /["']([^"']+)["']\s+(?:into|in)/i,
        ],
        priority: 8,
    },
    // Select patterns
    {
        name: 'select',
        patterns: [
            /\b(select|choose|pick)\b.*\b(from|dropdown|option)/i,
            /\b(select|choose|pick)\s+["']([^"']+)["']/i,
        ],
        actionType: 'select',
        selectorPatterns: [
            /(?:select|choose|pick)\s+["']?([^"'\n]+)["']?\s+from/i,
            /from\s+(?:the\s+)?["']?([^"'\n]+)["']?\s*(?:dropdown|menu)/i,
        ],
        priority: 7,
    },
    // Hover patterns
    {
        name: 'hover',
        patterns: [
            /\b(hover|mouse\s*over|point\s+at)\b/i,
        ],
        actionType: 'hover',
        selectorPatterns: [
            /(?:hover|mouse\s*over)\s+(?:on\s+)?(?:the\s+)?(.+)/i,
        ],
        priority: 6,
    },
    // Scroll patterns
    {
        name: 'scroll',
        patterns: [
            /\b(scroll)\b.*\b(down|up|to|bottom|top)/i,
        ],
        actionType: 'scroll',
        selectorPatterns: [
            /scroll\s+(?:to\s+)?(?:the\s+)?(.+)/i,
        ],
        priority: 5,
    },
    // Wait patterns
    {
        name: 'wait',
        patterns: [
            /\b(wait|pause|delay)\b.*\b(for|until|seconds?|ms)/i,
            /\buntil\b.*\b(appears?|visible|loads?)/i,
        ],
        actionType: 'wait',
        selectorPatterns: [
            /wait\s+(?:for\s+)?(?:the\s+)?(.+?)\s+(?:to\s+)?(?:appear|load|visible)/i,
            /until\s+(.+?)\s+(?:appears?|loads?|is\s+visible)/i,
        ],
        priority: 4,
    },
    // Screenshot patterns
    {
        name: 'screenshot',
        patterns: [
            /\b(screenshot|capture|snap)\b/i,
        ],
        actionType: 'screenshot',
        selectorPatterns: [
            /(?:screenshot|capture)\s+(?:of\s+)?(?:the\s+)?(.+)/i,
        ],
        priority: 3,
    },
    // Conditional patterns
    {
        name: 'conditional',
        patterns: [
            /\bif\b.*\b(then|,)/i,
            /\bwhen\b.*\b(appears?|exists?|visible)/i,
            /\bonly\s+if\b/i,
        ],
        actionType: 'conditional',
        selectorPatterns: [
            /if\s+(?:the\s+)?["']?([^"'\n]+)["']?\s+(?:appears?|exists?)/i,
            /when\s+(?:the\s+)?["']?([^"'\n]+)["']?\s+(?:appears?|exists?)/i,
        ],
        priority: 11, // Higher priority to detect first
    },
];
// =============================================================================
// COMPLEXITY INDICATORS
// =============================================================================
/**
 * Keywords that indicate higher complexity.
 */
const COMPLEXITY_KEYWORDS = {
    conditional: ['if', 'when', 'unless', 'only if', 'in case', 'provided that'],
    loop: ['for each', 'for all', 'repeat', 'loop', 'iterate', 'every'],
    auth: ['login', 'log in', 'sign in', 'authenticate', 'password', 'credentials'],
    multiStep: ['then', 'after that', 'next', 'finally', 'and then', 'followed by'],
    dynamic: ['variable', 'dynamic', 'generated', 'random', 'each time', 'different'],
    navigation: ['navigate', 'go to', 'page', 'redirect', 'back', 'forward'],
};
/**
 * Keywords that indicate ambiguity.
 */
const AMBIGUITY_KEYWORDS = [
    'something', 'anything', 'whatever', 'somehow', 'somewhere',
    'thing', 'stuff', 'it', 'that', 'this', 'there',
    'some', 'any', 'maybe', 'probably', 'might',
];
// =============================================================================
// INTENT CLASSIFIER CLASS
// =============================================================================
/**
 * Intent Classifier for dual-process routing.
 *
 * Analyzes mission text to determine complexity and route:
 * - System 1: Fast pattern matching for simple intents
 * - System 2: LLM reasoning for complex missions
 */
class IntentClassifier {
    config;
    patterns;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.patterns = [...INTENT_PATTERNS];
    }
    /**
     * Classify mission complexity and identify intents.
     */
    classify(mission) {
        // Normalize mission text
        const normalizedMission = mission.trim().toLowerCase();
        // Extract features
        const features = this.extractFeatures(mission);
        // Calculate complexity score
        const score = this.calculateScore(features);
        // Determine complexity level
        const complexity = this.scoreToComplexity(score);
        // Determine route
        const recommendedRoute = this.determineRoute(score, features);
        // Identify individual intents
        const intents = this.identifyIntents(mission);
        return {
            score,
            complexity,
            recommendedRoute,
            intents,
            features,
        };
    }
    /**
     * Extract classification features from mission text.
     */
    extractFeatures(mission) {
        const lowerMission = mission.toLowerCase();
        const words = mission.split(/\s+/).filter(w => w.length > 0);
        const sentences = mission.split(/[.!?]+/).filter(s => s.trim().length > 0);
        // Count actions
        const intents = this.identifyIntents(mission);
        const actionCount = Math.max(1, intents.length);
        // Check for conditionals
        const hasConditionals = COMPLEXITY_KEYWORDS.conditional.some(kw => lowerMission.includes(kw));
        // Check for loops
        const hasLoops = COMPLEXITY_KEYWORDS.loop.some(kw => lowerMission.includes(kw));
        // Check for auth
        const requiresAuth = COMPLEXITY_KEYWORDS.auth.some(kw => lowerMission.includes(kw));
        // Count navigations
        const navigationCount = (lowerMission.match(/\b(navigate|go to|page|redirect|url)\b/g) || []).length;
        // Check for dynamic data
        const usesDynamicData = COMPLEXITY_KEYWORDS.dynamic.some(kw => lowerMission.includes(kw)) || /\{[^}]+\}|\[[^\]]+\]|\$\w+/.test(mission);
        // Calculate ambiguity level
        const ambiguityLevel = this.calculateAmbiguity(mission, intents);
        return {
            actionCount,
            hasConditionals,
            hasLoops,
            requiresAuth,
            navigationCount,
            usesDynamicData,
            ambiguityLevel,
            wordCount: words.length,
            sentenceCount: sentences.length,
        };
    }
    /**
     * Calculate ambiguity level (0-1).
     */
    calculateAmbiguity(mission, intents) {
        const lowerMission = mission.toLowerCase();
        let ambiguityScore = 0;
        // Check for ambiguous keywords
        const ambiguousWords = AMBIGUITY_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lowerMission));
        ambiguityScore += ambiguousWords.length * 0.15;
        // Check for low-confidence intents
        const lowConfidenceIntents = intents.filter(i => i.confidence < 0.5);
        ambiguityScore += (lowConfidenceIntents.length / Math.max(1, intents.length)) * 0.3;
        // Check for missing target hints
        const missingTargets = intents.filter(i => i.targetHints.length === 0);
        ambiguityScore += (missingTargets.length / Math.max(1, intents.length)) * 0.25;
        // Check for very short missions (likely incomplete)
        if (mission.split(/\s+/).length < 3) {
            ambiguityScore += 0.2;
        }
        // Check for unclear structure
        if (!/[.!?,;:]/.test(mission) && mission.split(/\s+/).length > 10) {
            ambiguityScore += 0.1;
        }
        return Math.min(1, ambiguityScore);
    }
    /**
     * Calculate complexity score (0-1).
     */
    calculateScore(features) {
        let score = 0;
        // Action count contribution (normalize to 0-1)
        // 1 action = 0, 5+ actions = 1
        const actionScore = Math.min(1, (features.actionCount - 1) / 4);
        score += actionScore * this.config.actionCountWeight;
        // Conditional contribution
        const conditionalScore = features.hasConditionals ? 1 : 0;
        score += conditionalScore * this.config.conditionalWeight;
        // Add loop complexity
        if (features.hasLoops) {
            score += 0.15;
        }
        // Navigation contribution (normalize)
        // 0-1 navigations = 0, 3+ = 1
        const navScore = Math.min(1, features.navigationCount / 3);
        score += navScore * this.config.navigationWeight;
        // Ambiguity contribution
        score += features.ambiguityLevel * this.config.ambiguityWeight;
        // Dynamic data contribution
        const dynamicScore = features.usesDynamicData ? 1 : 0;
        score += dynamicScore * this.config.dynamicDataWeight;
        // Auth adds moderate complexity
        if (features.requiresAuth) {
            score += 0.1;
        }
        // Multi-sentence adds complexity
        if (features.sentenceCount > 2) {
            score += 0.05 * Math.min(3, features.sentenceCount - 2);
        }
        return Math.min(1, Math.max(0, score));
    }
    /**
     * Convert score to complexity level.
     */
    scoreToComplexity(score) {
        if (score < this.config.system1Threshold) {
            return types_1.Complexity.SIMPLE;
        }
        else if (score < this.config.complexThreshold) {
            return types_1.Complexity.MODERATE;
        }
        else {
            return types_1.Complexity.COMPLEX;
        }
    }
    /**
     * Determine routing based on score and features.
     */
    determineRoute(score, features) {
        // Always use System 2 for conditionals, loops, or high ambiguity
        if (features.hasConditionals || features.hasLoops || features.ambiguityLevel > 0.5) {
            return 'system2';
        }
        // Use threshold for routing
        return score < this.config.system1Threshold ? 'system1' : 'system2';
    }
    /**
     * Identify individual intents in mission text.
     */
    identifyIntents(mission) {
        const intents = [];
        const usedRanges = [];
        // Sort patterns by priority
        const sortedPatterns = [...this.patterns].sort((a, b) => b.priority - a.priority);
        for (const pattern of sortedPatterns) {
            for (const regex of pattern.patterns) {
                const matches = mission.matchAll(new RegExp(regex.source, regex.flags + 'g'));
                for (const match of matches) {
                    const start = match.index || 0;
                    const end = start + match[0].length;
                    // Skip if overlaps with existing intent
                    if (usedRanges.some(([s, e]) => start < e && end > s)) {
                        continue;
                    }
                    // Extract target hints
                    const targetHints = this.extractTargetHints(mission, pattern.selectorPatterns);
                    // Detect if conditional
                    const isConditional = pattern.actionType === 'conditional' ||
                        /\bif\b|\bwhen\b|\bunless\b/i.test(match[0]);
                    // Calculate confidence
                    const confidence = this.calculateIntentConfidence(match[0], pattern, targetHints);
                    intents.push({
                        text: match[0],
                        actionType: pattern.actionType,
                        confidence,
                        targetHints,
                        isConditional,
                        conditionType: isConditional ? this.inferConditionType(mission) : undefined,
                    });
                    usedRanges.push([start, end]);
                }
            }
        }
        // If no intents found, create a generic one
        if (intents.length === 0) {
            intents.push({
                text: mission,
                actionType: 'click', // Default assumption
                confidence: 0.3,
                targetHints: this.extractGenericTargets(mission),
                isConditional: false,
            });
        }
        return intents;
    }
    /**
     * Extract target hints using selector patterns.
     */
    extractTargetHints(mission, patterns) {
        const hints = [];
        for (const pattern of patterns) {
            const match = mission.match(pattern);
            if (match && match[1]) {
                const hint = match[1].trim().toLowerCase();
                if (hint && !hints.includes(hint)) {
                    hints.push(hint);
                }
            }
        }
        // Also extract quoted strings as potential targets
        const quotedMatches = mission.match(/["']([^"']+)["']/g);
        if (quotedMatches) {
            for (const q of quotedMatches) {
                const hint = q.replace(/["']/g, '').trim().toLowerCase();
                if (hint && !hints.includes(hint)) {
                    hints.push(hint);
                }
            }
        }
        return hints;
    }
    /**
     * Extract generic targets from mission text.
     */
    extractGenericTargets(mission) {
        const hints = [];
        // Look for common UI element references
        const elementPatterns = [
            /\b(button|link|input|field|menu|dropdown|checkbox|radio|tab|modal|dialog|popup)\b/gi,
            /\b(login|submit|cancel|close|save|delete|edit|create|add|remove|search)\b/gi,
        ];
        for (const pattern of elementPatterns) {
            const matches = mission.match(pattern);
            if (matches) {
                for (const m of matches) {
                    const hint = m.toLowerCase();
                    if (!hints.includes(hint)) {
                        hints.push(hint);
                    }
                }
            }
        }
        return hints;
    }
    /**
     * Calculate confidence for an identified intent.
     */
    calculateIntentConfidence(matchedText, pattern, targetHints) {
        let confidence = 0.6; // Base confidence
        // Higher confidence for longer matches
        if (matchedText.length > 20) {
            confidence += 0.1;
        }
        // Higher confidence with target hints
        if (targetHints.length > 0) {
            confidence += 0.15;
        }
        // Higher confidence for high-priority patterns
        if (pattern.priority >= 8) {
            confidence += 0.1;
        }
        // Lower confidence for generic patterns
        if (matchedText.split(/\s+/).length < 2) {
            confidence -= 0.1;
        }
        return Math.min(1, Math.max(0, confidence));
    }
    /**
     * Infer condition type from mission text.
     */
    inferConditionType(mission) {
        const lowerMission = mission.toLowerCase();
        if (/\b(url|page|address)\b.*\b(match|equals?|contains?|is)\b/i.test(mission)) {
            return 'url_matches';
        }
        if (/\b(text|message|label|says?|shows?)\b.*\b(visible|appears?|displays?)\b/i.test(mission)) {
            return 'text_visible';
        }
        // Default to element existence
        return 'element_exists';
    }
    /**
     * Register a custom pattern.
     */
    registerPattern(pattern) {
        this.patterns.push(pattern);
        // Re-sort by priority
        this.patterns.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Get all registered patterns.
     */
    getPatterns() {
        return [...this.patterns];
    }
    /**
     * Check if a mission is too ambiguous to process.
     */
    isAmbiguous(mission, threshold = 0.6) {
        const features = this.extractFeatures(mission);
        return features.ambiguityLevel >= threshold;
    }
    /**
     * Generate clarification questions for ambiguous missions.
     */
    generateClarifications(mission) {
        const intents = this.identifyIntents(mission);
        const questions = [];
        // Check for missing targets
        const missingTargets = intents.filter(i => i.targetHints.length === 0);
        for (const intent of missingTargets) {
            questions.push(`What element should I ${intent.actionType}? Please specify the button, link, or field name.`);
        }
        // Check for ambiguous actions
        if (intents.every(i => i.confidence < 0.5)) {
            questions.push('I\'m not sure what action you want me to take. Could you be more specific about what to click, type, or navigate to?');
        }
        // Check for missing URL
        const navIntent = intents.find(i => i.actionType === 'navigate');
        if (navIntent && !navIntent.targetHints.some(h => h.includes('http') || h.includes('.'))) {
            questions.push('What URL or page should I navigate to?');
        }
        // Check for missing values in fill actions
        const fillIntent = intents.find(i => i.actionType === 'fill');
        if (fillIntent) {
            questions.push('What value should I type into the field?');
        }
        // Default question if no specific ones
        if (questions.length === 0) {
            questions.push('Could you provide more details about what you want me to do?');
        }
        return questions;
    }
}
exports.IntentClassifier = IntentClassifier;
//# sourceMappingURL=intent-classifier.js.map
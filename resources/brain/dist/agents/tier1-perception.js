"use strict";
// @ts-nocheck
/**
 * CHROMADON Tier 1: Perception Layer
 * ===================================
 * THE VISION ANALYZER - Screenshot Analysis via Claude Vision
 * THE DOM INSPECTOR - DOM Parsing & Selector Generation
 * THE CONTEXT BUILDER - Page Context Synthesis
 * THE INTENT DECODER - Natural Language Intent Parsing
 *
 * These agents form the "eyes and understanding" of the system,
 * converting raw browser state into actionable intelligence.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPerceptionAgents = exports.TheIntentDecoder = exports.TheContextBuilder = exports.TheDOMInspector = exports.TheVisionAnalyzer = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const uuid_1 = require("uuid");
const types_1 = require("./types");
const event_bus_1 = require("./event-bus");
// =============================================================================
// BASE PERCEPTION AGENT CLASS
// =============================================================================
class BasePerceptionAgent {
    name;
    config;
    anthropic;
    eventBus;
    // Circuit breaker state
    failures = 0;
    lastFailure = 0;
    state = 'closed';
    constructor(name, config = {}) {
        this.name = name;
        this.config = {
            name,
            model: 'sonnet',
            maxRetries: 3,
            timeoutMs: 30000,
            circuitBreaker: {
                failureThreshold: 5,
                recoveryTimeMs: 60000,
                halfOpenRequests: 3,
            },
            ...config,
        };
        this.anthropic = new sdk_1.default();
        this.eventBus = (0, event_bus_1.getEventBus)();
    }
    getModelId() {
        switch (this.config.model) {
            case 'haiku':
                return 'claude-haiku-4-5-20251001';
            case 'sonnet':
                return 'claude-sonnet-4-20250514';
            case 'opus':
                return 'claude-opus-4-20250514';
            default:
                return 'claude-sonnet-4-20250514';
        }
    }
    async canExecute() {
        if (this.state === 'closed')
            return true;
        if (this.state === 'open') {
            if (Date.now() - this.lastFailure > this.config.circuitBreaker.recoveryTimeMs) {
                this.state = 'half_open';
                return true;
            }
            return false;
        }
        return true; // half_open allows attempts
    }
    recordSuccess() {
        if (this.state === 'half_open') {
            this.state = 'closed';
            this.failures = 0;
        }
    }
    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.config.circuitBreaker.failureThreshold || this.state === 'half_open') {
            this.state = 'open';
            this.publishEvent('circuit_breaker.opened', { agent: this.name, failures: this.failures });
        }
    }
    async callLLM(systemPrompt, userMessage, options = {}) {
        const response = await this.anthropic.messages.create({
            model: this.getModelId(),
            max_tokens: options.maxTokens ?? 4096,
            temperature: options.temperature ?? 0.3, // Lower temp for perception accuracy
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });
        const textBlock = response.content.find((b) => b.type === 'text');
        return textBlock?.type === 'text' ? textBlock.text : '';
    }
    async callVision(systemPrompt, imageBase64, userMessage, options = {}) {
        const response = await this.anthropic.messages.create({
            model: this.getModelId(),
            max_tokens: options.maxTokens ?? 4096,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: imageBase64,
                            },
                        },
                        {
                            type: 'text',
                            text: userMessage,
                        },
                    ],
                },
            ],
        });
        const textBlock = response.content.find((b) => b.type === 'text');
        return textBlock?.type === 'text' ? textBlock.text : '';
    }
    publishEvent(type, payload, correlationId) {
        this.eventBus.publish({
            type: type,
            source: this.name,
            correlationId: correlationId ?? (0, uuid_1.v4)(),
            payload,
        });
    }
}
// =============================================================================
// AGENT 5: THE VISION ANALYZER
// =============================================================================
/**
 * THE VISION ANALYZER
 * -------------------
 * Uses Claude Vision to understand screenshots and identify:
 * - Interactive elements (buttons, links, inputs)
 * - Page structure and layout
 * - Current state (logged in, error shown, etc.)
 * - Visual anomalies or blockers
 */
class TheVisionAnalyzer extends BasePerceptionAgent {
    constructor() {
        super('THE_VISION_ANALYZER', { model: 'sonnet' });
    }
    async analyzePage(screenshotBase64, context) {
        if (!(await this.canExecute())) {
            throw new Error('Vision Analyzer circuit breaker is open');
        }
        const startTime = Date.now();
        this.publishEvent('agent.started', { action: 'analyze_page', context });
        try {
            const systemPrompt = `You are THE VISION ANALYZER, an expert at understanding web page screenshots.
Your task is to analyze the screenshot and extract actionable information.

You must respond with a JSON object containing:
{
  "pageType": "login|dashboard|form|list|detail|error|loading|captcha|other",
  "title": "detected page title or description",
  "state": {
    "isLoggedIn": boolean,
    "hasErrors": boolean,
    "isLoading": boolean,
    "hasCaptcha": boolean,
    "hasModal": boolean,
    "hasPopup": boolean
  },
  "elements": [
    {
      "type": "button|link|input|select|checkbox|textarea|image|other",
      "text": "visible text or label",
      "purpose": "what this element does",
      "location": "top-left|top-center|top-right|middle-left|center|middle-right|bottom-left|bottom-center|bottom-right",
      "isClickable": boolean,
      "isVisible": boolean,
      "isPrimary": boolean,
      "approximateCoords": { "x": number, "y": number, "width": number, "height": number }
    }
  ],
  "forms": [
    {
      "purpose": "what this form does",
      "fields": [
        { "name": "field label", "type": "text|email|password|select|checkbox|etc", "required": boolean, "filled": boolean }
      ]
    }
  ],
  "blockers": ["list of things preventing progress, e.g., 'cookie banner blocking content'"],
  "suggestedAction": "what action would most likely advance the current task",
  "confidence": 0.0 to 1.0
}

Be thorough but focus on actionable elements. Identify the most likely next action to take.`;
            const userMessage = context?.lookingFor
                ? `Analyze this screenshot. I'm looking for: ${context.lookingFor}. ${context.previousAction ? `Previous action: ${context.previousAction}` : ''} ${context.url ? `URL: ${context.url}` : ''}`
                : `Analyze this screenshot comprehensively. ${context?.previousAction ? `Previous action: ${context.previousAction}` : ''} ${context?.url ? `URL: ${context.url}` : ''}`;
            const response = await this.callVision(systemPrompt, screenshotBase64, userMessage);
            // Parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse vision analysis response');
            }
            const analysis = JSON.parse(jsonMatch[0]);
            analysis.timestamp = Date.now();
            analysis.analysisMethod = 'vision';
            this.recordSuccess();
            this.publishEvent('agent.completed', {
                action: 'analyze_page',
                durationMs: Date.now() - startTime,
                elementsFound: analysis.elements?.length ?? 0,
                pageType: analysis.pageType,
            });
            return analysis;
        }
        catch (error) {
            this.recordFailure();
            this.publishEvent('agent.error', {
                action: 'analyze_page',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async findElement(screenshotBase64, description) {
        if (!(await this.canExecute())) {
            throw new Error('Vision Analyzer circuit breaker is open');
        }
        try {
            const systemPrompt = `You are THE VISION ANALYZER. Find the specific element described by the user.

Respond with JSON:
{
  "found": boolean,
  "element": {
    "type": "button|link|input|select|etc",
    "text": "visible text",
    "location": "position description",
    "approximateCoords": { "x": number, "y": number, "width": number, "height": number },
    "confidence": 0.0 to 1.0
  } | null,
  "alternatives": [similar elements if exact match not found],
  "reason": "explanation"
}

Coordinates should be approximate pixel positions from top-left of viewport.`;
            const response = await this.callVision(systemPrompt, screenshotBase64, `Find this element: ${description}`);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                return null;
            const result = JSON.parse(jsonMatch[0]);
            this.recordSuccess();
            return result.found ? result.element : null;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    async compareScreenshots(before, after, expectedChange) {
        if (!(await this.canExecute())) {
            throw new Error('Vision Analyzer circuit breaker is open');
        }
        try {
            // Note: This requires sending both images in sequence since Claude's API
            // doesn't support multiple images in one message directly in this format
            const systemPrompt = `You are THE VISION ANALYZER comparing two screenshots.
The user will describe what change was expected. Analyze if that change occurred.

Respond with JSON:
{
  "changed": boolean,
  "changes": ["list of visible changes"],
  "success": boolean (did the expected change happen?),
  "confidence": 0.0 to 1.0,
  "explanation": "what happened"
}`;
            // First analyze the "before" state
            const beforeAnalysis = await this.callVision('Describe this screenshot briefly, focusing on key interactive elements and state.', before, 'Analyze this "BEFORE" screenshot.');
            // Then analyze "after" with context
            const response = await this.callVision(systemPrompt, after, `BEFORE state: ${beforeAnalysis}\n\nExpected change: ${expectedChange}\n\nAnalyze if the expected change occurred in this "AFTER" screenshot.`);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { changed: false, changes: [], success: false };
            }
            const result = JSON.parse(jsonMatch[0]);
            this.recordSuccess();
            return {
                changed: result.changed,
                changes: result.changes,
                success: result.success,
            };
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
}
exports.TheVisionAnalyzer = TheVisionAnalyzer;
__decorate([
    (0, event_bus_1.traced)('vision_analyzer.analyze_page'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TheVisionAnalyzer.prototype, "analyzePage", null);
__decorate([
    (0, event_bus_1.traced)('vision_analyzer.find_element'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheVisionAnalyzer.prototype, "findElement", null);
__decorate([
    (0, event_bus_1.traced)('vision_analyzer.compare_screenshots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], TheVisionAnalyzer.prototype, "compareScreenshots", null);
// =============================================================================
// AGENT 6: THE DOM INSPECTOR
// =============================================================================
/**
 * THE DOM INSPECTOR
 * -----------------
 * Parses DOM structure and generates reliable selectors.
 * Works with raw HTML/DOM snapshots from the browser.
 */
class TheDOMInspector extends BasePerceptionAgent {
    selectorCache = new Map();
    constructor() {
        super('THE_DOM_INSPECTOR', { model: 'haiku' }); // Fast model for DOM parsing
    }
    async parseDOM(html, focusArea) {
        if (!(await this.canExecute())) {
            throw new Error('DOM Inspector circuit breaker is open');
        }
        const startTime = Date.now();
        this.publishEvent('agent.started', { action: 'parse_dom', focusArea });
        try {
            // Use LLM to extract structured info from HTML
            const systemPrompt = `You are THE DOM INSPECTOR. Parse the HTML and extract interactive elements.

Respond with JSON:
{
  "title": "page title",
  "forms": [
    {
      "id": "form id or generated",
      "action": "form action url",
      "method": "GET|POST",
      "fields": [
        {
          "name": "field name",
          "type": "text|email|password|select|checkbox|radio|textarea|hidden|submit|button",
          "label": "associated label",
          "required": boolean,
          "value": "current value if any",
          "options": ["for select/radio"],
          "selector": "CSS selector"
        }
      ]
    }
  ],
  "buttons": [
    { "text": "button text", "type": "submit|button|link", "selector": "CSS selector", "disabled": boolean }
  ],
  "links": [
    { "text": "link text", "href": "url", "selector": "CSS selector" }
  ],
  "inputs": [
    { "type": "input type", "name": "name", "placeholder": "placeholder", "selector": "CSS selector" }
  ],
  "iframes": [
    { "id": "iframe id", "src": "source url" }
  ],
  "modals": [
    { "visible": boolean, "content": "modal content summary", "closeButton": "selector" }
  ]
}

Focus on actionable elements. Generate specific CSS selectors using id > data-* > class > tag hierarchy.`;
            const userMessage = focusArea
                ? `Parse this HTML, focusing on: ${focusArea}\n\n${html.substring(0, 50000)}`
                : `Parse this HTML comprehensively:\n\n${html.substring(0, 50000)}`;
            const response = await this.callLLM(systemPrompt, userMessage);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse DOM analysis response');
            }
            const snapshot = JSON.parse(jsonMatch[0]);
            snapshot.timestamp = Date.now();
            snapshot.rawLength = html.length;
            this.recordSuccess();
            this.publishEvent('agent.completed', {
                action: 'parse_dom',
                durationMs: Date.now() - startTime,
                formsFound: snapshot.forms?.length ?? 0,
                buttonsFound: snapshot.buttons?.length ?? 0,
            });
            return snapshot;
        }
        catch (error) {
            this.recordFailure();
            this.publishEvent('agent.error', {
                action: 'parse_dom',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async generateSelector(html, elementDescription) {
        // Check cache first
        const cacheKey = `${elementDescription}_${html.length}`;
        if (this.selectorCache.has(cacheKey)) {
            return this.selectorCache.get(cacheKey);
        }
        if (!(await this.canExecute())) {
            throw new Error('DOM Inspector circuit breaker is open');
        }
        try {
            const systemPrompt = `You are THE DOM INSPECTOR. Generate robust CSS selectors for the described element.

Respond with JSON:
{
  "primary": "most specific and stable selector",
  "fallbacks": ["alternative selectors in order of preference"],
  "xpath": "XPath expression as backup",
  "strategy": "id|data-attribute|aria|class|structural",
  "confidence": 0.0 to 1.0,
  "reasoning": "why this selector strategy"
}

Prefer selectors in this order:
1. #id (if unique and stable)
2. [data-testid], [data-cy], [data-test]
3. [aria-label], [aria-labelledby]
4. .specific-class (avoid generic like .btn)
5. form[name] input[name]
6. Structural: nth-child, adjacent sibling`;
            const response = await this.callLLM(systemPrompt, `Find selector for: ${elementDescription}\n\nHTML:\n${html.substring(0, 30000)}`);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to generate selector');
            }
            const strategy = JSON.parse(jsonMatch[0]);
            // Cache the result
            this.selectorCache.set(cacheKey, strategy);
            this.recordSuccess();
            return strategy;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    async findFormFields(html, formPurpose) {
        if (!(await this.canExecute())) {
            throw new Error('DOM Inspector circuit breaker is open');
        }
        try {
            const systemPrompt = `You are THE DOM INSPECTOR. Find all form fields for the described form purpose.

Respond with JSON array:
[
  {
    "fieldName": "human-readable field name",
    "selector": "CSS selector",
    "type": "text|email|password|select|checkbox|radio|textarea|file",
    "required": boolean,
    "label": "associated label text",
    "placeholder": "placeholder text if any",
    "options": ["for select/radio fields"]
  }
]

Order fields by their visual appearance (top to bottom, left to right).`;
            const response = await this.callLLM(systemPrompt, `Find form fields for: ${formPurpose}\n\nHTML:\n${html.substring(0, 40000)}`);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch)
                return [];
            const fields = JSON.parse(jsonMatch[0]);
            this.recordSuccess();
            return fields;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    clearCache() {
        this.selectorCache.clear();
    }
}
exports.TheDOMInspector = TheDOMInspector;
__decorate([
    (0, event_bus_1.traced)('dom_inspector.parse_dom'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheDOMInspector.prototype, "parseDOM", null);
__decorate([
    (0, event_bus_1.traced)('dom_inspector.generate_selector'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheDOMInspector.prototype, "generateSelector", null);
__decorate([
    (0, event_bus_1.traced)('dom_inspector.find_form_fields'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheDOMInspector.prototype, "findFormFields", null);
// =============================================================================
// AGENT 7: THE CONTEXT BUILDER
// =============================================================================
/**
 * THE CONTEXT BUILDER
 * -------------------
 * Synthesizes information from Vision and DOM into unified page context.
 * Creates rich understanding of current state for decision-making.
 */
class TheContextBuilder extends BasePerceptionAgent {
    constructor() {
        super('THE_CONTEXT_BUILDER', { model: 'sonnet' });
    }
    async buildContext(visionAnalysis, domSnapshot, additionalInfo) {
        if (!(await this.canExecute())) {
            throw new Error('Context Builder circuit breaker is open');
        }
        const startTime = Date.now();
        this.publishEvent('agent.started', { action: 'build_context' });
        try {
            const systemPrompt = `You are THE CONTEXT BUILDER. Synthesize vision and DOM analysis into unified page context.

Given vision analysis and DOM snapshot, create a comprehensive context object.

Respond with JSON:
{
  "pageIdentity": {
    "type": "login|signup|dashboard|form|list|detail|checkout|search|profile|settings|error|other",
    "title": "page title",
    "platform": "detected platform (facebook, google, etc) or null",
    "confidence": 0.0 to 1.0
  },
  "currentState": {
    "authenticated": boolean | null,
    "completionPercent": number (0-100 for multi-step flows),
    "hasErrors": boolean,
    "errorMessages": ["visible error messages"],
    "hasBlockers": boolean,
    "blockers": ["things blocking progress"],
    "isLoading": boolean
  },
  "availableActions": [
    {
      "action": "click|type|select|upload|submit|navigate|wait|scroll",
      "target": "element description",
      "selector": "CSS selector if known",
      "purpose": "what this action accomplishes",
      "priority": 1-10 (10 = most relevant to goal),
      "risk": "low|medium|high"
    }
  ],
  "dataExtracted": {
    "visibleText": ["key text content"],
    "formData": {"field": "current value"},
    "links": [{"text": "link text", "url": "href"}],
    "metadata": {}
  },
  "navigationOptions": [
    {"text": "nav item text", "url": "destination", "type": "menu|link|button"}
  ],
  "suggestedNextAction": {
    "action": "recommended action",
    "target": "target element",
    "rationale": "why this action"
  }
}`;
            const userMessage = `
Vision Analysis:
${JSON.stringify(visionAnalysis, null, 2)}

DOM Snapshot:
${JSON.stringify(domSnapshot, null, 2)}

${additionalInfo?.url ? `Current URL: ${additionalInfo.url}` : ''}
${additionalInfo?.taskGoal ? `Task Goal: ${additionalInfo.taskGoal}` : ''}
${additionalInfo?.previousActions ? `Previous Actions: ${additionalInfo.previousActions.join(' → ')}` : ''}

Build a unified context for decision-making.`;
            const response = await this.callLLM(systemPrompt, userMessage);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to build context');
            }
            const context = JSON.parse(jsonMatch[0]);
            context.timestamp = Date.now();
            context.sources = {
                visionTimestamp: visionAnalysis.timestamp,
                domTimestamp: domSnapshot.timestamp,
            };
            this.recordSuccess();
            this.publishEvent('agent.completed', {
                action: 'build_context',
                durationMs: Date.now() - startTime,
                pageType: context.pageIdentity?.type,
                actionsAvailable: context.availableActions?.length ?? 0,
            });
            return context;
        }
        catch (error) {
            this.recordFailure();
            this.publishEvent('agent.error', {
                action: 'build_context',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async assessRisk(context, proposedAction) {
        if (!(await this.canExecute())) {
            throw new Error('Context Builder circuit breaker is open');
        }
        try {
            const systemPrompt = `You are THE CONTEXT BUILDER assessing action risk.

Respond with JSON:
{
  "level": "low|medium|high|critical",
  "reasons": ["why this risk level"],
  "mitigations": ["how to reduce risk"],
  "shouldProceed": boolean,
  "requiresConfirmation": boolean
}

Risk factors:
- Financial transactions = critical
- Account changes = high
- Data submission = medium
- Navigation = low
- Irreversible actions = increase by 1 level`;
            const response = await this.callLLM(systemPrompt, `Context: ${JSON.stringify(context, null, 2)}\n\nProposed Action: ${proposedAction}`);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { level: 'medium', reasons: ['Unable to assess'], mitigations: [] };
            }
            const assessment = JSON.parse(jsonMatch[0]);
            this.recordSuccess();
            return {
                level: assessment.level,
                reasons: assessment.reasons,
                mitigations: assessment.mitigations,
            };
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
}
exports.TheContextBuilder = TheContextBuilder;
__decorate([
    (0, event_bus_1.traced)('context_builder.build_context'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_a = typeof types_1.DOMSnapshot !== "undefined" && types_1.DOMSnapshot) === "function" ? _a : Object, Object]),
    __metadata("design:returntype", Promise)
], TheContextBuilder.prototype, "buildContext", null);
__decorate([
    (0, event_bus_1.traced)('context_builder.assess_risk'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof types_1.PageContext !== "undefined" && types_1.PageContext) === "function" ? _b : Object, String]),
    __metadata("design:returntype", Promise)
], TheContextBuilder.prototype, "assessRisk", null);
// =============================================================================
// AGENT 8: THE INTENT DECODER
// =============================================================================
/**
 * THE INTENT DECODER
 * ------------------
 * Parses natural language commands into structured intents.
 * Handles ambiguity, multi-step tasks, and context-aware interpretation.
 */
class TheIntentDecoder extends BasePerceptionAgent {
    intentPatterns;
    constructor() {
        super('THE_INTENT_DECODER', { model: 'sonnet' });
        this.intentPatterns = new Map([
            // Navigation patterns
            ['go to', 'navigate'],
            ['open', 'navigate'],
            ['visit', 'navigate'],
            // Authentication patterns
            ['log in', 'authenticate'],
            ['sign in', 'authenticate'],
            ['login', 'authenticate'],
            // Form patterns
            ['fill', 'form_fill'],
            ['enter', 'form_fill'],
            ['type', 'form_fill'],
            // Click patterns
            ['click', 'click'],
            ['press', 'click'],
            ['tap', 'click'],
            // Search patterns
            ['search', 'search'],
            ['find', 'search'],
            ['look for', 'search'],
            // Create patterns
            ['create', 'create'],
            ['make', 'create'],
            ['set up', 'create'],
            // Extract patterns
            ['get', 'extract'],
            ['copy', 'extract'],
            ['download', 'extract'],
            ['scrape', 'extract'],
        ]);
    }
    async decode(naturalLanguageCommand, context) {
        if (!(await this.canExecute())) {
            throw new Error('Intent Decoder circuit breaker is open');
        }
        const startTime = Date.now();
        this.publishEvent('agent.started', { action: 'decode', command: naturalLanguageCommand });
        try {
            const systemPrompt = `You are THE INTENT DECODER. Parse natural language into structured browser automation intents.

Given a command, identify:
1. Primary intent type
2. Target (what to interact with)
3. Parameters (values, conditions)
4. Sub-intents (for multi-step tasks)

Respond with JSON:
{
  "raw": "original command",
  "primaryIntent": "navigate|authenticate|form_fill|click|search|create|extract|scroll|wait|upload|download|verify|custom",
  "confidence": 0.0 to 1.0,
  "target": {
    "type": "url|element|text|file|area",
    "value": "specific target",
    "selector": "CSS selector if determinable",
    "alternatives": ["other possible targets"]
  },
  "parameters": {
    "key": "value pairs for the action"
  },
  "subIntents": [
    {"intent": "sub-action", "target": {...}, "order": 1}
  ],
  "context": {
    "requiresAuth": boolean,
    "platform": "detected platform or null",
    "estimatedSteps": number,
    "riskLevel": "low|medium|high"
  },
  "clarificationNeeded": boolean,
  "clarificationQuestions": ["questions if ambiguous"]
}

Examples:
- "Log into Facebook" → authenticate intent, platform: facebook
- "Create a business page for my bakery" → create intent with sub-intents
- "Find John Smith's email on LinkedIn" → search then extract intents`;
            const userMessage = context
                ? `Command: ${naturalLanguageCommand}\n\nCurrent Page Context:\n${JSON.stringify(context, null, 2)}`
                : `Command: ${naturalLanguageCommand}`;
            const response = await this.callLLM(systemPrompt, userMessage);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to decode intent');
            }
            const intent = JSON.parse(jsonMatch[0]);
            intent.timestamp = Date.now();
            intent.decodingDurationMs = Date.now() - startTime;
            this.recordSuccess();
            this.publishEvent('agent.completed', {
                action: 'decode',
                durationMs: Date.now() - startTime,
                primaryIntent: intent.primaryIntent,
                confidence: intent.confidence,
            });
            return intent;
        }
        catch (error) {
            this.recordFailure();
            this.publishEvent('agent.error', {
                action: 'decode',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async resolveAmbiguity(intent, clarification) {
        if (!(await this.canExecute())) {
            throw new Error('Intent Decoder circuit breaker is open');
        }
        try {
            const systemPrompt = `You are THE INTENT DECODER resolving ambiguity.

Given the original intent and user clarification, produce a refined intent.

Respond with the same JSON structure as the original intent, but refined.`;
            const response = await this.callLLM(systemPrompt, `Original Intent:\n${JSON.stringify(intent, null, 2)}\n\nUser Clarification: ${clarification}`);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return intent; // Return original if can't refine
            }
            const refined = JSON.parse(jsonMatch[0]);
            refined.clarificationNeeded = false;
            refined.clarificationQuestions = [];
            this.recordSuccess();
            return refined;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    async decomposeComplex(intent) {
        if (!(await this.canExecute())) {
            throw new Error('Intent Decoder circuit breaker is open');
        }
        try {
            const systemPrompt = `You are THE INTENT DECODER decomposing complex intents.

Break down a complex intent into atomic, sequential intents.

Respond with JSON array:
[
  {
    "order": 1,
    "intent": {...same structure as ParsedIntent...},
    "dependsOn": [],
    "canParallelize": boolean
  }
]

Each atomic intent should be a single browser action.`;
            const response = await this.callLLM(systemPrompt, `Complex Intent:\n${JSON.stringify(intent, null, 2)}\n\nDecompose into atomic steps.`);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch)
                return [intent];
            const steps = JSON.parse(jsonMatch[0]);
            this.recordSuccess();
            return steps.map((s) => s.intent);
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    // Quick pattern matching for simple intents (no LLM needed)
    quickMatch(command) {
        const lower = command.toLowerCase();
        for (const [pattern, intent] of this.intentPatterns) {
            if (lower.includes(pattern)) {
                return intent;
            }
        }
        return null;
    }
}
exports.TheIntentDecoder = TheIntentDecoder;
__decorate([
    (0, event_bus_1.traced)('intent_decoder.decode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_c = typeof types_1.PageContext !== "undefined" && types_1.PageContext) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], TheIntentDecoder.prototype, "decode", null);
__decorate([
    (0, event_bus_1.traced)('intent_decoder.resolve_ambiguity'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TheIntentDecoder.prototype, "resolveAmbiguity", null);
__decorate([
    (0, event_bus_1.traced)('intent_decoder.decompose_complex'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheIntentDecoder.prototype, "decomposeComplex", null);
// =============================================================================
// FACTORY & EXPORTS
// =============================================================================
function createPerceptionAgents() {
    return {
        visionAnalyzer: new TheVisionAnalyzer(),
        domInspector: new TheDOMInspector(),
        contextBuilder: new TheContextBuilder(),
        intentDecoder: new TheIntentDecoder(),
    };
}
exports.createPerceptionAgents = createPerceptionAgents;

"use strict";
// @ts-nocheck
/**
 * CHROMADON Tier 0: Orchestration Layer
 * ======================================
 * THE CORTEX - Master Planner
 * THE TEMPORAL SEQUENCER - Workflow Executor
 * THE SENTINEL - Verification Agent
 * THE MEMORY KEEPER - Persistence Agent
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryKeeper = exports.sentinel = exports.temporalSequencer = exports.cortex = exports.TheMemoryKeeper = exports.TheSentinel = exports.TheTemporalSequencer = exports.TheCortex = exports.BaseAgent = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const uuid_1 = require("uuid");
const gemini_llm_1 = require("./gemini-llm");
const event_bus_1 = require("./event-bus");
// =============================================================================
// BASE AGENT CLASS
// =============================================================================
class BaseAgent {
    name;
    config;
    anthropic;
    eventBus;
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
        return (0, gemini_llm_1.getGeminiModelId)(this.config.model);
    }
    async callLLM(systemPrompt, userMessage, options = {}) {
        return (0, gemini_llm_1.callGemini)(systemPrompt, userMessage, {
            model: this.config.model,
            maxTokens: options.maxTokens ?? 4096,
            temperature: options.temperature ?? 0.7,
        });
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
exports.BaseAgent = BaseAgent;
// =============================================================================
// AGENT 1: THE CORTEX (Master Planner)
// =============================================================================
class TheCortex extends BaseAgent {
    workflowTemplates;
    constructor() {
        super('THE_CORTEX', { model: 'sonnet' });
        this.workflowTemplates = new Map();
        this.loadWorkflowTemplates();
    }
    loadWorkflowTemplates() {
        // Pre-built templates for common tasks
        this.workflowTemplates.set('create_facebook_business_page', {
            id: 'tpl_fb_business',
            name: 'Create Facebook Business Page',
            description: 'Complete flow for creating a new Facebook Business Page',
            nodes: [
                { id: '1', agent: 'THE_AUTH_GUARDIAN', action: 'ensure_logged_in', params: { platform: 'facebook' }, dependsOn: [], checkpoint: true },
                { id: '2', agent: 'THE_NAVIGATOR', action: 'navigate', params: { url: 'https://www.facebook.com/pages/create' }, dependsOn: ['1'] },
                { id: '3', agent: 'THE_VISION_ANALYZER', action: 'analyze_page', params: {}, dependsOn: ['2'] },
                { id: '4', agent: 'THE_CLICKER', action: 'click', params: { target: 'business_option' }, dependsOn: ['3'] },
                { id: '5', agent: 'THE_FORM_MASTER', action: 'fill_field', params: { field: 'page_name' }, dependsOn: ['4'] },
                { id: '6', agent: 'THE_SELECTOR', action: 'select', params: { field: 'category' }, dependsOn: ['5'] },
                { id: '7', agent: 'THE_CONTENT_GENERATOR', action: 'generate', params: { type: 'business_description' }, dependsOn: ['6'] },
                { id: '8', agent: 'THE_TYPER', action: 'type', params: { field: 'description' }, dependsOn: ['7'] },
                { id: '9', agent: 'THE_FILE_HANDLER', action: 'upload', params: { field: 'profile_photo' }, dependsOn: ['8'], optional: true },
                { id: '10', agent: 'THE_FILE_HANDLER', action: 'upload', params: { field: 'cover_photo' }, dependsOn: ['9'], optional: true },
                { id: '11', agent: 'THE_CLICKER', action: 'click', params: { target: 'create_page_button' }, dependsOn: ['10'], checkpoint: true },
                { id: '12', agent: 'THE_SENTINEL', action: 'verify', params: { expected: 'page_created' }, dependsOn: ['11'] },
            ],
            metadata: {
                estimatedDurationMs: 120000,
                requiredAgents: ['THE_AUTH_GUARDIAN', 'THE_NAVIGATOR', 'THE_VISION_ANALYZER', 'THE_CLICKER', 'THE_FORM_MASTER', 'THE_SELECTOR', 'THE_CONTENT_GENERATOR', 'THE_TYPER', 'THE_FILE_HANDLER', 'THE_SENTINEL'],
                riskLevel: 'medium',
                checkpointCount: 2,
            },
        });
        // Add more templates...
        this.workflowTemplates.set('create_instagram_business', { /* ... */});
        this.workflowTemplates.set('create_linkedin_company', { /* ... */});
    }
    async planWorkflow(userRequest, context) {
        this.publishEvent('TASK_RECEIVED', { userRequest, context });
        // First, try to match a template
        const templateMatch = this.findMatchingTemplate(userRequest);
        if (templateMatch) {
            const customized = this.customizeTemplate(templateMatch, context ?? {});
            this.publishEvent('PLAN_CREATED', customized);
            return customized;
        }
        // Otherwise, generate a custom workflow using LLM
        const systemPrompt = `You are THE CORTEX, the master planning agent for CHROMADON browser automation.

Your job is to decompose user requests into executable workflow DAGs (Directed Acyclic Graphs).

Available agents and their capabilities:
- THE_AUTH_GUARDIAN: Login, logout, session management, 2FA handling
- THE_NAVIGATOR: URL navigation, page loading, history navigation
- THE_VISION_ANALYZER: Screenshot analysis, visual page understanding
- THE_DOM_INSPECTOR: DOM analysis, element finding, selector generation
- THE_CONTEXT_BUILDER: Page context synthesis
- THE_INTENT_DECODER: User intent parsing
- THE_FORM_MASTER: Form detection and intelligent filling
- THE_CONTENT_GENERATOR: Text content generation (descriptions, posts, bios)
- THE_FILE_HANDLER: File upload/download, image generation
- THE_CLICKER: Click operations
- THE_TYPER: Keyboard input, typing
- THE_SCROLLER: Page scrolling
- THE_SELECTOR: Dropdown/select operations
- THE_SOCIAL_MEDIA_PRO: Platform-specific social media operations
- THE_ECOMMERCE_EXPERT: Shopping, checkout operations
- THE_CAPTCHA_BREAKER: CAPTCHA detection and solving
- THE_DATA_EXTRACTOR: Web scraping, data extraction
- THE_RESEARCH_AGENT: Multi-source research
- THE_BOOKING_AGENT: Reservations, appointments
- THE_PAYMENT_HANDLER: Payment processing
- THE_ERROR_HANDLER: Error detection
- THE_RECOVERY_EXPERT: Failure recovery
- THE_SENTINEL: Action verification
- THE_LEARNING_ENGINE: Pattern learning

Rules:
1. Break complex tasks into atomic steps
2. Identify dependencies between steps
3. Mark critical checkpoints for recovery
4. Estimate duration and risk level
5. Consider failure paths and alternatives

Output your plan as a JSON object matching the WorkflowDAG interface.`;
        const userPrompt = `User Request: "${userRequest}"

Context: ${JSON.stringify(context ?? {})}

Create a detailed workflow plan as JSON. Include all necessary steps, dependencies, and checkpoints.`;
        const response = await this.callLLM(systemPrompt, userPrompt, { temperature: 0.3 });
        // Parse the response
        const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        try {
            const raw = JSON.parse(jsonStr);
            // Normalize nodes: LLM often returns {nodeId: {...}} object instead of [{id, ...}] array
            let nodes;
            if (Array.isArray(raw.nodes)) {
                nodes = raw.nodes.map((n) => ({
                    id: n.id,
                    agent: n.agent,
                    action: n.action,
                    params: n.params || n.parameters || {},
                    dependsOn: n.dependsOn || n.dependencies || [],
                    checkpoint: n.checkpoint,
                    optional: n.optional,
                    timeout: n.timeout,
                }));
            }
            else if (raw.nodes && typeof raw.nodes === 'object') {
                nodes = Object.entries(raw.nodes).map(([id, n]) => ({
                    id,
                    agent: n.agent,
                    action: n.action,
                    params: n.params || n.parameters || {},
                    dependsOn: n.dependsOn || n.dependencies || [],
                    checkpoint: n.checkpoint,
                    optional: n.optional,
                    timeout: n.timeout,
                }));
            }
            else {
                nodes = [];
            }
            const workflow = {
                id: (0, uuid_1.v4)(),
                name: raw.workflow_name || raw.name || 'workflow',
                description: raw.description || '',
                nodes,
                metadata: {
                    estimatedDurationMs: raw.metadata?.estimatedDurationMs || 30000,
                    requiredAgents: raw.metadata?.requiredAgents || nodes.map((n) => n.agent),
                    riskLevel: raw.metadata?.riskLevel || raw.metadata?.risk_level || 'low',
                    checkpointCount: raw.metadata?.checkpointCount || raw.checkpoints?.length || 0,
                },
            };
            this.publishEvent('PLAN_CREATED', workflow);
            return workflow;
        }
        catch (error) {
            throw new Error(`Failed to parse workflow plan: ${error.message}`);
        }
    }
    findMatchingTemplate(request) {
        const lowerRequest = request.toLowerCase();
        // Simple keyword matching (could be enhanced with embeddings)
        if (lowerRequest.includes('facebook') && (lowerRequest.includes('page') || lowerRequest.includes('business'))) {
            return this.workflowTemplates.get('create_facebook_business_page') ?? null;
        }
        if (lowerRequest.includes('instagram') && lowerRequest.includes('business')) {
            return this.workflowTemplates.get('create_instagram_business') ?? null;
        }
        if (lowerRequest.includes('linkedin') && lowerRequest.includes('company')) {
            return this.workflowTemplates.get('create_linkedin_company') ?? null;
        }
        return null;
    }
    customizeTemplate(template, context) {
        // Deep clone and customize with context
        const customized = JSON.parse(JSON.stringify(template));
        customized.id = (0, uuid_1.v4)();
        // Inject context into node params
        for (const node of customized.nodes) {
            if (node.params) {
                for (const [key, value] of Object.entries(context)) {
                    if (typeof node.params[key] === 'undefined') {
                        node.params[key] = value;
                    }
                }
            }
        }
        return customized;
    }
    async estimateComplexity(request) {
        const systemPrompt = `Analyze the complexity of this browser automation task.
Rate complexity 1-10, estimate steps, duration, and risk level.
Output as JSON with: complexity, estimatedSteps, estimatedDurationMs, riskLevel, requiredCapabilities[]`;
        const response = await this.callLLM(systemPrompt, request, { temperature: 0.2 });
        const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        return JSON.parse(jsonStr);
    }
}
exports.TheCortex = TheCortex;
__decorate([
    (0, event_bus_1.traced)('CORTEX.planWorkflow'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TheCortex.prototype, "planWorkflow", null);
__decorate([
    (0, event_bus_1.traced)('CORTEX.estimateComplexity'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheCortex.prototype, "estimateComplexity", null);
// =============================================================================
// AGENT 2: THE TEMPORAL SEQUENCER (Workflow Executor)
// =============================================================================
class TheTemporalSequencer extends BaseAgent {
    executionContexts;
    pausedWorkflows;
    constructor() {
        super('THE_TEMPORAL_SEQUENCER', { model: 'haiku' });
        this.executionContexts = new Map();
        this.pausedWorkflows = new Set();
    }
    async *execute(workflow, initialContext) {
        const context = {
            workflowId: workflow.id,
            currentStep: '',
            completedSteps: [],
            pendingSteps: workflow.nodes.map((n) => n.id),
            checkpoints: [],
            variables: new Map(Object.entries(initialContext ?? {})),
            startTime: Date.now(),
            lastActivityTime: Date.now(),
        };
        this.executionContexts.set(workflow.id, context);
        this.publishEvent('TASK_RECEIVED', { workflowId: workflow.id });
        // Build dependency graph
        const dependencyMap = new Map();
        for (const node of workflow.nodes) {
            dependencyMap.set(node.id, node.dependsOn);
        }
        // Execute in topological order
        while (context.pendingSteps.length > 0) {
            // Check if paused
            if (this.pausedWorkflows.has(workflow.id)) {
                await this.waitForResume(workflow.id);
            }
            // Find executable steps (all dependencies satisfied)
            const executable = context.pendingSteps.filter((stepId) => {
                const deps = dependencyMap.get(stepId) ?? [];
                return deps.every((dep) => context.completedSteps.includes(dep));
            });
            if (executable.length === 0) {
                throw new Error('Workflow stuck: no executable steps available');
            }
            // Execute next step
            const stepId = executable[0];
            const node = workflow.nodes.find((n) => n.id === stepId);
            context.currentStep = stepId;
            context.lastActivityTime = Date.now();
            this.publishEvent('STEP_STARTED', { stepId, agent: node.agent, action: node.action });
            // Create checkpoint if marked
            if (node.checkpoint) {
                const checkpoint = this.createCheckpoint(context);
                context.checkpoints.push(checkpoint);
                this.publishEvent('CHECKPOINT_CREATED', checkpoint);
            }
            // Execute the step
            const result = await this.executeStep(node, context);
            // Handle result
            if (result.success) {
                context.completedSteps.push(stepId);
                context.pendingSteps = context.pendingSteps.filter((s) => s !== stepId);
                this.publishEvent('STEP_COMPLETED', result);
            }
            else {
                // If optional, skip; otherwise fail
                if (node.optional) {
                    context.completedSteps.push(stepId);
                    context.pendingSteps = context.pendingSteps.filter((s) => s !== stepId);
                    this.publishEvent('STEP_COMPLETED', { ...result, skipped: true });
                }
                else {
                    this.publishEvent('STEP_FAILED', result);
                    throw new Error(`Step ${stepId} failed: ${result.error?.message}`);
                }
            }
            // Inject human-like delays
            await this.humanDelay();
            yield result;
        }
        this.publishEvent('TASK_COMPLETED', {
            workflowId: workflow.id,
            duration: Date.now() - context.startTime,
            steps: context.completedSteps.length,
        });
        this.executionContexts.delete(workflow.id);
    }
    async executeStep(node, context) {
        const startTime = Date.now();
        try {
            // Request execution from the target agent
            const result = await this.eventBus.request(node.agent, this.name, node.action, {
                params: node.params,
                variables: Object.fromEntries(context.variables),
            }, { timeoutMs: node.timeout ?? this.config.timeoutMs });
            return {
                nodeId: node.id,
                agent: node.agent,
                action: node.action,
                success: true,
                data: result,
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
        catch (error) {
            return {
                nodeId: node.id,
                agent: node.agent,
                action: node.action,
                success: false,
                error: {
                    type: 'unknown',
                    category: 'unknown',
                    message: error.message,
                    recoverable: true,
                    timestamp: Date.now(),
                    agent: node.agent,
                    step: node.id,
                },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
    }
    createCheckpoint(context) {
        return {
            id: (0, uuid_1.v4)(),
            stepId: context.currentStep,
            timestamp: Date.now(),
            state: JSON.parse(JSON.stringify(context)),
        };
    }
    async humanDelay() {
        const minDelay = 300;
        const maxDelay = 1500;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        await new Promise((r) => setTimeout(r, delay));
    }
    async waitForResume(workflowId) {
        while (this.pausedWorkflows.has(workflowId)) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    pause(workflowId) {
        this.pausedWorkflows.add(workflowId);
        this.publishEvent('TASK_RECEIVED', { workflowId, action: 'paused' });
    }
    resume(workflowId) {
        this.pausedWorkflows.delete(workflowId);
        this.publishEvent('TASK_RECEIVED', { workflowId, action: 'resumed' });
    }
    rollbackTo(workflowId, checkpointId) {
        const context = this.executionContexts.get(workflowId);
        if (!context)
            return false;
        const checkpoint = context.checkpoints.find((c) => c.id === checkpointId);
        if (!checkpoint)
            return false;
        // Restore state
        Object.assign(context, checkpoint.state);
        return true;
    }
    getProgress(workflowId) {
        const context = this.executionContexts.get(workflowId);
        if (!context)
            return null;
        const totalSteps = context.completedSteps.length + context.pendingSteps.length;
        const completedSteps = context.completedSteps.length;
        const percentComplete = (completedSteps / totalSteps) * 100;
        // Estimate remaining time based on average step duration
        const elapsed = Date.now() - context.startTime;
        const avgStepTime = elapsed / Math.max(completedSteps, 1);
        const estimatedRemainingMs = avgStepTime * context.pendingSteps.length;
        let status = 'running';
        if (this.pausedWorkflows.has(workflowId))
            status = 'paused';
        if (context.pendingSteps.length === 0)
            status = 'completed';
        return {
            workflowId,
            totalSteps,
            completedSteps,
            currentStep: context.currentStep,
            percentComplete,
            estimatedRemainingMs,
            status,
        };
    }
}
exports.TheTemporalSequencer = TheTemporalSequencer;
// =============================================================================
// AGENT 3: THE SENTINEL (Verification Agent)
// =============================================================================
class TheSentinel extends BaseAgent {
    constructor() {
        super('THE_SENTINEL', { model: 'sonnet' });
    }
    async verify(action, expected, screenshot, domState) {
        const systemPrompt = `You are THE SENTINEL, the verification agent for CHROMADON.

Your job is to verify that browser actions completed successfully.

Analyze the provided evidence (screenshot, DOM state) and determine:
1. Did the action succeed?
2. How confident are you? (0-1)
3. What evidence supports your conclusion?
4. Are there any issues or concerns?
5. What should happen next? (proceed/retry/abort/human_review)

Be thorough but efficient. False positives are worse than false negatives.`;
        const userPrompt = `Action performed: ${action}
Expected outcome: ${expected}

DOM State:
${domState ?? 'Not provided'}

Please analyze and provide verification results as JSON.`;
        let text;
        if (screenshot) {
            text = await (0, gemini_llm_1.callGeminiVision)(systemPrompt, screenshot, userPrompt, {
                model: this.config.model,
                maxTokens: 1024,
            });
        }
        else {
            text = await (0, gemini_llm_1.callGemini)(systemPrompt, userPrompt, {
                model: this.config.model,
                maxTokens: 1024,
            });
        }
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text;
        try {
            return JSON.parse(jsonStr);
        }
        catch {
            // Default response if parsing fails
            return {
                verified: false,
                confidence: 0.5,
                evidence: ['Could not parse verification response'],
                issues: ['Verification parsing failed'],
                recommendation: 'retry',
            };
        }
    }
    async detectError(screenshot, domState) {
        const systemPrompt = `You are THE SENTINEL. Analyze the page for errors.

Look for:
- Error messages (red text, warning boxes)
- Form validation errors
- Server errors (500, 404, etc.)
- Authentication errors
- Rate limiting messages
- Captcha requirements
- Popups blocking action

Output JSON with: hasError, errorType, errorMessage, suggestions[]`;
        const errorPrompt = `DOM State:\n${domState ?? 'Not provided'}\n\nAnalyze for errors.`;
        let text;
        if (screenshot) {
            text = await (0, gemini_llm_1.callGeminiVision)(systemPrompt, screenshot, errorPrompt, {
                model: this.config.model,
                maxTokens: 1024,
            });
        }
        else {
            text = await (0, gemini_llm_1.callGemini)(systemPrompt, errorPrompt, {
                model: this.config.model,
                maxTokens: 1024,
            });
        }
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text;
        try {
            return JSON.parse(jsonStr);
        }
        catch {
            return { hasError: false, suggestions: [] };
        }
    }
}
exports.TheSentinel = TheSentinel;
__decorate([
    (0, event_bus_1.traced)('SENTINEL.verify'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], TheSentinel.prototype, "verify", null);
__decorate([
    (0, event_bus_1.traced)('SENTINEL.detectError'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheSentinel.prototype, "detectError", null);
// =============================================================================
// AGENT 4: THE MEMORY KEEPER (Persistence Agent)
// =============================================================================
class TheMemoryKeeper extends BaseAgent {
    workingMemory;
    episodicMemory;
    semanticMemory;
    proceduralMemory;
    forgettingTau;
    constructor() {
        super('THE_MEMORY_KEEPER', { model: 'haiku' });
        this.workingMemory = [];
        this.episodicMemory = new Map();
        this.semanticMemory = new Map();
        this.proceduralMemory = new Map();
        this.forgettingTau = 86400000; // 1 day in ms
    }
    async store(tier, content, metadata = {}) {
        const memory = {
            id: (0, uuid_1.v4)(),
            tier,
            content,
            metadata,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 0,
            importance: 1.0,
        };
        switch (tier) {
            case 'L0_working':
                this.workingMemory.push(memory);
                // Miller's 7±2 - keep only last 9 items
                if (this.workingMemory.length > 9) {
                    this.workingMemory.shift();
                }
                break;
            case 'L1_episodic':
                const key = metadata.url ?? metadata.platform ?? 'general';
                if (!this.episodicMemory.has(key)) {
                    this.episodicMemory.set(key, []);
                }
                this.episodicMemory.get(key).push(memory);
                break;
            case 'L2_semantic':
                // Deduplicate based on content hash
                const hash = this.hashContent(content);
                this.semanticMemory.set(hash, memory);
                break;
            case 'L3_procedural':
                // Store successful workflows/patterns
                const patternId = metadata.action ?? (0, uuid_1.v4)();
                this.proceduralMemory.set(patternId, memory);
                break;
        }
        this.publishEvent('SUCCESS_RECORDED', { tier, memoryId: memory.id });
        return memory;
    }
    async retrieve(query) {
        const startTime = Date.now();
        const results = [];
        // Search specified tier or all tiers
        const tiers = query.tier ? [query.tier] : ['L0_working', 'L1_episodic', 'L2_semantic', 'L3_procedural'];
        for (const tier of tiers) {
            const tierMemories = this.getMemoriesForTier(tier);
            for (const memory of tierMemories) {
                // Apply filters
                if (query.platform && memory.metadata.platform !== query.platform)
                    continue;
                if (query.minImportance && memory.importance < query.minImportance)
                    continue;
                if (query.timeRangeMs && Date.now() - memory.createdAt > query.timeRangeMs)
                    continue;
                // Calculate importance with forgetting curve
                memory.importance = this.calculateImportance(memory);
                results.push(memory);
            }
        }
        // Sort by importance and limit
        results.sort((a, b) => b.importance - a.importance);
        const limited = results.slice(0, query.limit ?? 10);
        // Update access times
        for (const memory of limited) {
            memory.lastAccessedAt = Date.now();
            memory.accessCount++;
        }
        return {
            memories: limited,
            totalCount: results.length,
            queryTimeMs: Date.now() - startTime,
        };
    }
    getMemoriesForTier(tier) {
        switch (tier) {
            case 'L0_working':
                return [...this.workingMemory];
            case 'L1_episodic':
                return Array.from(this.episodicMemory.values()).flat();
            case 'L2_semantic':
                return Array.from(this.semanticMemory.values());
            case 'L3_procedural':
                return Array.from(this.proceduralMemory.values());
            default:
                return [];
        }
    }
    calculateImportance(memory) {
        const age = Date.now() - memory.createdAt;
        const decay = Math.exp(-age / this.forgettingTau);
        const accessBonus = 1 + Math.log(memory.accessCount + 1);
        // Procedural memories decay slower
        const tierMultiplier = memory.tier === 'L3_procedural' ? 1.5 : 1.0;
        return memory.importance * decay * accessBonus * tierMultiplier;
    }
    hashContent(content) {
        return JSON.stringify(content).split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0).toString(36);
    }
    /**
     * Consolidate episodic memories into semantic memories
     * (Run periodically)
     */
    async consolidate() {
        let consolidated = 0;
        for (const [key, episodes] of this.episodicMemory) {
            // Find patterns in episodes
            const patterns = this.findPatterns(episodes);
            for (const pattern of patterns) {
                await this.store('L2_semantic', pattern, { source: key });
                consolidated++;
            }
            // Remove old episodic memories
            const cutoff = Date.now() - this.forgettingTau * 7; // 7 days
            const filtered = episodes.filter((e) => e.createdAt > cutoff);
            this.episodicMemory.set(key, filtered);
        }
        return consolidated;
    }
    findPatterns(episodes) {
        // Simple pattern extraction (could be enhanced with ML)
        const patterns = [];
        // Group by action
        const byAction = new Map();
        for (const ep of episodes) {
            const action = ep.metadata.action ?? 'unknown';
            if (!byAction.has(action))
                byAction.set(action, []);
            byAction.get(action).push(ep);
        }
        // Extract successful patterns
        for (const [action, memories] of byAction) {
            const successful = memories.filter((m) => m.metadata.success);
            if (successful.length >= 3) {
                patterns.push({
                    action,
                    frequency: successful.length,
                    averageSuccess: successful.length / memories.length,
                    example: successful[0].content,
                });
            }
        }
        return patterns;
    }
    /**
     * Clear working memory
     */
    clearWorking() {
        this.workingMemory = [];
    }
    /**
     * Get memory statistics
     */
    getStats() {
        return {
            working: this.workingMemory.length,
            episodic: Array.from(this.episodicMemory.values()).flat().length,
            semantic: this.semanticMemory.size,
            procedural: this.proceduralMemory.size,
        };
    }
}
exports.TheMemoryKeeper = TheMemoryKeeper;
__decorate([
    (0, event_bus_1.traced)('MEMORY.store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TheMemoryKeeper.prototype, "store", null);
__decorate([
    (0, event_bus_1.traced)('MEMORY.retrieve'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheMemoryKeeper.prototype, "retrieve", null);
// =============================================================================
// EXPORTS
// =============================================================================
exports.cortex = new TheCortex();
exports.temporalSequencer = new TheTemporalSequencer();
exports.sentinel = new TheSentinel();
exports.memoryKeeper = new TheMemoryKeeper();
//# sourceMappingURL=tier0-orchestration.js.map
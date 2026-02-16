/**
 * CHROMADON 27-Agent Autonomous Browser System
 * =============================================
 *
 * A complete, production-ready multi-agent system for autonomous
 * browser automation. Organized into 4 tiers:
 *
 * TIER 0: Orchestration (4 agents)
 *   - THE_CORTEX: Master planner, decomposes tasks into workflow DAGs
 *   - THE_TEMPORAL_SEQUENCER: Executes workflows with human-like timing
 *   - THE_SENTINEL: Vision-based verification and success detection
 *   - THE_MEMORY_KEEPER: 4-tier memory system with encrypted credentials
 *
 * TIER 1: Perception (4 agents)
 *   - THE_VISION_ANALYZER: Claude Vision for screenshot analysis
 *   - THE_DOM_INSPECTOR: DOM parsing and selector generation
 *   - THE_CONTEXT_BUILDER: Synthesizes vision + DOM into unified context
 *   - THE_INTENT_DECODER: Natural language to structured intent
 *
 * TIER 2: Execution (8 agents)
 *   - THE_NAVIGATOR: URL navigation and history management
 *   - THE_CLICKER: Click operations with multiple fallbacks
 *   - THE_TYPER: Human-like keyboard input
 *   - THE_SCROLLER: Viewport and scroll management
 *   - THE_SELECTOR: Dropdowns, checkboxes, radio buttons
 *   - THE_FORM_MASTER: Complex form orchestration
 *   - THE_CONTENT_GENERATOR: AI-powered content creation
 *   - THE_FILE_HANDLER: Upload/download management
 *
 * TIER 3: Specialists (8 agents)
 *   - THE_AUTH_GUARDIAN: Multi-platform authentication + 2FA
 *   - THE_SOCIAL_MEDIA_PRO: Business page creation & management
 *   - THE_CAPTCHA_BREAKER: Vision-based CAPTCHA solving
 *   - THE_ECOMMERCE_EXPERT: Shopping cart & checkout automation
 *   - THE_DATA_EXTRACTOR: Web scraping & structured data collection
 *   - THE_RESEARCH_AGENT: Multi-source intelligence gathering
 *   - THE_BOOKING_AGENT: Reservations & appointment systems
 *   - THE_PAYMENT_HANDLER: Payment form automation
 *
 * TIER 4: Resilience (3 agents)
 *   - THE_ERROR_HANDLER: Error classification and routing
 *   - THE_RECOVERY_EXPERT: Automated recovery strategies
 *   - THE_LEARNING_ENGINE: Pattern learning and optimization
 *
 * TOTAL: 27 AGENTS - 100% COMPLETE
 *
 * Usage:
 * ```typescript
 * import { createAllAgents, ChromadonAgentSystem } from './agents';
 *
 * const system = new ChromadonAgentSystem(cdpController);
 * const result = await system.execute('Create a Facebook business page for my bakery');
 * ```
 */
export * from '../ralph';
export * from './types';
export { AgentEventBus, getEventBus, getTracer, traced, EventSubscription, RequestOptions, } from './event-bus';
export { BaseAgent, TheCortex, TheTemporalSequencer, TheSentinel, TheMemoryKeeper, } from './tier0-orchestration';
export { TheVisionAnalyzer, TheDOMInspector, TheContextBuilder, TheIntentDecoder, createPerceptionAgents, } from './tier1-perception';
export { TheNavigator, TheClicker, TheTyper, TheScroller, TheSelector, TheFormMaster, TheContentGenerator, TheFileHandler, createExecutionAgents, } from './tier2-execution';
export { TheAuthGuardian, TheSocialMediaPro, TheCaptchaBreaker, createSpecialistAgents, } from './tier3-specialists';
export { TheEcommerceExpert, TheDataExtractor, TheResearchAgent, TheBookingAgent, ThePaymentHandler, createExtendedSpecialists, Product, CartState, ShippingAddress, CheckoutData, ExtractedData, ExtractionRule, ResearchQuery, ResearchResult, BookingRequest, BookingConfirmation, PaymentDetails, } from './tier3-specialists-extended';
export { TheErrorHandler, TheRecoveryExpert, TheLearningEngine, createResilienceAgents, ErrorCategory, ErrorPattern, RecoveryResult, } from './tier4-resilience';
export { YouTubeToolBridge } from './youtube-tool-bridge';
export { SocialMediaToolBridge, type ParsedSocialTask } from './social-tool-bridge';
export interface CDPController {
    navigate(url: string): Promise<{
        success: boolean;
        finalUrl: string;
        loadTime: number;
    }>;
    click(selector: string, options?: {
        timeout?: number;
        force?: boolean;
    }): Promise<{
        success: boolean;
    }>;
    clickCoordinates(x: number, y: number): Promise<{
        success: boolean;
    }>;
    type(selector: string, text: string, options?: {
        delay?: number;
        clear?: boolean;
    }): Promise<{
        success: boolean;
    }>;
    typeKeys(keys: string[]): Promise<{
        success: boolean;
    }>;
    scroll(options: {
        direction: 'up' | 'down' | 'left' | 'right';
        amount: number;
    }): Promise<void>;
    scrollToElement(selector: string): Promise<{
        success: boolean;
    }>;
    scrollToCoordinates(x: number, y: number): Promise<void>;
    select(selector: string, value: string): Promise<{
        success: boolean;
    }>;
    selectMultiple(selector: string, values: string[]): Promise<{
        success: boolean;
    }>;
    uploadFile(selector: string, filePath: string): Promise<{
        success: boolean;
    }>;
    screenshot(): Promise<string>;
    getHTML(): Promise<string>;
    evaluate<T>(script: string): Promise<T>;
    waitForSelector(selector: string, timeout?: number): Promise<boolean>;
    waitForNavigation(timeout?: number): Promise<boolean>;
    goBack(): Promise<void>;
    goForward(): Promise<void>;
    refresh(): Promise<void>;
    send?(method: string, params?: any): Promise<any>;
}
import { TheCortex, TheTemporalSequencer, TheSentinel, TheMemoryKeeper } from './tier0-orchestration';
import { createPerceptionAgents } from './tier1-perception';
import { createExecutionAgents } from './tier2-execution';
import { createSpecialistAgents } from './tier3-specialists';
import { createExtendedSpecialists } from './tier3-specialists-extended';
import { createResilienceAgents } from './tier4-resilience';
import { AgentEventBus } from './event-bus';
import { RalphLoopExecutor, RalphConfig, RalphResult } from '../ralph';
import { YouTubeToolBridge } from './youtube-tool-bridge';
/**
 * Complete registry of all 27 agents
 */
export interface AgentRegistry {
    cortex: TheCortex;
    sequencer: TheTemporalSequencer;
    sentinel: TheSentinel;
    memoryKeeper: TheMemoryKeeper;
    visionAnalyzer: ReturnType<typeof createPerceptionAgents>['visionAnalyzer'];
    domInspector: ReturnType<typeof createPerceptionAgents>['domInspector'];
    contextBuilder: ReturnType<typeof createPerceptionAgents>['contextBuilder'];
    intentDecoder: ReturnType<typeof createPerceptionAgents>['intentDecoder'];
    navigator: ReturnType<typeof createExecutionAgents>['navigator'];
    clicker: ReturnType<typeof createExecutionAgents>['clicker'];
    typer: ReturnType<typeof createExecutionAgents>['typer'];
    scroller: ReturnType<typeof createExecutionAgents>['scroller'];
    selector: ReturnType<typeof createExecutionAgents>['selector'];
    formMaster: ReturnType<typeof createExecutionAgents>['formMaster'];
    contentGenerator: ReturnType<typeof createExecutionAgents>['contentGenerator'];
    fileHandler: ReturnType<typeof createExecutionAgents>['fileHandler'];
    authGuardian: ReturnType<typeof createSpecialistAgents>['authGuardian'];
    socialMediaPro: ReturnType<typeof createSpecialistAgents>['socialMediaPro'];
    captchaBreaker: ReturnType<typeof createSpecialistAgents>['captchaBreaker'];
    ecommerceExpert: ReturnType<typeof createExtendedSpecialists>['ecommerceExpert'];
    dataExtractor: ReturnType<typeof createExtendedSpecialists>['dataExtractor'];
    researchAgent: ReturnType<typeof createExtendedSpecialists>['researchAgent'];
    bookingAgent: ReturnType<typeof createExtendedSpecialists>['bookingAgent'];
    paymentHandler: ReturnType<typeof createExtendedSpecialists>['paymentHandler'];
    errorHandler: ReturnType<typeof createResilienceAgents>['errorHandler'];
    recoveryExpert: ReturnType<typeof createResilienceAgents>['recoveryExpert'];
    learningEngine: ReturnType<typeof createResilienceAgents>['learningEngine'];
}
/**
 * Create all 27 agents with CDP controller injection
 */
export declare function createAllAgents(cdp: CDPController): AgentRegistry;
/**
 * RALPH execution options for ChromadonAgentSystem
 */
export interface ChromadonExecutionOptions {
    /** Enable RALPH persistent loop (default: true) */
    useRalph?: boolean;
    /** Max iterations before giving up (default: 50) */
    maxIterations?: number;
    /** Max cost in USD (default: $10.00) */
    costLimitUsd?: number;
    /** Timeout in ms (default: 30 minutes) */
    timeoutMs?: number;
    /** Custom mission ID */
    missionId?: string;
}
/**
 * Main orchestration class that coordinates all agents
 *
 * RALPH Integration:
 * - All operations are wrapped in RALPH persistent loops by default
 * - Never gives up until success or human intervention required
 * - State persists to .ralph/ directory for crash recovery
 * - Cost tracking and limits enforced ($10.00 default)
 */
export declare class ChromadonAgentSystem {
    private agents;
    private eventBus;
    private cdp;
    private ralphConfig;
    private activeRalph;
    youtube: YouTubeToolBridge | null;
    constructor(cdp: CDPController, ralphConfig?: Partial<RalphConfig>);
    /** Get TheCortex agent for workflow planning */
    getCortex(): TheCortex;
    /** Get TheTemporalSequencer for DAG execution */
    getSequencer(): TheTemporalSequencer;
    /** Get the EventBus for direct agent dispatch */
    getAgentEventBus(): AgentEventBus;
    /** Set the YouTube Tool Bridge (called from server.ts after both systems are init'd) */
    setYouTubeBridge(bridge: YouTubeToolBridge): void;
    private setupEventHandlers;
    /**
     * Route an agent request to the appropriate agent method
     * NOTE: Uses DIRECT CDP calls to bypass @traced decorator issues with async generators
     */
    /**
     * Infer agent from action name when not provided
     */
    private inferAgentFromAction;
    private routeRequest;
    /**
     * Execute a natural language task with RALPH persistent loop
     *
     * RALPH ensures the task is retried until success or human intervention.
     * State persists to .ralph/ directory for crash recovery.
     */
    execute(task: string, options?: ChromadonExecutionOptions): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
        durationMs: number;
        ralph?: RalphResult<unknown>;
    }>;
    /**
     * Execute task once without RALPH loop (internal method)
     */
    private executeOnce;
    /**
     * Get active RALPH executor (for monitoring)
     */
    getActiveRalph(): RalphLoopExecutor | null;
    /**
     * Pause active RALPH execution
     */
    pauseRalph(): Promise<void>;
    /**
     * Resume paused RALPH execution
     */
    resumeRalph(): Promise<void>;
    /**
     * Abort active RALPH execution
     */
    abortRalph(reason: string): Promise<void>;
    /**
     * Respond to RALPH intervention request
     */
    respondToIntervention(response: {
        action: 'continue' | 'retry' | 'abort' | 'modify';
        data?: Record<string, any>;
    }): Promise<void>;
    /**
     * Convenience method: Create a social media business page
     */
    createBusinessPage(platform: 'facebook' | 'instagram' | 'linkedin', businessName: string, category: string, description?: string): Promise<{
        success: boolean;
        pageUrl?: string;
        error?: string;
    }>;
    /**
     * Convenience method: Post to social media
     */
    postToSocial(platform: string, content: string, options?: {
        image?: string;
        schedule?: Date;
    }): Promise<{
        success: boolean;
        postUrl?: string;
        error?: string;
    }>;
    /**
     * Convenience method: Fill a form
     */
    fillForm(url: string, formData: Record<string, string>): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Convenience method: Research a topic
     */
    research(topic: string, sources?: string[]): Promise<{
        success: boolean;
        findings?: string[];
        error?: string;
    }>;
    /**
     * Store credentials securely
     */
    storeCredentials(platform: string, username: string, password: string): Promise<void>;
    /**
     * Get agent statistics
     */
    getStats(): {
        learningStats: any;
        errorStats: any;
        patterns: any;
    };
    /**
     * Get direct access to specific agents
     */
    getAgents(): AgentRegistry;
    /**
     * E-commerce: Add product to cart
     */
    addToCart(productUrl: string, quantity?: number, options?: {
        variant?: Record<string, string>;
    }): Promise<{
        success: boolean;
        cartState?: any;
        error?: string;
    }>;
    /**
     * E-commerce: Complete checkout
     */
    checkout(checkoutData: {
        email: string;
        shipping: {
            firstName: string;
            lastName: string;
            address1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
        };
        paymentMethod: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
    }): Promise<{
        success: boolean;
        orderId?: string;
        error?: string;
    }>;
    /**
     * Data Extraction: Scrape structured data from a page
     */
    extractData(url: string, rules: Array<{
        name: string;
        selector: string;
        attribute?: string;
    }>): Promise<{
        success: boolean;
        data?: Record<string, unknown>[];
        error?: string;
    }>;
    /**
     * Research: Multi-source intelligence gathering
     */
    deepResearch(topic: string, options?: {
        depth?: 'shallow' | 'medium' | 'deep';
        maxSources?: number;
    }): Promise<{
        success: boolean;
        summary?: string;
        sources?: any[];
        error?: string;
    }>;
    /**
     * Booking: Make a reservation
     */
    makeReservation(type: 'hotel' | 'restaurant' | 'appointment' | 'flight' | 'event', details: {
        venue: string;
        date: string;
        time?: string;
        partySize?: number;
        name: string;
        email: string;
        phone?: string;
    }): Promise<{
        success: boolean;
        confirmationId?: string;
        error?: string;
    }>;
    /**
     * Payment: Fill payment form (does NOT store card data)
     */
    fillPaymentForm(cardDetails: {
        number: string;
        expiry: string;
        cvv: string;
        name: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
}
/**
 * Agent Implementation Status:
 *
 * TIER 0 - Orchestration: 4/4 ✅
 *   ✅ THE_CORTEX
 *   ✅ THE_TEMPORAL_SEQUENCER
 *   ✅ THE_SENTINEL
 *   ✅ THE_MEMORY_KEEPER
 *
 * TIER 1 - Perception: 4/4 ✅
 *   ✅ THE_VISION_ANALYZER
 *   ✅ THE_DOM_INSPECTOR
 *   ✅ THE_CONTEXT_BUILDER
 *   ✅ THE_INTENT_DECODER
 *
 * TIER 2 - Execution: 8/8 ✅
 *   ✅ THE_NAVIGATOR
 *   ✅ THE_CLICKER
 *   ✅ THE_TYPER
 *   ✅ THE_SCROLLER
 *   ✅ THE_SELECTOR
 *   ✅ THE_FORM_MASTER
 *   ✅ THE_CONTENT_GENERATOR
 *   ✅ THE_FILE_HANDLER
 *
 * TIER 3 - Specialists: 8/8 ✅
 *   ✅ THE_AUTH_GUARDIAN
 *   ✅ THE_SOCIAL_MEDIA_PRO
 *   ✅ THE_CAPTCHA_BREAKER
 *   ✅ THE_ECOMMERCE_EXPERT
 *   ✅ THE_DATA_EXTRACTOR
 *   ✅ THE_RESEARCH_AGENT
 *   ✅ THE_BOOKING_AGENT
 *   ✅ THE_PAYMENT_HANDLER
 *
 * TIER 4 - Resilience: 3/3 ✅
 *   ✅ THE_ERROR_HANDLER
 *   ✅ THE_RECOVERY_EXPERT
 *   ✅ THE_LEARNING_ENGINE
 *
 * ════════════════════════════════════════════════════════
 *  TOTAL: 27/27 agents implemented (100% COMPLETE) 🎉
 * ════════════════════════════════════════════════════════
 *
 * Lines of Code:
 *   types.ts:                    ~1,000 lines
 *   event-bus.ts:                ~573 lines
 *   tier0-orchestration.ts:     ~895 lines
 *   tier1-perception.ts:        ~750 lines
 *   tier2-execution.ts:         ~950 lines
 *   tier3-specialists.ts:       ~884 lines
 *   tier3-specialists-extended.ts: ~2,450 lines
 *   tier4-resilience.ts:        ~850 lines
 *   agents/index.ts:            ~650 lines
 *   -------------------------------------------
 *   TOTAL:                      ~9,000+ lines
 */
//# sourceMappingURL=index.d.ts.map
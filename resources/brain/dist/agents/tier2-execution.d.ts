/**
 * CHROMADON Tier 2: Execution Layer
 * ==================================
 * THE NAVIGATOR - URL Navigation & History
 * THE CLICKER - Click Actions with Retry
 * THE TYPER - Keyboard Input with Human-like Timing
 * THE SCROLLER - Scroll & Viewport Management
 * THE SELECTOR - Dropdown & Multi-select
 * THE FORM MASTER - Complex Form Orchestration
 * THE CONTENT GENERATOR - AI Content Creation
 * THE FILE HANDLER - Upload/Download Management
 *
 * These agents are the "hands" of the system - they execute
 * physical browser actions with reliability and human-like behavior.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AgentName, AgentConfig, StepResult, ClickOptions, TypeOptions, ScrollOptions, NavigationResult, UploadResult, ContentGenerationRequest, GeneratedContent } from './types';
import { AgentEventBus } from './event-bus';
interface CDPController {
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
}
declare abstract class BaseExecutionAgent {
    readonly name: AgentName;
    protected config: AgentConfig;
    protected anthropic?: Anthropic;
    protected eventBus: AgentEventBus;
    protected cdp: CDPController | null;
    private failures;
    private lastFailure;
    private state;
    constructor(name: AgentName, config?: Partial<AgentConfig>);
    setCDPController(cdp: CDPController): void;
    protected canExecute(): Promise<boolean>;
    protected recordSuccess(): void;
    protected recordFailure(): void;
    protected publishEvent(type: string, payload: unknown, correlationId?: string): void;
    protected retry<T>(fn: () => Promise<T>, retries?: number, delayMs?: number): Promise<T>;
    protected delay(ms: number): Promise<void>;
    protected humanDelay(minMs: number, maxMs: number): Promise<void>;
}
/**
 * THE NAVIGATOR
 * -------------
 * Handles URL navigation, history, and page load verification.
 * Includes smart URL normalization and redirect following.
 */
export declare class TheNavigator extends BaseExecutionAgent {
    private navigationHistory;
    constructor();
    navigate(url: string, options?: {
        waitForLoad?: boolean;
        timeout?: number;
        followRedirects?: boolean;
    }): Promise<NavigationResult>;
    goBack(): Promise<boolean>;
    goForward(): Promise<boolean>;
    refresh(hardRefresh?: boolean): Promise<boolean>;
    waitForUrl(urlPattern: string | RegExp, timeout?: number): Promise<boolean>;
    private normalizeUrl;
    getHistory(): Array<{
        url: string;
        timestamp: number;
        success: boolean;
    }>;
    clearHistory(): void;
}
/**
 * THE CLICKER
 * -----------
 * Handles all click operations with multiple fallback strategies.
 * Includes hover, double-click, right-click, and coordinate-based clicks.
 */
export declare class TheClicker extends BaseExecutionAgent {
    constructor();
    click(target: string | {
        x: number;
        y: number;
    }, options?: ClickOptions): Promise<StepResult>;
    doubleClick(target: string | {
        x: number;
        y: number;
    }, options?: ClickOptions): Promise<StepResult>;
    hover(target: string | {
        x: number;
        y: number;
    }): Promise<boolean>;
    private clickBySelector;
    private clickByCoordinates;
    private clickViaJS;
    private clickViaCoordinatesFromSelector;
}
/**
 * THE TYPER
 * ---------
 * Handles keyboard input with human-like timing and behavior.
 * Supports special keys, modifiers, and paste operations.
 */
export declare class TheTyper extends BaseExecutionAgent {
    constructor();
    type(target: string, text: string, options?: TypeOptions): Promise<StepResult>;
    clear(target: string): Promise<boolean>;
    pressKey(key: string, modifiers?: string[]): Promise<boolean>;
    pressEnter(): Promise<boolean>;
    pressTab(): Promise<boolean>;
    pressEscape(): Promise<boolean>;
}
/**
 * THE SCROLLER
 * ------------
 * Manages viewport scrolling and element visibility.
 * Supports smooth scrolling, infinite scroll, and pagination.
 */
export declare class TheScroller extends BaseExecutionAgent {
    constructor();
    scroll(direction: 'up' | 'down' | 'left' | 'right', options?: ScrollOptions): Promise<boolean>;
    scrollToElement(selector: string): Promise<boolean>;
    scrollToTop(): Promise<boolean>;
    scrollToBottom(): Promise<boolean>;
    infiniteScroll(options?: {
        maxScrolls?: number;
        waitBetween?: number;
        stopCondition?: () => Promise<boolean>;
    }): Promise<{
        scrollCount: number;
        reachedEnd: boolean;
    }>;
}
/**
 * THE SELECTOR
 * ------------
 * Handles dropdown, checkbox, radio button, and multi-select operations.
 */
export declare class TheSelector extends BaseExecutionAgent {
    constructor();
    select(target: string, value: string, options?: {
        byText?: boolean;
        byValue?: boolean;
        byIndex?: boolean;
    }): Promise<StepResult>;
    selectMultiple(target: string, values: string[]): Promise<StepResult>;
    check(target: string): Promise<boolean>;
    uncheck(target: string): Promise<boolean>;
    toggle(target: string): Promise<boolean>;
    selectRadio(name: string, value: string): Promise<boolean>;
}
/**
 * THE FORM MASTER
 * ---------------
 * Orchestrates complex form filling operations.
 * Handles multi-step forms, validation, and conditional fields.
 */
export declare class TheFormMaster extends BaseExecutionAgent {
    private clicker;
    private typer;
    private selector;
    private scroller;
    constructor();
    setCDPController(cdp: CDPController): void;
    fillForm(fields: Array<{
        selector: string;
        value: string;
        type: string;
    }>, options?: {
        submitAfter?: boolean;
        validateBefore?: boolean;
    }): Promise<StepResult>;
    submitForm(buttonSelector?: string): Promise<boolean>;
    waitForValidation(timeout?: number): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
/**
 * THE CONTENT GENERATOR
 * ---------------------
 * Creates AI-generated content for forms, posts, and profiles.
 * Uses Claude to generate contextually appropriate content.
 */
export declare class TheContentGenerator extends BaseExecutionAgent {
    constructor();
    generate(request: ContentGenerationRequest): Promise<GeneratedContent>;
    private callLLM;
    generateBusinessDescription(businessName: string, industry: string, targetAudience?: string): Promise<string>;
    generateSocialPost(platform: string, topic: string, tone?: string): Promise<string>;
    generateProfileBio(name: string, role: string, platform: string): Promise<string>;
    generateComment(platform: string, originalPost: string, tone?: string, brandVoice?: string): Promise<string>;
    generateReply(platform: string, commentText: string, commentAuthor: string, tone?: string, brandVoice?: string): Promise<string>;
    generateMessage(platform: string, messageContext: string, tone?: string): Promise<string>;
}
/**
 * THE FILE HANDLER
 * ----------------
 * Manages file uploads and downloads.
 * Handles image optimization and file validation.
 */
export declare class TheFileHandler extends BaseExecutionAgent {
    constructor();
    upload(selector: string, filePath: string, options?: {
        waitForUpload?: boolean;
        timeout?: number;
    }): Promise<UploadResult>;
    dragAndDropFile(dropZoneSelector: string, filePath: string): Promise<boolean>;
    private waitForUploadComplete;
}
export declare function createExecutionAgents(cdp: CDPController): {
    navigator: TheNavigator;
    clicker: TheClicker;
    typer: TheTyper;
    scroller: TheScroller;
    selector: TheSelector;
    formMaster: TheFormMaster;
    contentGenerator: TheContentGenerator;
    fileHandler: TheFileHandler;
};
export { TheNavigator, TheClicker, TheTyper, TheScroller, TheSelector, TheFormMaster, TheContentGenerator, TheFileHandler, };
//# sourceMappingURL=tier2-execution.d.ts.map
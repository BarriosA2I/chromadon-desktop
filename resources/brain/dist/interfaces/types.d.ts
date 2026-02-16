/**
 * CHROMADON Core Types
 *
 * Neural RAG Brain Integration:
 * - Complexity enum for dual-process routing
 * - Reflection tokens for action verification
 * - CRAG actions for self-healing
 * - Memory tiers for context management
 */
/// <reference types="node" />
/// <reference types="node" />
import { z } from 'zod';
/**
 * Complexity classification for dual-process routing.
 * System 1: Fast, intuitive (<500ms)
 * System 2: Deliberate, analytical (1-5s)
 */
export declare enum Complexity {
    SIMPLE = "simple",// System 1: Haiku-equivalent processing
    MODERATE = "moderate",// Hybrid: Sonnet-equivalent
    COMPLEX = "complex"
}
/**
 * CRAG corrective action types for self-healing.
 */
export declare enum CRAGAction {
    GENERATE = "generate",// Confidence > 0.7: Use current approach
    DECOMPOSE = "decompose",// 0.4 < Confidence <= 0.7: Break down
    WEBSEARCH = "websearch"
}
/**
 * Circuit breaker states for fault isolation.
 */
export declare enum CircuitState {
    CLOSED = "closed",// Normal operation
    OPEN = "open",// Failing, reject requests
    HALF_OPEN = "half_open"
}
/**
 * Memory tiers for hierarchical context management.
 */
export declare enum MemoryTier {
    WORKING = "L0_working",// Current page state, 7±2 items
    EPISODIC = "L1_episodic",// Session history, 24h decay
    SEMANTIC = "L2_semantic",// Domain knowledge, no decay
    PROCEDURAL = "L3_procedural"
}
/**
 * Self-RAG reflection result for action verification.
 * [RET][REL][SUP][USE] tokens.
 */
export interface ReflectionResult {
    /** [RET] Should retrieve more context? (uncertainty > 0.4) */
    shouldRetrieve: boolean;
    /** [REL] Is the action relevant to the mission? (0-1) */
    isRelevant: number;
    /** [SUP] Is the action supported by page state? (0-1) */
    isSupported: number;
    /** [USE] Is this useful progress? (1-5) */
    isUseful: number;
}
export interface Position {
    x: number;
    y: number;
}
export interface BoundingBox extends Position {
    width: number;
    height: number;
}
export interface Viewport {
    width: number;
    height: number;
    deviceScaleFactor: number;
}
export interface ElementState {
    visible: boolean;
    enabled: boolean;
    clickable: boolean;
    focused: boolean;
    checked?: boolean;
    selected?: boolean;
    readonly?: boolean;
    reason?: string;
}
export interface ElementInfo {
    uid: string;
    tagName: string;
    attributes: Record<string, string>;
    textContent: string;
    boundingBox: BoundingBox | null;
    state: ElementState;
}
export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'aria' | 'testid' | 'visual';
export interface Selector {
    value: string;
    strategy: SelectorStrategy;
    confidence: number;
}
export interface SelectorHealResult {
    success: boolean;
    original: Selector;
    healed: Selector | null;
    candidates: Selector[];
    cragAction: CRAGAction;
}
export type ActionType = 'navigate' | 'click' | 'fill' | 'select' | 'hover' | 'scroll' | 'screenshot' | 'wait' | 'conditional';
export interface BaseAction {
    id: string;
    type: ActionType;
    timeout?: number;
    retries?: number;
}
export interface NavigateAction extends BaseAction {
    type: 'navigate';
    url: string;
}
export interface ClickAction extends BaseAction {
    type: 'click';
    selector: string;
    selectorHints?: string[];
    doubleClick?: boolean;
}
export interface FillAction extends BaseAction {
    type: 'fill';
    selector: string;
    value: string;
    clearFirst?: boolean;
}
export interface SelectAction extends BaseAction {
    type: 'select';
    selector: string;
    value: string | string[];
}
export interface HoverAction extends BaseAction {
    type: 'hover';
    selector: string;
}
export interface ScrollAction extends BaseAction {
    type: 'scroll';
    target?: string;
    position?: Position;
}
export interface ScreenshotAction extends BaseAction {
    type: 'screenshot';
    fullPage?: boolean;
    selector?: string;
}
export interface WaitAction extends BaseAction {
    type: 'wait';
    condition: 'element' | 'navigation' | 'timeout' | 'text';
    selector?: string;
    text?: string;
    duration?: number;
}
export interface ConditionalAction extends BaseAction {
    type: 'conditional';
    condition: {
        type: 'element_exists' | 'text_visible' | 'url_matches';
        selector?: string;
        text?: string;
        pattern?: string;
    };
    thenAction: Action;
    elseAction?: Action;
}
export type Action = NavigateAction | ClickAction | FillAction | SelectAction | HoverAction | ScrollAction | ScreenshotAction | WaitAction | ConditionalAction;
export interface Mission {
    id: string;
    description: string;
    actions: Action[];
    complexity: Complexity;
    timeout?: number;
    checkpoints?: boolean;
}
export interface MissionStep {
    index: number;
    action: Action;
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
    result?: ActionResult;
    reflection?: ReflectionResult;
    checkpoint?: Checkpoint;
}
export interface Checkpoint {
    stepIndex: number;
    timestamp: Date;
    url: string;
    screenshot?: Buffer;
    domSnapshot?: string;
    cookies?: Record<string, string>;
}
export interface ActionResult {
    success: boolean;
    action: Action;
    duration: number;
    error?: Error;
    data?: unknown;
    reflection: ReflectionResult;
}
export interface MissionResult {
    success: boolean;
    mission: Mission;
    steps: MissionStep[];
    totalDuration: number;
    checkpoints: Checkpoint[];
    healing?: {
        attempts: number;
        successful: number;
        strategies: SelectorStrategy[];
    };
    finalUrl: string;
    finalScreenshot?: Buffer;
}
export interface VisualAssertion {
    description: string;
    passed: boolean;
    confidence: number;
    evidence?: string;
    boundingBox?: BoundingBox;
}
export interface VisualDiff {
    changed: boolean;
    changePercentage: number;
    changedRegions: BoundingBox[];
    before: Buffer;
    after: Buffer;
    diff?: Buffer;
}
export declare const MissionSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    actions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["navigate", "click", "fill", "select", "hover", "scroll", "screenshot", "wait", "conditional"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "navigate" | "click" | "fill" | "select" | "hover" | "scroll" | "screenshot" | "wait" | "conditional";
    }, {
        id: string;
        type: "navigate" | "click" | "fill" | "select" | "hover" | "scroll" | "screenshot" | "wait" | "conditional";
    }>, "many">;
    complexity: z.ZodNativeEnum<typeof Complexity>;
    timeout: z.ZodOptional<z.ZodNumber>;
    checkpoints: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    actions: {
        id: string;
        type: "navigate" | "click" | "fill" | "select" | "hover" | "scroll" | "screenshot" | "wait" | "conditional";
    }[];
    complexity: Complexity;
    timeout?: number | undefined;
    checkpoints?: boolean | undefined;
}, {
    id: string;
    description: string;
    actions: {
        id: string;
        type: "navigate" | "click" | "fill" | "select" | "hover" | "scroll" | "screenshot" | "wait" | "conditional";
    }[];
    complexity: Complexity;
    timeout?: number | undefined;
    checkpoints?: boolean | undefined;
}>;
export declare const SelectorSchema: z.ZodObject<{
    value: z.ZodString;
    strategy: z.ZodEnum<["css", "xpath", "text", "aria", "testid", "visual"]>;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: string;
    strategy: "text" | "css" | "xpath" | "aria" | "testid" | "visual";
    confidence: number;
}, {
    value: string;
    strategy: "text" | "css" | "xpath" | "aria" | "testid" | "visual";
    confidence: number;
}>;
export type MissionInput = z.infer<typeof MissionSchema>;
//# sourceMappingURL=types.d.ts.map
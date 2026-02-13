/**
 * CHROMADON Interfaces
 *
 * Core abstractions for the Autonomous Browser Agent.
 * All interfaces implement Neural RAG Brain patterns.
 */
export { Complexity, CRAGAction, CircuitState, MemoryTier, type ReflectionResult, type Position, type BoundingBox, type Viewport, type ElementState, type ElementInfo, type SelectorStrategy, type Selector, type SelectorHealResult, type ActionType, type BaseAction, type NavigateAction, type ClickAction, type FillAction, type SelectAction, type HoverAction, type ScrollAction, type ScreenshotAction, type WaitAction, type ConditionalAction, type Action, type Mission, type MissionStep, type Checkpoint, type ActionResult, type MissionResult, type VisualAssertion, type VisualDiff, MissionSchema, SelectorSchema, type MissionInput, } from './types';
export { type IBrowserController, type BrowserControllerFactory, } from './browser-controller';
export { type IDOMSurgeon, type HealingContext, type ElementStateResult, type DOMSurgeonFactory, } from './dom-surgeon';
export { type IVisualVerifier, type VisualCompareOptions, type VerificationResult, type AssertionContext, type VisualVerifierFactory, } from './visual-verifier';
export { type IMissionController, type ExecutionOptions, type MissionProgress, type RecoveryStrategy, type MissionAnalysis, type MissionControllerFactory, } from './mission-controller';
export { type IIntentCompiler, type IntentCompilerConfig, type CompileResult, type CompileSuccess, type CompileRejected, type CompileNeedsClarification, type CompileError, type CompileStatus, type CompileRoute, type RejectionReason, type ClarificationQuestion, type CompiledAction, type IntentClassification, type IdentifiedIntent, type ClassificationFeatures, type ActionPlan, type PlanValidation, type PlanError, type PlanWarning, type CachedCompilation, type CacheStats, type CompileContext, type ActionPattern, type IFastActionMapper, type IDeepActionPlanner, } from './intent-compiler';
//# sourceMappingURL=index.d.ts.map
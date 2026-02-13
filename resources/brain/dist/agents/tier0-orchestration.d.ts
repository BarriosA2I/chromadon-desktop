/**
 * CHROMADON Tier 0: Orchestration Layer
 * ======================================
 * THE CORTEX - Master Planner
 * THE TEMPORAL SEQUENCER - Workflow Executor
 * THE SENTINEL - Verification Agent
 * THE MEMORY KEEPER - Persistence Agent
 */
import Anthropic from '@anthropic-ai/sdk';
import { AgentName, AgentConfig, WorkflowDAG, StepResult, ProgressReport, Memory, MemoryTier, MemoryQuery, MemoryResult, RiskLevel } from './types';
import { AgentEventBus } from './event-bus';
export declare abstract class BaseAgent {
    readonly name: AgentName;
    protected config: AgentConfig;
    protected anthropic: Anthropic;
    protected eventBus: AgentEventBus;
    constructor(name: AgentName, config?: Partial<AgentConfig>);
    protected getModelId(): string;
    protected callLLM(systemPrompt: string, userMessage: string, options?: {
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    protected publishEvent(type: string, payload: unknown, correlationId?: string): void;
}
export declare class TheCortex extends BaseAgent {
    private workflowTemplates;
    constructor();
    private loadWorkflowTemplates;
    planWorkflow(userRequest: string, context?: Record<string, unknown>): Promise<WorkflowDAG>;
    private findMatchingTemplate;
    private customizeTemplate;
    estimateComplexity(request: string): Promise<{
        complexity: number;
        estimatedSteps: number;
        estimatedDurationMs: number;
        riskLevel: RiskLevel;
        requiredCapabilities: string[];
    }>;
}
export declare class TheTemporalSequencer extends BaseAgent {
    private executionContexts;
    private pausedWorkflows;
    constructor();
    execute(workflow: WorkflowDAG, initialContext?: Record<string, unknown>): AsyncGenerator<StepResult, void, unknown>;
    private executeStep;
    private createCheckpoint;
    private humanDelay;
    private waitForResume;
    pause(workflowId: string): void;
    resume(workflowId: string): void;
    rollbackTo(workflowId: string, checkpointId: string): boolean;
    getProgress(workflowId: string): ProgressReport | null;
}
export declare class TheSentinel extends BaseAgent {
    constructor();
    verify(action: string, expected: string, screenshot?: string, domState?: string): Promise<{
        verified: boolean;
        confidence: number;
        evidence: string[];
        issues: string[];
        recommendation: 'proceed' | 'retry' | 'abort' | 'human_review';
    }>;
    detectError(screenshot?: string, domState?: string): Promise<{
        hasError: boolean;
        errorType?: string;
        errorMessage?: string;
        suggestions: string[];
    }>;
}
export declare class TheMemoryKeeper extends BaseAgent {
    private workingMemory;
    private episodicMemory;
    private semanticMemory;
    private proceduralMemory;
    private forgettingTau;
    constructor();
    store(tier: MemoryTier, content: unknown, metadata?: Memory['metadata']): Promise<Memory>;
    retrieve(query: MemoryQuery): Promise<MemoryResult>;
    private getMemoriesForTier;
    private calculateImportance;
    private hashContent;
    /**
     * Consolidate episodic memories into semantic memories
     * (Run periodically)
     */
    consolidate(): Promise<number>;
    private findPatterns;
    /**
     * Clear working memory
     */
    clearWorking(): void;
    /**
     * Get memory statistics
     */
    getStats(): {
        working: number;
        episodic: number;
        semantic: number;
        procedural: number;
    };
}
export declare const cortex: TheCortex;
export declare const temporalSequencer: TheTemporalSequencer;
export declare const sentinel: TheSentinel;
export declare const memoryKeeper: TheMemoryKeeper;
//# sourceMappingURL=tier0-orchestration.d.ts.map
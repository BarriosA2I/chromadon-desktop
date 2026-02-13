/**
 * CollectorWriter - Internal SSEWriter that collects events into arrays.
 * Used by SocialOverlord for batch/non-streaming task processing.
 *
 * @author Barrios A2I
 */
import type { SSEWriter } from './agentic-orchestrator';
export interface CollectedToolResult {
    id: string;
    name: string;
    success: boolean;
    result?: string;
    error?: string;
    durationMs?: number;
}
export interface CollectedEvent {
    event: string;
    data: any;
    timestamp: number;
}
export declare class CollectorWriter implements SSEWriter {
    events: CollectedEvent[];
    fullText: string;
    toolResults: CollectedToolResult[];
    sessionId: string | null;
    private _closed;
    writeEvent(event: string, data: any): void;
    close(): void;
    isClosed(): boolean;
    /** Get a summary of what happened during execution. */
    getSummary(): string;
}
//# sourceMappingURL=social-collector-writer.d.ts.map
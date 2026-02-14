/**
 * CHROMADON Browser Tools - Claude Tool Definitions + Executor
 *
 * 14 browser automation tools defined in Anthropic Tool[] schema format.
 * The ToolExecutor bridges to Desktop BrowserView or CDP/Playwright execution.
 *
 * @author Barrios A2I
 */
import type { Page } from 'playwright';
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export interface ToolExecutionResult {
    success: boolean;
    result: string;
    error?: string;
}
export interface ExecutionContext {
    page: Page | null;
    desktopTabId: number | null;
    useDesktop: boolean;
    desktopUrl: string;
    abortSignal?: AbortSignal;
    sessionRestoreAttempted?: Set<string>;
}
/**
 * Detect which platform a URL belongs to (matches Desktop session partition names).
 * Returns null for unrecognized domains.
 */
export declare function detectPlatformFromUrl(url: string): string | null;
/**
 * Attempt to restore a platform session via the Desktop Control Server's backup/restore endpoint.
 * Returns true if restore succeeded, false otherwise.
 */
export declare function attemptSessionRestore(platform: string, desktopUrl: string): Promise<boolean>;
export type ToolExecutor = (toolName: string, input: Record<string, any>, context: ExecutionContext) => Promise<ToolExecutionResult>;
export declare const BROWSER_TOOLS: ToolDefinition[];
export declare function createToolExecutor(): ToolExecutor;
//# sourceMappingURL=browser-tools.d.ts.map
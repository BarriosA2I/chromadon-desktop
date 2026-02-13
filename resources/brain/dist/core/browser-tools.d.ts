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
}
export type ToolExecutor = (toolName: string, input: Record<string, any>, context: ExecutionContext) => Promise<ToolExecutionResult>;
export declare const BROWSER_TOOLS: ToolDefinition[];
export declare function createToolExecutor(): ToolExecutor;
//# sourceMappingURL=browser-tools.d.ts.map
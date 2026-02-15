/**
 * THE_SCHEDULER — AI Chat Tool Definitions
 *
 * General-purpose scheduling: not just social posts, but ANY browser automation.
 * schedule_post is a backward-compatible alias that converts to schedule_task.
 *
 * @author Barrios A2I
 */
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export declare const SCHEDULER_TOOLS: ToolDefinition[];
/** Tool names for routing in server.ts */
export declare const SCHEDULER_TOOL_NAMES: Set<string>;
//# sourceMappingURL=scheduler-tools.d.ts.map
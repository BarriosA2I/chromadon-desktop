/**
 * ACTIVITY LOG — Tool Definitions
 *
 * 3 tools for the daily activity journal system.
 *
 * @author Barrios A2I
 */
interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export declare const ACTIVITY_TOOLS: ToolDefinition[];
export declare const ACTIVITY_TOOL_NAMES: Set<string>;
export {};
//# sourceMappingURL=activity-tools.d.ts.map
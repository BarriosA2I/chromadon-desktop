/**
 * MISSION TEMPLATES — Tool Definitions
 *
 * 4 tools for the mission template system.
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
export declare const TEMPLATE_TOOLS: ToolDefinition[];
export declare const TEMPLATE_TOOL_NAMES: Set<string>;
export {};
//# sourceMappingURL=template-tools.d.ts.map
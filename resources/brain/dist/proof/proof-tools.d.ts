/**
 * PROOF OF WORK — Tool Definitions
 *
 * 2 tools for generating and retrieving proof packages.
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
export declare const PROOF_TOOLS: ToolDefinition[];
export declare const PROOF_TOOL_NAMES: Set<string>;
export {};
//# sourceMappingURL=proof-tools.d.ts.map
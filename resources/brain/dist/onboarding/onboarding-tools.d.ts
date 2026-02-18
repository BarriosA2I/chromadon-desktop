/**
 * GUIDED ONBOARDING — Tool Definitions
 *
 * 3 tools for the first-time user onboarding experience.
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
export declare const ONBOARDING_TOOLS: ToolDefinition[];
export declare const ONBOARDING_TOOL_NAMES: Set<string>;
export {};
//# sourceMappingURL=onboarding-tools.d.ts.map
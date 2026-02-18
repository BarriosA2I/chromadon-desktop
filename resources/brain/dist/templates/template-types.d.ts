/**
 * MISSION TEMPLATES — Type Definitions
 *
 * Pre-built mission templates that clients can trigger without writing prompts.
 * Templates support variable substitution and optional scheduling.
 *
 * @author Barrios A2I
 */
export interface TemplateVariable {
    name: string;
    label: string;
    type: 'text' | 'url' | 'choice';
    required: boolean;
    choices?: string[];
    default?: string;
}
export interface MissionTemplate {
    id: string;
    name: string;
    category: 'social' | 'ecommerce' | 'content' | 'research' | 'monitoring';
    description: string;
    icon: string;
    prompt: string;
    variables: TemplateVariable[];
    estimatedDurationMinutes: number;
    schedulable: boolean;
    suggestedSchedule?: string;
    tags: string[];
}
//# sourceMappingURL=template-types.d.ts.map
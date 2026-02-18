/**
 * MISSION TEMPLATES — Dynamic Template Loader (Fix #2)
 *
 * Templates loaded from ~/.chromadon/templates/builtin.json (not hardcoded).
 * On first startup, writes BUILTIN_TEMPLATES to file.
 * After that, always reads from file — allows hot-updates without recompiling.
 *
 * @author Barrios A2I
 */
import { MissionTemplate } from './template-types';
export declare class TemplateLoader {
    private readonly filePath;
    constructor(dataDir?: string);
    /**
     * Write default templates to file if it doesn't exist yet.
     * Called once on startup.
     */
    ensureDefaults(): void;
    /**
     * Load all templates from file. Always reads from disk (not hardcoded constant).
     */
    loadTemplates(): MissionTemplate[];
    /**
     * Get a single template by ID.
     */
    getTemplate(id: string): MissionTemplate | null;
    /**
     * List templates filtered by category.
     */
    listTemplates(category?: string): MissionTemplate[];
    /**
     * Substitute {{variables}} in a template's prompt.
     * Validates required variables are provided.
     */
    substituteVariables(template: MissionTemplate, vars: Record<string, string>): {
        prompt: string;
        error?: string;
    };
    /**
     * Suggest templates based on user message (keyword matching).
     * Returns top 3 matches.
     */
    suggestTemplates(userMessage: string): MissionTemplate[];
}
//# sourceMappingURL=template-loader.d.ts.map
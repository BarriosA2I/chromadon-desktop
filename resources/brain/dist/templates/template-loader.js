"use strict";
/**
 * MISSION TEMPLATES — Dynamic Template Loader (Fix #2)
 *
 * Templates loaded from ~/.chromadon/templates/builtin.json (not hardcoded).
 * On first startup, writes BUILTIN_TEMPLATES to file.
 * After that, always reads from file — allows hot-updates without recompiling.
 *
 * @author Barrios A2I
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const builtin_templates_1 = require("./builtin-templates");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('templates');
class TemplateLoader {
    filePath;
    constructor(dataDir) {
        const base = dataDir || process.env.CHROMADON_DATA_DIR || path.join(os.homedir(), '.chromadon');
        const dir = path.join(base, 'templates');
        fs.mkdirSync(dir, { recursive: true });
        this.filePath = path.join(dir, 'builtin.json');
    }
    /**
     * Write default templates to file if it doesn't exist yet.
     * Called once on startup.
     */
    ensureDefaults() {
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify(builtin_templates_1.BUILTIN_TEMPLATES, null, 2), 'utf-8');
            log.info(`[TemplateLoader] Wrote ${builtin_templates_1.BUILTIN_TEMPLATES.length} default templates to ${this.filePath}`);
        }
    }
    /**
     * Load all templates from file. Always reads from disk (not hardcoded constant).
     */
    loadTemplates() {
        try {
            const data = fs.readFileSync(this.filePath, 'utf-8');
            const templates = JSON.parse(data);
            return Array.isArray(templates) ? templates : [];
        }
        catch (err) {
            log.error(`[TemplateLoader] Failed to load templates: ${err.message}`);
            return builtin_templates_1.BUILTIN_TEMPLATES; // Fallback to hardcoded if file is corrupt
        }
    }
    /**
     * Get a single template by ID.
     */
    getTemplate(id) {
        return this.loadTemplates().find(t => t.id === id) || null;
    }
    /**
     * List templates filtered by category.
     */
    listTemplates(category) {
        const templates = this.loadTemplates();
        if (!category || category === 'all')
            return templates;
        return templates.filter(t => t.category === category);
    }
    /**
     * Substitute {{variables}} in a template's prompt.
     * Validates required variables are provided.
     */
    substituteVariables(template, vars) {
        // Check required variables
        for (const v of template.variables) {
            if (v.required && !vars[v.name] && !v.default) {
                return { prompt: '', error: `Required variable "${v.name}" (${v.label}) is missing.` };
            }
        }
        let prompt = template.prompt;
        for (const v of template.variables) {
            const value = vars[v.name] || v.default || '';
            prompt = prompt.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), value);
        }
        return { prompt };
    }
    /**
     * Suggest templates based on user message (keyword matching).
     * Returns top 3 matches.
     */
    suggestTemplates(userMessage) {
        const msg = userMessage.toLowerCase();
        const templates = this.loadTemplates();
        const scored = templates.map(t => {
            let score = 0;
            // Check name match
            if (msg.includes(t.name.toLowerCase()))
                score += 10;
            // Check category match
            if (msg.includes(t.category))
                score += 5;
            // Check tag matches
            for (const tag of t.tags) {
                if (msg.includes(tag))
                    score += 3;
            }
            // Check description keywords
            const descWords = t.description.toLowerCase().split(/\s+/);
            for (const word of descWords) {
                if (word.length > 3 && msg.includes(word))
                    score += 1;
            }
            return { template: t, score };
        });
        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(s => s.template);
    }
}
exports.TemplateLoader = TemplateLoader;
//# sourceMappingURL=template-loader.js.map
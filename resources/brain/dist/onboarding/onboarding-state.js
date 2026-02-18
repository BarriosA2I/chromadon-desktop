"use strict";
/**
 * GUIDED ONBOARDING — State Persistence
 *
 * Manages onboarding progress in ~/.chromadon/onboarding.json
 * Atomic writes via tmp + rename. Auto-creates default state on first use.
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
exports.OnboardingStatePersistence = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const onboarding_types_1 = require("./onboarding-types");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('onboarding');
class OnboardingStatePersistence {
    filePath;
    state;
    constructor(dataDir) {
        const base = dataDir || process.env.CHROMADON_DATA_DIR || path.join(os.homedir(), '.chromadon');
        fs.mkdirSync(base, { recursive: true });
        this.filePath = path.join(base, 'onboarding.json');
        this.state = this.loadFromDisk();
    }
    // ===========================================================================
    // READ
    // ===========================================================================
    load() {
        return { ...this.state };
    }
    isComplete() {
        return this.state.completedAt !== null;
    }
    /**
     * Get concise prompt context for system prompt injection.
     * Returns null when onboarding is complete (zero tokens spent).
     */
    getPromptContext() {
        if (this.isComplete())
            return null;
        const completed = onboarding_types_1.STEP_ORDER.filter(id => this.state.steps[id].completed);
        const remaining = onboarding_types_1.STEP_ORDER.filter(id => !this.state.steps[id].completed);
        const platforms = this.state.steps.platformDiscovery.platforms;
        const isFirstInteraction = completed.length === 0;
        let ctx = `ONBOARDING (${completed.length}/${onboarding_types_1.STEP_ORDER.length} complete):`;
        ctx += `\nRemaining: ${remaining.map(id => onboarding_types_1.STEP_LABELS[id]).join(', ')}`;
        if (platforms.length > 0) {
            ctx += `\nConnected platforms: ${platforms.join(', ')}`;
        }
        if (isFirstInteraction) {
            ctx += '\n\nFIRST INTERACTION — GREET WARMLY:';
            ctx += '\n- Say hi in a friendly, conversational way. Introduce yourself as CHROMADON.';
            ctx += '\n- Ask their business name casually: "What business are you running?" or "Tell me about your business!"';
            ctx += '\n- Do NOT list capabilities yet. Do NOT say "How can I help you today?" or "What can I help you with?"';
            ctx += '\n- NEVER say "I haven\'t found anything yet" or "I don\'t have any context."';
            ctx += '\n- Keep it to 2-3 sentences max. Be warm, not corporate.';
        }
        else {
            ctx += '\n\nCONTINUE ONBOARDING NATURALLY:';
            ctx += '\n- Weave remaining steps into the conversation. Don\'t announce "Step 2 of 5."';
            ctx += '\n- After getting business info, ask about their social media platforms casually.';
            ctx += '\n- After platforms, suggest a first task: "Want me to draft a post for your [platform]?"';
        }
        ctx += '\nCall onboarding_complete_step when a step is done. Call onboarding_add_platform when user connects a platform.';
        return ctx;
    }
    // ===========================================================================
    // WRITE
    // ===========================================================================
    completeStep(stepId, metadata) {
        const step = this.state.steps[stepId];
        if (!step) {
            log.warn(`[Onboarding] Unknown step: ${stepId}`);
            return this.state;
        }
        step.completed = true;
        step.completedAt = new Date().toISOString();
        // Handle metadata for specific steps
        if (stepId === 'firstMission' && metadata?.missionId) {
            (this.state.steps.firstMission).missionId = metadata.missionId;
        }
        // Check if all steps complete
        const allComplete = onboarding_types_1.STEP_ORDER.every(id => this.state.steps[id].completed);
        if (allComplete) {
            this.state.completedAt = new Date().toISOString();
            log.info('[Onboarding] All steps complete! Onboarding finished.');
        }
        this.saveToDisk();
        return { ...this.state };
    }
    addPlatform(platform) {
        const normalized = platform.toLowerCase().trim();
        const platforms = this.state.steps.platformDiscovery.platforms;
        if (!platforms.includes(normalized)) {
            platforms.push(normalized);
            log.info(`[Onboarding] Platform added: ${normalized}`);
            this.saveToDisk();
        }
        return { ...this.state };
    }
    // ===========================================================================
    // PERSISTENCE
    // ===========================================================================
    loadFromDisk() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
                // Validate version
                if (data.version === '1.0' && data.steps) {
                    return data;
                }
            }
        }
        catch (err) {
            log.warn(`[Onboarding] Failed to load state: ${err.message}`);
        }
        return (0, onboarding_types_1.createDefaultState)();
    }
    saveToDisk() {
        try {
            const tmpPath = this.filePath + '.tmp';
            fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8');
            fs.renameSync(tmpPath, this.filePath);
        }
        catch (err) {
            log.error(`[Onboarding] Failed to save state: ${err.message}`);
        }
    }
}
exports.OnboardingStatePersistence = OnboardingStatePersistence;
//# sourceMappingURL=onboarding-state.js.map
"use strict";
/**
 * AI Interview Engine — Conversational Business Onboarding
 *
 * State machine driving a multi-phase AI conversation that deeply
 * learns each client's business. Uses Claude Haiku for fast responses
 * and entity extraction at phase transitions.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewEngine = void 0;
const llm_helper_1 = require("./llm-helper");
const types_1 = require("./types");
const interview_prompts_1 = require("./interview-prompts");
// ============================================================================
// INTERVIEW ENGINE
// ============================================================================
class InterviewEngine {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    // =========================================================================
    // START / RESUME
    // =========================================================================
    async startInterview(clientId) {
        const client = this.storage.getClient(clientId);
        if (!client)
            throw new Error(`Client not found: ${clientId}`);
        const existingState = this.storage.getInterviewState(clientId);
        if (existingState && !existingState.isComplete) {
            return this.resumeInterview(clientId);
        }
        const now = new Date().toISOString();
        const state = {
            clientId,
            currentPhase: 'greeting',
            completedPhases: [],
            messages: [],
            extractedData: {},
            startedAt: now,
            lastActivityAt: now,
            isComplete: false,
            stateVersion: 1,
            transitionLog: [],
        };
        const greeting = await this.generateResponse(state, client.name);
        state.messages.push({
            role: 'assistant',
            content: greeting,
            phase: 'greeting',
            timestamp: new Date().toISOString(),
        });
        this.storage.saveInterviewState(clientId, state);
        console.log(`[InterviewEngine] Started interview for client: ${clientId}`);
        return { state, greeting };
    }
    async resumeInterview(clientId) {
        const state = this.storage.getInterviewState(clientId);
        if (!state)
            throw new Error(`No interview state found for: ${clientId}`);
        // Migrate pre-v2 states that lack version tracking
        if (state.stateVersion === undefined) {
            state.stateVersion = 1;
            state.transitionLog = [];
        }
        const client = this.storage.getClient(clientId);
        if (!client)
            throw new Error(`Client not found: ${clientId}`);
        if (state.isComplete) {
            return { state, greeting: 'Your interview is already complete! Your business profile has been saved.' };
        }
        const resumeMsg = await this.generateResumeMessage(state, client.name);
        state.messages.push({
            role: 'assistant',
            content: resumeMsg,
            phase: state.currentPhase,
            timestamp: new Date().toISOString(),
        });
        this.storage.saveInterviewState(clientId, state);
        console.log(`[InterviewEngine] Resumed interview for client: ${clientId} at phase: ${state.currentPhase}`);
        return { state, greeting: resumeMsg };
    }
    // =========================================================================
    // PROCESS USER RESPONSE
    // =========================================================================
    async processResponse(clientId, userMessage) {
        const state = this.storage.getInterviewState(clientId);
        if (!state)
            throw new Error(`No interview state found for: ${clientId}`);
        if (state.isComplete) {
            return {
                state,
                reply: 'Your interview is already complete! Your business profile has been saved.',
                phaseChanged: false,
            };
        }
        const client = this.storage.getClient(clientId);
        if (!client)
            throw new Error(`Client not found: ${clientId}`);
        // Add user message
        state.messages.push({
            role: 'user',
            content: userMessage,
            phase: state.currentPhase,
            timestamp: new Date().toISOString(),
        });
        // Check if we should transition phases
        const shouldTransition = await this.shouldTransitionPhase(state);
        let phaseChanged = false;
        let newPhase;
        if (shouldTransition) {
            // Extract entities from current phase before transitioning
            await this.extractEntities(state);
            const transition = interview_prompts_1.PHASE_TRANSITIONS[state.currentPhase];
            if (transition.nextPhase) {
                const transitioned = this.validateAndTransition(state, transition.nextPhase, 'natural');
                if (transitioned) {
                    phaseChanged = true;
                    newPhase = transition.nextPhase;
                    if (newPhase === 'complete') {
                        state.isComplete = true;
                        await this.finalizeProfile(state);
                    }
                }
            }
        }
        // Generate AI response
        const reply = await this.generateResponse(state, client.name);
        state.messages.push({
            role: 'assistant',
            content: reply,
            phase: state.currentPhase,
            timestamp: new Date().toISOString(),
        });
        this.storage.saveInterviewState(clientId, state);
        return { state, reply, phaseChanged, newPhase };
    }
    // =========================================================================
    // SKIP / PROGRESS
    // =========================================================================
    async skipToPhase(clientId, targetPhase) {
        const state = this.storage.getInterviewState(clientId);
        if (!state)
            throw new Error(`No interview state found for: ${clientId}`);
        const currentIndex = types_1.INTERVIEW_PHASES.indexOf(state.currentPhase);
        const targetIndex = types_1.INTERVIEW_PHASES.indexOf(targetPhase);
        if (targetIndex <= currentIndex) {
            throw new Error(`Cannot skip backward from ${state.currentPhase} to ${targetPhase}`);
        }
        // Extract what we can from current phase
        await this.extractEntities(state);
        // Mark intermediate skipped phases as completed and log skip transition
        const transitioned = this.validateAndTransition(state, targetPhase, 'skip');
        if (!transitioned) {
            throw new Error(`Phase transition validation failed: ${state.currentPhase} → ${targetPhase}`);
        }
        // Also mark all intermediate phases we skipped over
        for (let i = currentIndex + 1; i < targetIndex; i++) {
            if (!state.completedPhases.includes(types_1.INTERVIEW_PHASES[i])) {
                state.completedPhases.push(types_1.INTERVIEW_PHASES[i]);
            }
        }
        if (targetPhase === 'complete') {
            state.isComplete = true;
            await this.finalizeProfile(state);
        }
        this.storage.saveInterviewState(clientId, state);
        console.log(`[InterviewEngine] Skipped to phase: ${targetPhase} for client: ${clientId}`);
        return state;
    }
    getProgress(clientId) {
        const state = this.storage.getInterviewState(clientId);
        if (!state)
            return null;
        return {
            currentPhase: state.currentPhase,
            completedPhases: state.completedPhases,
            totalPhases: types_1.INTERVIEW_PHASES.length,
            percentComplete: Math.round((state.completedPhases.length / (types_1.INTERVIEW_PHASES.length - 1)) * 100),
            isComplete: state.isComplete,
        };
    }
    // =========================================================================
    // PHASE TRANSITION (validated + logged)
    // =========================================================================
    validateAndTransition(state, targetPhase, type = 'natural') {
        const currentIndex = types_1.INTERVIEW_PHASES.indexOf(state.currentPhase);
        const targetIndex = types_1.INTERVIEW_PHASES.indexOf(targetPhase);
        // Only allow forward transitions (backward requires explicit skipToPhase with backtrack flag)
        if (targetIndex <= currentIndex) {
            console.warn(`[InterviewEngine] Blocked invalid transition: ${state.currentPhase} → ${targetPhase} (backward)`);
            return false;
        }
        const transition = {
            from: state.currentPhase,
            to: targetPhase,
            timestamp: new Date().toISOString(),
            type,
        };
        state.completedPhases.push(state.currentPhase);
        state.currentPhase = targetPhase;
        state.stateVersion = (state.stateVersion || 0) + 1;
        state.transitionLog = [...(state.transitionLog || []), transition];
        console.log(`[InterviewEngine] Phase transition v${state.stateVersion}: ${transition.from} → ${transition.to} (${type})`);
        return true;
    }
    // =========================================================================
    // AI RESPONSE GENERATION
    // =========================================================================
    async generateResponse(state, clientName) {
        const systemPrompt = (0, interview_prompts_1.getPhaseSystemPrompt)(state.currentPhase, clientName, state.extractedData);
        const messages = state.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));
        // If no messages yet (first greeting), add a synthetic user message
        if (messages.length === 0) {
            messages.push({ role: 'user', content: `Hi, I'm ${clientName}. I'd like to get started with CHROMADON.` });
        }
        try {
            return await (0, llm_helper_1.callLLMConversation)(systemPrompt, messages, 500);
        }
        catch (err) {
            console.error('[InterviewEngine] generateResponse failed:', err.message);
            return `I'm having a brief connection issue. Could you repeat that? (Error: ${err.message})`;
        }
    }
    async generateResumeMessage(state, clientName) {
        const systemPrompt = `You are CHROMADON's Client Onboarding AI. The client "${clientName}" started an interview earlier but got disconnected. Welcome them back warmly, briefly remind them where you left off (phase: ${state.currentPhase}), and continue the conversation naturally. Keep it to 2-3 sentences.`;
        const lastMessages = state.messages.slice(-4).map(m => ({
            role: m.role,
            content: m.content,
        }));
        if (lastMessages.length === 0) {
            lastMessages.push({ role: 'user', content: `Hi, I'm back.` });
        }
        // Ensure conversation starts with user message
        if (lastMessages[0].role !== 'user') {
            lastMessages.unshift({ role: 'user', content: `Hi, I'm back.` });
        }
        const result = await (0, llm_helper_1.callLLMConversation)(systemPrompt, lastMessages, 300);
        return result || `Welcome back, ${clientName}! Let's pick up where we left off.`;
    }
    // =========================================================================
    // PHASE TRANSITION DETECTION
    // =========================================================================
    async shouldTransitionPhase(state) {
        const transition = interview_prompts_1.PHASE_TRANSITIONS[state.currentPhase];
        if (!transition.nextPhase)
            return false;
        // Count messages in current phase
        const phaseMessages = state.messages.filter(m => m.phase === state.currentPhase);
        const userMessages = phaseMessages.filter(m => m.role === 'user');
        if (userMessages.length < transition.minMessages)
            return false;
        // Use AI to determine if we have enough info to transition
        const recentConvo = phaseMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
        try {
            const answer = await (0, llm_helper_1.callLLM)(`You are evaluating whether an interview phase is complete. Current phase: "${state.currentPhase}". Answer ONLY "YES" or "NO".`, `Based on this conversation, do we have enough information to move on from the "${state.currentPhase}" phase?\n\n${recentConvo}\n\nHave the key objectives of this phase been met? Answer YES or NO only.`, 50);
            return (answer?.trim().toUpperCase() || 'NO').startsWith('YES');
        }
        catch (err) {
            console.error('[InterviewEngine] shouldTransitionPhase failed:', err.message);
            return false;
        }
    }
    // =========================================================================
    // ENTITY EXTRACTION
    // =========================================================================
    async extractEntities(state) {
        const phaseMessages = state.messages.filter(m => m.phase === state.currentPhase);
        if (phaseMessages.length === 0)
            return;
        const conversationText = phaseMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        const extractionPrompt = (0, interview_prompts_1.getExtractionPrompt)(state.currentPhase, conversationText);
        if (!extractionPrompt)
            return;
        try {
            const rawText = await (0, llm_helper_1.callLLM)('You are a JSON extraction engine. Return ONLY valid JSON. No markdown, no explanation.', extractionPrompt, 2000);
            if (!rawText)
                return;
            // Clean potential markdown wrapping
            let jsonStr = rawText.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
            }
            const extracted = JSON.parse(jsonStr);
            // Merge extracted data into state
            state.extractedData = {
                ...state.extractedData,
                ...extracted,
            };
            console.log(`[InterviewEngine] Extracted entities for phase: ${state.currentPhase}`, Object.keys(extracted));
        }
        catch (error) {
            console.error(`[InterviewEngine] Entity extraction failed for phase ${state.currentPhase}:`, error);
        }
    }
    // =========================================================================
    // PROFILE FINALIZATION
    // =========================================================================
    async finalizeProfile(state) {
        const data = state.extractedData;
        const clientId = state.clientId;
        // Update business profile
        if (data.businessName || data.industry) {
            this.storage.updateProfile(clientId, {
                businessName: data.businessName || '',
                industry: data.industry || '',
                businessType: data.businessType || '',
                yearFounded: data.yearsFounded || 0,
                location: data.location || '',
                website: data.website || '',
                missionStatement: data.missionStatement || '',
                uniqueSellingPoints: data.uniqueSellingPoints || [],
                products: data.products || [],
                services: data.services || [],
                goals: data.goals || [],
                challenges: data.challenges || [],
                budget: data.budget || '',
                timeline: data.timeline || '',
            });
        }
        // Update brand voice
        if (data.brandVoice) {
            this.storage.updateVoice(clientId, {
                tone: data.brandVoice.tone || [],
                personality: data.brandVoice.personality || [],
                avoidWords: data.brandVoice.avoidWords || [],
                examplePhrases: data.brandVoice.examplePhrases || [],
                formalityLevel: data.brandVoice.formalityLevel || 'neutral',
            });
        }
        // Add audience personas
        if (data.targetAudiences && Array.isArray(data.targetAudiences)) {
            for (const audience of data.targetAudiences) {
                this.storage.addPersona(clientId, {
                    name: audience.name || 'Primary Audience',
                    demographics: audience.demographics || '',
                    ageRange: '',
                    gender: '',
                    income: '',
                    education: '',
                    occupation: '',
                    painPoints: audience.painPoints || [],
                    motivations: audience.motivations || [],
                    preferredChannels: audience.channels || [],
                    contentPreferences: [],
                    buyingBehavior: '',
                });
            }
        }
        // Add competitors
        if (data.competitors && Array.isArray(data.competitors)) {
            for (const comp of data.competitors) {
                this.storage.addCompetitor(clientId, {
                    name: comp.name || '',
                    website: comp.website || '',
                    strengths: comp.strengths || [],
                    weaknesses: comp.weaknesses || [],
                    marketPosition: comp.marketPosition || '',
                    socialPresence: [],
                    contentStrategy: '',
                    pricingStrategy: '',
                });
            }
        }
        console.log(`[InterviewEngine] Finalized profile for client: ${clientId}`);
    }
}
exports.InterviewEngine = InterviewEngine;
//# sourceMappingURL=interview-engine.js.map
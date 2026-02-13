"use strict";
/**
 * Client Context Tool Executor — Handles Tool Calls from 27-Agent System
 *
 * Reads active client from ClientStorage and serves data from
 * the knowledge vault and profile stores.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientContextExecutor = void 0;
// ============================================================================
// CONTEXT EXECUTOR
// ============================================================================
class ClientContextExecutor {
    storage;
    vault;
    constructor(storage, vault) {
        this.storage = storage;
        this.vault = vault;
    }
    async execute(toolName, input) {
        const clientId = this.storage.getActiveClientId();
        if (!clientId) {
            return JSON.stringify({ status: 'no_client', message: 'No active client set. Use the details from the user\'s message to complete the task. Onboarding is optional.' });
        }
        switch (toolName) {
            case 'client_get_profile': {
                const profile = this.storage.getProfile(clientId);
                if (!profile)
                    return JSON.stringify({ status: 'no_profile', message: 'No business profile set up yet. Use the details the user provided in their message to write the content. Do not require onboarding.' });
                return JSON.stringify(profile);
            }
            case 'client_get_voice': {
                const voice = this.storage.getVoice(clientId);
                if (!voice)
                    return JSON.stringify({ status: 'no_voice', message: 'No brand voice profile yet. Write in a friendly, professional tone. Match the user\'s tone from the conversation.' });
                return JSON.stringify(voice);
            }
            case 'client_search_knowledge': {
                const query = input.query;
                if (!query)
                    return JSON.stringify({ error: 'Missing required parameter: query' });
                const topK = input.topK || 5;
                const results = this.vault.searchKnowledge(clientId, query, topK);
                return JSON.stringify({
                    query,
                    resultCount: results.length,
                    results: results.map(r => ({
                        content: r.chunk.content,
                        score: r.score,
                        source: r.documentFilename,
                    })),
                });
            }
            case 'client_get_strategy': {
                const strategy = this.storage.getStrategy(clientId);
                if (!strategy)
                    return JSON.stringify({ status: 'no_strategy', message: 'No growth strategy set up yet. Help the user with their immediate request using the details they provided.' });
                return JSON.stringify(strategy);
            }
            default:
                return JSON.stringify({ error: `Unknown client context tool: ${toolName}` });
        }
    }
    canHandle(toolName) {
        return toolName.startsWith('client_');
    }
}
exports.ClientContextExecutor = ClientContextExecutor;
//# sourceMappingURL=context-executor.js.map
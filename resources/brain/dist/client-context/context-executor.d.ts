/**
 * Client Context Tool Executor — Handles Tool Calls from 27-Agent System
 *
 * Reads active client from ClientStorage and serves data from
 * the knowledge vault and profile stores.
 *
 * @author Barrios A2I
 */
import { ClientStorage } from './client-storage';
import { KnowledgeVault } from './knowledge-vault';
export declare class ClientContextExecutor {
    private readonly storage;
    private readonly vault;
    constructor(storage: ClientStorage, vault: KnowledgeVault);
    execute(toolName: string, input: Record<string, unknown>): Promise<string>;
    canHandle(toolName: string): boolean;
}
//# sourceMappingURL=context-executor.d.ts.map
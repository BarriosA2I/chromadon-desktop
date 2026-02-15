/**
 * Trinity Research Executor — Website Scraping + Knowledge Vault Ingestion
 *
 * research_website: Server-side fetch + HTML text extraction (no browser needed)
 * client_add_knowledge: Saves extracted text to the client's knowledge vault
 *
 * @author Barrios A2I
 */
import { ClientStorage } from '../client-context/client-storage';
import { KnowledgeVault } from '../client-context/knowledge-vault';
import { TrinityIntelligence } from './trinity-intelligence';
export declare function createTrinityExecutor(storage: ClientStorage, vault: KnowledgeVault, intelligence?: TrinityIntelligence): (toolName: string, input: Record<string, any>) => Promise<string>;
//# sourceMappingURL=trinity-executor.d.ts.map
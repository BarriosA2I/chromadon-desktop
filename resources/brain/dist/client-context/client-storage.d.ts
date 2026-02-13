/**
 * Client Storage Layer — Per-Client Filesystem Isolation
 *
 * Each client gets their own directory under data/clients/{clientId}/
 * containing JSON profile files and a SQLite chunks.db for document vectors.
 *
 * @author Barrios A2I
 */
import type { BusinessProfile, BrandVoiceProfile, AudiencePersona, CompetitorProfile, GrowthStrategy, InterviewState, KnowledgeDocument, ClientInfo, ClientContext } from './types';
export declare class ClientStorage {
    private readonly baseDir;
    private readonly metaPath;
    constructor(baseDir?: string);
    createClient(name: string): ClientInfo;
    getClient(clientId: string): ClientInfo | null;
    listClients(): ClientInfo[];
    deleteClient(clientId: string): boolean;
    getActiveClientId(): string | null;
    setActiveClient(clientId: string): boolean;
    getProfile(clientId: string): BusinessProfile | null;
    updateProfile(clientId: string, profile: Partial<BusinessProfile>): BusinessProfile;
    getVoice(clientId: string): BrandVoiceProfile | null;
    updateVoice(clientId: string, voice: Partial<BrandVoiceProfile>): BrandVoiceProfile;
    getPersonas(clientId: string): AudiencePersona[];
    addPersona(clientId: string, persona: Omit<AudiencePersona, 'id' | 'clientId' | 'createdAt'>): AudiencePersona;
    updatePersonas(clientId: string, personas: AudiencePersona[]): void;
    getCompetitors(clientId: string): CompetitorProfile[];
    addCompetitor(clientId: string, competitor: Omit<CompetitorProfile, 'id' | 'clientId' | 'createdAt'>): CompetitorProfile;
    updateCompetitors(clientId: string, competitors: CompetitorProfile[]): void;
    getStrategy(clientId: string): GrowthStrategy | null;
    updateStrategy(clientId: string, strategy: GrowthStrategy): void;
    getInterviewState(clientId: string): InterviewState | null;
    saveInterviewState(clientId: string, state: InterviewState): void;
    getDocuments(clientId: string): KnowledgeDocument[];
    addDocument(clientId: string, doc: KnowledgeDocument): void;
    updateDocument(clientId: string, docId: string, updates: Partial<KnowledgeDocument>): void;
    removeDocument(clientId: string, docId: string): boolean;
    getDocumentStoragePath(clientId: string): string;
    getChunksDbPath(clientId: string): string;
    getFullContext(clientId: string): ClientContext | null;
    private getClientDir;
    private readJson;
    private writeJson;
    private readMeta;
    private writeMeta;
    private touchClient;
}
//# sourceMappingURL=client-storage.d.ts.map
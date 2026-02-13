/**
 * Client Business Context Layer — Type Definitions
 *
 * All interfaces for per-client business profiles, AI interviews,
 * document knowledge vault, and growth strategy engine.
 *
 * @author Barrios A2I
 */
export type InterviewPhase = 'greeting' | 'discovery' | 'products' | 'audience' | 'competitors' | 'voice_capture' | 'document_upload' | 'strategy_mapping' | 'complete';
export declare const INTERVIEW_PHASES: InterviewPhase[];
export interface InterviewMessage {
    role: 'assistant' | 'user';
    content: string;
    phase: InterviewPhase;
    timestamp: string;
}
export interface InterviewTransition {
    from: InterviewPhase;
    to: InterviewPhase;
    timestamp: string;
    type: 'natural' | 'skip' | 'resume';
}
export interface InterviewState {
    clientId: string;
    currentPhase: InterviewPhase;
    completedPhases: InterviewPhase[];
    messages: InterviewMessage[];
    extractedData: Partial<ExtractedInterviewData>;
    startedAt: string;
    lastActivityAt: string;
    isComplete: boolean;
    stateVersion: number;
    transitionLog: InterviewTransition[];
}
export interface ExtractedInterviewData {
    businessName: string;
    industry: string;
    businessType: string;
    yearsFounded: number;
    location: string;
    website: string;
    missionStatement: string;
    uniqueSellingPoints: string[];
    products: ProductInfo[];
    services: ServiceInfo[];
    targetAudiences: AudienceInfo[];
    competitors: CompetitorInfo[];
    brandVoice: BrandVoiceInfo;
    goals: string[];
    challenges: string[];
    budget: string;
    timeline: string;
}
export interface ProductInfo {
    name: string;
    description: string;
    priceRange: string;
    targetMarket: string;
    differentiators: string[];
}
export interface ServiceInfo {
    name: string;
    description: string;
    priceRange: string;
    deliveryMethod: string;
    turnaroundTime: string;
}
export interface AudienceInfo {
    name: string;
    demographics: string;
    painPoints: string[];
    motivations: string[];
    channels: string[];
}
export interface CompetitorInfo {
    name: string;
    website: string;
    strengths: string[];
    weaknesses: string[];
    marketPosition: string;
}
export interface BrandVoiceInfo {
    tone: string[];
    personality: string[];
    avoidWords: string[];
    examplePhrases: string[];
    formalityLevel: 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual';
}
export interface BusinessProfile {
    id: string;
    clientId: string;
    businessName: string;
    industry: string;
    businessType: string;
    yearFounded: number;
    location: string;
    website: string;
    missionStatement: string;
    uniqueSellingPoints: string[];
    products: ProductInfo[];
    services: ServiceInfo[];
    goals: string[];
    challenges: string[];
    budget: string;
    timeline: string;
    createdAt: string;
    updatedAt: string;
}
export interface BrandVoiceProfile {
    clientId: string;
    tone: string[];
    personality: string[];
    avoidWords: string[];
    examplePhrases: string[];
    formalityLevel: 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual';
    writingStyle: string;
    hashtagStrategy: string;
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
    callToActionStyle: string;
    updatedAt: string;
}
export interface AudiencePersona {
    id: string;
    clientId: string;
    name: string;
    demographics: string;
    ageRange: string;
    gender: string;
    income: string;
    education: string;
    occupation: string;
    painPoints: string[];
    motivations: string[];
    preferredChannels: string[];
    contentPreferences: string[];
    buyingBehavior: string;
    createdAt: string;
}
export interface CompetitorProfile {
    id: string;
    clientId: string;
    name: string;
    website: string;
    strengths: string[];
    weaknesses: string[];
    marketPosition: string;
    socialPresence: SocialPresence[];
    contentStrategy: string;
    pricingStrategy: string;
    createdAt: string;
}
export interface SocialPresence {
    platform: string;
    handle: string;
    followers: number;
    postingFrequency: string;
    engagementRate: number;
}
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';
export type SupportedMimeType = 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/csv' | 'text/plain' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
export interface KnowledgeDocument {
    id: string;
    clientId: string;
    filename: string;
    originalFilename: string;
    storedPath: string;
    mimeType: string;
    fileSize: number;
    textContent: string;
    chunkCount: number;
    status: DocumentStatus;
    errorMessage?: string;
    uploadedAt: string;
    processedAt?: string;
}
export interface DocumentChunk {
    id: string;
    documentId: string;
    clientId: string;
    content: string;
    chunkIndex: number;
    tokenCount: number;
    keywordVector: string;
    metadata: ChunkMetadata;
    createdAt: string;
}
export interface ChunkMetadata {
    filename: string;
    pageNumber?: number;
    sectionTitle?: string;
    startChar: number;
    endChar: number;
}
export interface SearchResult {
    chunk: DocumentChunk;
    score: number;
    documentFilename: string;
}
export interface DocumentUploadResult {
    document: KnowledgeDocument;
    chunksCreated: number;
    processingTimeMs: number;
}
export interface GrowthStrategy {
    clientId: string;
    overview: string;
    targetMarketAnalysis: string;
    competitiveAdvantages: string[];
    channels: ChannelStrategy[];
    contentCalendar: ContentCalendarEntry[];
    successMetrics: SuccessMetric[];
    budgetAllocation: BudgetItem[];
    shortTermGoals: StrategicGoal[];
    longTermGoals: StrategicGoal[];
    risks: RiskAssessment[];
    generatedAt: string;
    updatedAt: string;
    version: number;
}
export interface ChannelStrategy {
    platform: string;
    priority: 'high' | 'medium' | 'low';
    objective: string;
    tactics: string[];
    postingFrequency: string;
    contentTypes: string[];
    targetAudience: string;
    kpis: string[];
    estimatedReach: string;
}
export interface ContentCalendarEntry {
    id: string;
    week: number;
    dayOfWeek: number;
    platform: string;
    contentType: string;
    topic: string;
    caption: string;
    hashtags: string[];
    callToAction: string;
    status: 'planned' | 'drafted' | 'posted' | 'skipped';
    scheduledDate?: string;
}
export interface SuccessMetric {
    name: string;
    category: 'awareness' | 'engagement' | 'conversion' | 'retention' | 'revenue';
    currentValue: number;
    targetValue: number;
    unit: string;
    timeframe: string;
    trackingMethod: string;
}
export interface BudgetItem {
    category: string;
    amount: number;
    percentage: number;
    description: string;
}
export interface StrategicGoal {
    goal: string;
    timeline: string;
    milestones: string[];
    resources: string[];
    successCriteria: string;
}
export interface RiskAssessment {
    risk: string;
    likelihood: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
}
export interface ClientInfo {
    id: string;
    name: string;
    createdAt: string;
    lastActiveAt: string;
    interviewComplete: boolean;
    documentCount: number;
    hasStrategy: boolean;
}
export interface ClientContext {
    clientId: string;
    profile: BusinessProfile | null;
    voice: BrandVoiceProfile | null;
    personas: AudiencePersona[];
    competitors: CompetitorProfile[];
    strategy: GrowthStrategy | null;
    interviewState: InterviewState | null;
    documents: KnowledgeDocument[];
}
export interface InterviewStartRequest {
    clientName: string;
}
export interface InterviewChatRequest {
    clientId: string;
    message: string;
}
export interface InterviewSkipRequest {
    clientId: string;
    phase: InterviewPhase;
}
export interface DocumentUploadRequest {
    clientId: string;
}
export interface KnowledgeSearchRequest {
    clientId: string;
    query: string;
    topK?: number;
}
export interface StrategyGenerateRequest {
    clientId: string;
}
export interface StrategyUpdateRequest {
    clientId: string;
    feedback: string;
}
export interface StrategyCalendarRequest {
    clientId: string;
    weeks: number;
}
export interface SetActiveClientRequest {
    clientId: string;
}
export interface ClientToolInput {
    tool: 'client_get_profile' | 'client_search_knowledge' | 'client_get_strategy' | 'client_get_voice';
    clientId?: string;
    query?: string;
    topK?: number;
}
export interface ClientToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map
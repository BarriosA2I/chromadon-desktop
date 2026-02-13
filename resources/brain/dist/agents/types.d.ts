/**
 * CHROMADON Agent Types
 * =====================
 * Type definitions for the 27-agent autonomous browser system
 */
export type AgentName = 'THE_CORTEX' | 'THE_TEMPORAL_SEQUENCER' | 'THE_SENTINEL' | 'THE_MEMORY_KEEPER' | 'THE_VISION_ANALYZER' | 'THE_DOM_INSPECTOR' | 'THE_CONTEXT_BUILDER' | 'THE_INTENT_DECODER' | 'THE_NAVIGATOR' | 'THE_FORM_MASTER' | 'THE_CONTENT_GENERATOR' | 'THE_FILE_HANDLER' | 'THE_CLICKER' | 'THE_TYPER' | 'THE_SCROLLER' | 'THE_SELECTOR' | 'THE_AUTH_GUARDIAN' | 'THE_SOCIAL_MEDIA_PRO' | 'THE_ECOMMERCE_EXPERT' | 'THE_CAPTCHA_BREAKER' | 'THE_DATA_EXTRACTOR' | 'THE_RESEARCH_AGENT' | 'THE_BOOKING_AGENT' | 'THE_PAYMENT_HANDLER' | 'THE_ERROR_HANDLER' | 'THE_RECOVERY_EXPERT' | 'THE_LEARNING_ENGINE';
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export interface AgentConfig {
    name: AgentName;
    model: ModelTier;
    maxRetries: number;
    timeoutMs: number;
    circuitBreaker: CircuitBreakerConfig;
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeMs: number;
    halfOpenRequests: number;
}
export interface WorkflowNode {
    id: string;
    agent: AgentName;
    action: string;
    params: Record<string, unknown>;
    dependsOn: string[];
    checkpoint?: boolean;
    optional?: boolean;
    timeout?: number;
    retryStrategy?: RetryStrategy;
}
export interface WorkflowDAG {
    id: string;
    name: string;
    description: string;
    nodes: WorkflowNode[];
    metadata: {
        estimatedDurationMs: number;
        requiredAgents: AgentName[];
        riskLevel: RiskLevel;
        checkpointCount: number;
    };
}
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface RetryStrategy {
    maxAttempts: number;
    backoffType: 'linear' | 'exponential' | 'fibonacci';
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
}
export interface StepResult {
    nodeId: string;
    agent: AgentName;
    action: string;
    success: boolean;
    data?: unknown;
    error?: AgentError;
    durationMs: number;
    timestamp: number;
    retryCount: number;
}
export interface ExecutionContext {
    workflowId: string;
    currentStep: string;
    completedSteps: string[];
    pendingSteps: string[];
    checkpoints: Checkpoint[];
    variables: Map<string, unknown>;
    startTime: number;
    lastActivityTime: number;
}
export interface Checkpoint {
    id: string;
    stepId: string;
    timestamp: number;
    state: ExecutionContext;
    screenshot?: string;
    domSnapshot?: string;
}
export interface ProgressReport {
    workflowId: string;
    totalSteps: number;
    completedSteps: number;
    currentStep: string;
    percentComplete: number;
    estimatedRemainingMs: number;
    status: ExecutionStatus;
}
export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'recovering' | 'awaiting_human';
export interface PageAnalysis {
    url: string;
    title: string;
    pageType: PageType;
    primaryAction: string;
    interactiveElements: ElementInfo[];
    forms: FormSchema[];
    blockers: Blocker[];
    navigationPaths: NavigationPath[];
    confidence: number;
}
export type PageType = 'login' | 'registration' | 'form' | 'listing' | 'detail' | 'profile' | 'settings' | 'checkout' | 'confirmation' | 'error' | 'captcha' | 'two_factor' | 'unknown';
export interface ElementInfo {
    selector: string;
    fallbackSelectors: string[];
    tagName: string;
    type?: string;
    text?: string;
    placeholder?: string;
    ariaLabel?: string;
    boundingBox: BoundingBox;
    isVisible: boolean;
    isInteractable: boolean;
    attributes: Record<string, string>;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface FormSchema {
    selector: string;
    action?: string;
    method?: string;
    fields: FormField[];
    submitButton: ElementInfo;
    validationRules: ValidationRule[];
}
export interface FormField {
    name: string;
    selector: string;
    type: FieldType;
    label?: string;
    placeholder?: string;
    required: boolean;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    options?: SelectOption[];
    currentValue?: string;
}
export type FieldType = 'text' | 'email' | 'password' | 'phone' | 'number' | 'date' | 'datetime' | 'time' | 'url' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'hidden' | 'rich_text' | 'captcha';
export interface SelectOption {
    value: string;
    label: string;
    selected?: boolean;
}
export interface ValidationRule {
    field: string;
    type: 'required' | 'pattern' | 'minLength' | 'maxLength' | 'custom';
    value?: string | number;
    message?: string;
}
export interface Blocker {
    type: BlockerType;
    selector?: string;
    description: string;
    dismissStrategy?: string;
}
export type BlockerType = 'modal' | 'popup' | 'cookie_banner' | 'captcha' | 'login_required' | 'paywall' | 'age_verification' | 'location_permission' | 'notification_permission';
export interface NavigationPath {
    label: string;
    url?: string;
    selector?: string;
    type: 'link' | 'button' | 'menu_item';
}
export interface ParsedIntent {
    action: IntentAction;
    platform?: Platform;
    entity?: string;
    parameters: Record<string, unknown>;
    missingRequired: string[];
    assumptions: string[];
    confidence: number;
}
export type IntentAction = 'navigate' | 'login' | 'logout' | 'create_account' | 'create_page' | 'create_profile' | 'create_post' | 'fill_form' | 'submit_form' | 'search' | 'extract_data' | 'download' | 'upload' | 'purchase' | 'book' | 'research' | 'monitor' | 'custom';
export type Platform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'google' | 'google_business' | 'amazon' | 'ebay' | 'shopify' | 'wordpress' | 'generic';
export interface Credentials {
    platform: Platform;
    email?: string;
    username?: string;
    password: string;
    totpSecret?: string;
    backupCodes?: string[];
    recoveryEmail?: string;
    recoveryPhone?: string;
}
export interface SessionState {
    platform: Platform;
    isLoggedIn: boolean;
    user?: UserInfo;
    expiresAt?: number;
    cookies: Cookie[];
    lastVerified: number;
}
export interface UserInfo {
    id?: string;
    email?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
}
export interface Cookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
}
export type TwoFactorType = 'totp' | 'sms' | 'email' | 'push' | 'backup_code' | 'security_key';
export interface AuthFlow {
    platform: Platform;
    steps: AuthStep[];
    currentStep: number;
    twoFactorRequired?: TwoFactorType;
}
export interface AuthStep {
    type: 'navigate' | 'fill' | 'click' | 'wait' | 'verify' | '2fa';
    selector?: string;
    value?: string;
    waitForSelector?: string;
    timeout?: number;
}
export interface BusinessData {
    name: string;
    industry?: string;
    category?: string;
    description?: string;
    services?: string[];
    location?: Location;
    phone?: string;
    email?: string;
    website?: string;
    hours?: BusinessHours;
    socialLinks?: Record<string, string>;
}
export interface Location {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
}
export interface BusinessHours {
    monday?: DayHours;
    tuesday?: DayHours;
    wednesday?: DayHours;
    thursday?: DayHours;
    friday?: DayHours;
    saturday?: DayHours;
    sunday?: DayHours;
}
export interface DayHours {
    open: string;
    close: string;
    closed?: boolean;
}
export interface ContentRequest {
    type: ContentType;
    platform?: Platform;
    context: BusinessData | Record<string, unknown>;
    tone: ContentTone;
    length: 'short' | 'medium' | 'long';
    includeHashtags?: boolean;
    includeEmoji?: boolean;
    includeCallToAction?: boolean;
}
export type ContentType = 'business_description' | 'profile_bio' | 'social_post' | 'product_description' | 'review_response' | 'email' | 'tagline';
export type ContentTone = 'professional' | 'friendly' | 'casual' | 'luxury' | 'playful' | 'authoritative' | 'empathetic';
export interface AgentError {
    type: ErrorType;
    category: ErrorCategory;
    message: string;
    details?: Record<string, unknown>;
    recoverable: boolean;
    suggestedStrategy?: RecoveryStrategyType;
    timestamp: number;
    agent: AgentName;
    step?: string;
}
export type ErrorType = 'timeout' | 'dns_failure' | 'connection_refused' | 'ssl_error' | 'network_offline' | 'page_not_found' | 'server_error' | 'forbidden' | 'rate_limited' | 'page_crashed' | 'element_not_found' | 'element_not_visible' | 'element_not_interactable' | 'stale_element' | 'element_obscured' | 'form_validation_failed' | 'invalid_input' | 'required_field_missing' | 'format_mismatch' | 'session_expired' | 'invalid_credentials' | 'account_locked' | '2fa_required' | '2fa_failed' | 'captcha_required' | 'captcha_failed' | 'bot_detected' | 'ip_blocked' | 'fingerprint_blocked' | 'unknown';
export type ErrorCategory = 'network' | 'page' | 'element' | 'validation' | 'authentication' | 'anti_bot' | 'unknown';
export type RecoveryStrategyType = 'retry' | 'refresh' | 'alternative_path' | 'session_reset' | 'proxy_switch' | 'rollback' | 'human_escalation' | 'abort';
export interface RecoveryAction {
    strategy: RecoveryStrategyType;
    params?: Record<string, unknown>;
    maxAttempts?: number;
    delayMs?: number;
}
export interface RecoveryResult {
    success: boolean;
    strategyUsed: RecoveryStrategyType;
    attemptsCount: number;
    finalError?: AgentError;
    resumeFromStep?: string;
}
export type CaptchaType = 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'funcaptcha' | 'text_captcha' | 'slider_captcha' | 'audio_captcha' | 'image_selection' | 'puzzle' | 'unknown';
export interface CaptchaChallenge {
    type: CaptchaType;
    siteKey?: string;
    selector: string;
    iframeSelector?: string;
    challenge?: {
        prompt?: string;
        images?: string[];
        audioUrl?: string;
    };
}
export interface CaptchaSolution {
    type: CaptchaType;
    token?: string;
    selectedIndices?: number[];
    textAnswer?: string;
    sliderPosition?: number;
    success: boolean;
    confidence: number;
}
export type MemoryTier = 'L0_working' | 'L1_episodic' | 'L2_semantic' | 'L3_procedural';
export interface Memory {
    id: string;
    tier: MemoryTier;
    content: unknown;
    embedding?: number[];
    metadata: MemoryMetadata;
    createdAt: number;
    lastAccessedAt: number;
    accessCount: number;
    importance: number;
}
export interface MemoryMetadata {
    platform?: Platform;
    url?: string;
    action?: string;
    success?: boolean;
    tags?: string[];
}
export interface MemoryQuery {
    query: string;
    tier?: MemoryTier;
    platform?: Platform;
    limit?: number;
    minImportance?: number;
    timeRangeMs?: number;
}
export interface MemoryResult {
    memories: Memory[];
    totalCount: number;
    queryTimeMs: number;
}
export interface AgentEvent {
    id: string;
    type: EventType;
    source: AgentName;
    target?: AgentName;
    payload: unknown;
    correlationId: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export type EventType = 'TASK_RECEIVED' | 'PLAN_CREATED' | 'STEP_STARTED' | 'STEP_COMPLETED' | 'STEP_FAILED' | 'CHECKPOINT_CREATED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'AGENT_REQUEST' | 'AGENT_RESPONSE' | 'AGENT_ERROR' | 'NAVIGATION_STARTED' | 'NAVIGATION_COMPLETED' | 'PAGE_ANALYZED' | 'ELEMENT_FOUND' | 'ELEMENT_NOT_FOUND' | 'ACTION_PERFORMED' | 'AUTH_CHECK_REQUESTED' | 'AUTH_VERIFIED' | 'AUTH_FAILED' | 'TWO_FACTOR_REQUIRED' | 'ERROR_DETECTED' | 'RECOVERY_STARTED' | 'RECOVERY_COMPLETED' | 'SUCCESS_RECORDED' | 'FAILURE_RECORDED' | 'PATTERN_LEARNED';
export interface EventSubscription {
    eventType: EventType | '*';
    handler: (event: AgentEvent) => void | Promise<void>;
    filter?: (event: AgentEvent) => boolean;
}
export interface AgentMetrics {
    agent: AgentName;
    invocations: number;
    successCount: number;
    failureCount: number;
    avgDurationMs: number;
    p50DurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
    errorRate: number;
    lastInvocation: number;
}
export interface WorkflowMetrics {
    workflowId: string;
    name: string;
    totalDurationMs: number;
    stepCount: number;
    retryCount: number;
    errorCount: number;
    recoveryCount: number;
    status: ExecutionStatus;
    agentBreakdown: Record<AgentName, {
        invocations: number;
        durationMs: number;
        errors: number;
    }>;
}
export interface TraceSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    agent: AgentName;
    startTime: number;
    endTime?: number;
    status: 'ok' | 'error';
    tags: Record<string, string | number | boolean>;
    logs: TraceLog[];
}
export interface TraceLog {
    timestamp: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map
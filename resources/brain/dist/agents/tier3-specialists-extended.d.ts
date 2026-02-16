/**
 * CHROMADON Tier 3: Extended Specialist Layer
 * ============================================
 * THE ECOMMERCE EXPERT - Shopping & Checkout Automation
 * THE DATA EXTRACTOR - Web Scraping & Structured Data
 * THE RESEARCH AGENT - Multi-Source Intelligence Gathering
 * THE BOOKING AGENT - Reservations & Appointments
 * THE PAYMENT HANDLER - Payment Form Automation
 *
 * Production-grade with circuit breakers, observability, and resilience
 */
import { BaseAgent } from './tier0-orchestration';
export interface Product {
    id: string;
    name: string;
    price: number;
    currency: string;
    quantity: number;
    url?: string;
    imageUrl?: string;
    variants?: Record<string, string>;
    inStock: boolean;
}
export interface CartState {
    items: Product[];
    subtotal: number;
    tax?: number;
    shipping?: number;
    total: number;
    currency: string;
    promoCode?: string;
    discount?: number;
}
export interface ShippingAddress {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
}
export interface CheckoutData {
    email: string;
    shipping: ShippingAddress;
    billingAddress?: ShippingAddress;
    paymentMethod: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
    saveInfo?: boolean;
}
export interface ExtractedData {
    type: 'table' | 'list' | 'product' | 'contact' | 'article' | 'custom';
    schema: Record<string, string>;
    data: Record<string, unknown>[];
    sourceUrl: string;
    extractedAt: number;
    confidence: number;
}
export interface ExtractionRule {
    name: string;
    selector: string;
    attribute?: string;
    transform?: 'trim' | 'lowercase' | 'number' | 'date' | 'url';
    required?: boolean;
}
export interface ResearchQuery {
    topic: string;
    depth: 'shallow' | 'medium' | 'deep';
    sources?: string[];
    excludeDomains?: string[];
    maxSources?: number;
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}
export interface ResearchResult {
    query: string;
    summary: string;
    keyFindings: string[];
    sources: Array<{
        url: string;
        title: string;
        snippet: string;
        relevance: number;
        extractedData?: Record<string, unknown>;
    }>;
    confidence: number;
    completedAt: number;
}
export interface BookingRequest {
    type: 'hotel' | 'restaurant' | 'appointment' | 'flight' | 'rental' | 'event';
    platform?: string;
    date: string;
    time?: string;
    duration?: number;
    guests?: number;
    location?: string;
    preferences?: Record<string, string>;
    contactInfo: {
        name: string;
        email: string;
        phone?: string;
    };
}
export interface BookingConfirmation {
    success: boolean;
    confirmationNumber?: string;
    details: {
        date: string;
        time?: string;
        location?: string;
        totalPrice?: number;
        currency?: string;
    };
    cancellationPolicy?: string;
    calendarLink?: string;
}
export interface PaymentDetails {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    cardholderName: string;
    billingZip?: string;
}
interface PlatformSelectors {
    addToCart: string[];
    cart: string[];
    checkout: string[];
    quantity: string[];
    variant: string[];
    price: string[];
    removeItem: string[];
    promoCode: string[];
    applyPromo: string[];
}
export declare class TheEcommerceExpert extends BaseAgent {
    private client;
    private platformSelectors;
    private cartCache;
    private circuitBreaker;
    constructor();
    private initPlatformSelectors;
    addToCart(cdpController: any, product: {
        url?: string;
        quantity?: number;
        variants?: Record<string, string>;
    }): Promise<{
        success: boolean;
        cartState?: CartState;
        error?: string;
    }>;
    getCartState(cdpController: any, selectors?: PlatformSelectors): Promise<CartState>;
    proceedToCheckout(cdpController: any): Promise<{
        success: boolean;
        checkoutUrl?: string;
        error?: string;
    }>;
    fillCheckoutForm(cdpController: any, checkoutData: CheckoutData): Promise<{
        success: boolean;
        error?: string;
    }>;
    applyPromoCode(cdpController: any, code: string): Promise<{
        success: boolean;
        discount?: number;
        error?: string;
    }>;
    private detectPlatform;
    private selectVariant;
    private setQuantity;
    private clickFirstMatch;
    private fillField;
    private waitForPageLoad;
    private waitForCartUpdate;
    private delay;
}
export declare class TheDataExtractor extends BaseAgent {
    private client;
    private extractionCache;
    private circuitBreaker;
    constructor();
    extractTable(cdpController: any, tableSelector?: string): Promise<ExtractedData>;
    extractWithRules(cdpController: any, rules: ExtractionRule[]): Promise<ExtractedData>;
    extractProducts(cdpController: any): Promise<ExtractedData>;
    extractContactInfo(cdpController: any): Promise<ExtractedData>;
    extractArticle(cdpController: any): Promise<ExtractedData>;
    scrapeWithPagination(cdpController: any, extractFn: () => Promise<ExtractedData>, nextButtonSelector: string, maxPages?: number): Promise<ExtractedData>;
}
export declare class TheResearchAgent extends BaseAgent {
    private client;
    private researchCache;
    private circuitBreaker;
    constructor();
    research(cdpController: any, query: ResearchQuery): Promise<ResearchResult>;
    compareProducts(cdpController: any, products: string[], criteria: string[]): Promise<ResearchResult>;
    factCheck(cdpController: any, claim: string): Promise<{
        claim: string;
        verdict: 'true' | 'false' | 'mixed' | 'unverified';
        confidence: number;
        evidence: string[];
        sources: string[];
    }>;
    private waitForPageLoad;
    private delay;
}
export declare class TheBookingAgent extends BaseAgent {
    private client;
    private platformConfigs;
    private circuitBreaker;
    constructor();
    private initPlatformConfigs;
    searchAvailability(cdpController: any, request: BookingRequest): Promise<{
        available: boolean;
        options: Array<{
            name: string;
            time?: string;
            price?: number;
            details?: string;
        }>;
    }>;
    makeBooking(cdpController: any, request: BookingRequest, optionIndex?: number): Promise<BookingConfirmation>;
    private detectPlatform;
    private searchWithVision;
    private fillField;
    private clickElement;
    private selectDate;
    private setGuests;
    private extractResults;
    private fillBookingForm;
    private waitForPageLoad;
    private delay;
}
export declare class ThePaymentHandler extends BaseAgent {
    private client;
    private circuitBreaker;
    constructor();
    detectPaymentForm(cdpController: any): Promise<{
        detected: boolean;
        type: 'stripe' | 'braintree' | 'paypal' | 'square' | 'native' | 'unknown';
        fields: string[];
        iframeDetected: boolean;
    }>;
    fillPaymentForm(cdpController: any, paymentDetails: PaymentDetails): Promise<{
        success: boolean;
        error?: string;
    }>;
    clickPayButton(cdpController: any): Promise<{
        success: boolean;
        error?: string;
    }>;
    verifyPaymentSuccess(cdpController: any): Promise<{
        success: boolean;
        confirmationNumber?: string;
        message?: string;
    }>;
    selectPaymentMethod(cdpController: any, method: 'card' | 'paypal' | 'apple_pay' | 'google_pay'): Promise<{
        success: boolean;
        error?: string;
    }>;
    private fillPaymentField;
    private checkFieldExists;
    private delay;
}
export interface ExtendedSpecialistAgents {
    ecommerceExpert: TheEcommerceExpert;
    dataExtractor: TheDataExtractor;
    researchAgent: TheResearchAgent;
    bookingAgent: TheBookingAgent;
    paymentHandler: ThePaymentHandler;
}
/**
 * Create all extended specialist agents
 * These require CDP controller injection via setCDPController()
 */
export declare function createExtendedSpecialists(): ExtendedSpecialistAgents;
export declare const ecommerceExpert: TheEcommerceExpert;
export declare const dataExtractor: TheDataExtractor;
export declare const researchAgent: TheResearchAgent;
export declare const bookingAgent: TheBookingAgent;
export declare const paymentHandler: ThePaymentHandler;
export { Product, CartState, ShippingAddress, CheckoutData, ExtractedData, ExtractionRule, ResearchQuery, ResearchResult, BookingRequest, BookingConfirmation, PaymentDetails, };
//# sourceMappingURL=tier3-specialists-extended.d.ts.map
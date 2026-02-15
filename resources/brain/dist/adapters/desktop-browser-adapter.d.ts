/**
 * DesktopBrowserAdapter
 *
 * Implements CDPController interface by calling chromadon-desktop's REST API.
 * Allows the 27-Agent System to control Electron BrowserView tabs.
 */
interface CDPController {
    navigate(url: string): Promise<{
        success: boolean;
        finalUrl: string;
        loadTime: number;
    }>;
    click(selector: string, options?: {
        timeout?: number;
        force?: boolean;
    }): Promise<{
        success: boolean;
    }>;
    clickCoordinates(x: number, y: number): Promise<{
        success: boolean;
    }>;
    type(selector: string, text: string, options?: {
        delay?: number;
        clear?: boolean;
    }): Promise<{
        success: boolean;
    }>;
    typeKeys(keys: string[]): Promise<{
        success: boolean;
    }>;
    scroll(options: {
        direction: 'up' | 'down' | 'left' | 'right';
        amount: number;
    }): Promise<void>;
    scrollToElement(selector: string): Promise<{
        success: boolean;
    }>;
    scrollToCoordinates(x: number, y: number): Promise<void>;
    select(selector: string, value: string): Promise<{
        success: boolean;
    }>;
    selectMultiple(selector: string, values: string[]): Promise<{
        success: boolean;
    }>;
    uploadFile(selector: string, filePath: string): Promise<{
        success: boolean;
    }>;
    screenshot(): Promise<string>;
    getHTML(): Promise<string>;
    evaluate<T>(script: string): Promise<T>;
    waitForSelector(selector: string, timeout?: number): Promise<boolean>;
    waitForNavigation(timeout?: number): Promise<boolean>;
    goBack(): Promise<void>;
    goForward(): Promise<void>;
    refresh(): Promise<void>;
    send(method: string, params?: any): Promise<any>;
}
interface TabInfo {
    id: number;
    url: string;
    title: string;
    isActive: boolean;
}
export declare class DesktopBrowserAdapter implements CDPController {
    private baseUrl;
    private activeTabId;
    constructor(baseUrl?: string);
    /**
     * Health check - verify Desktop is running
     */
    healthCheck(): Promise<boolean>;
    /**
     * List all open browser tabs
     */
    listTabs(): Promise<TabInfo[]>;
    /**
     * Switch to a specific tab by ID
     */
    switchTab(tabId: number): Promise<void>;
    /**
     * Find a tab whose URL contains the given domain
     */
    findTabByDomain(domain: string): Promise<TabInfo | null>;
    /**
     * Get all platform sessions from Desktop (authenticated social media accounts)
     */
    getPlatformSessions(): Promise<Array<{
        platform: string;
        isAuthenticated: boolean;
        accountName?: string;
    }>>;
    /**
     * Get or create active tab ID
     */
    private getActiveTabId;
    /**
     * Execute JavaScript in BrowserView and return result
     */
    private execute;
    /**
     * Get element center coordinates from selector
     */
    private getElementCoordinates;
    navigate(url: string): Promise<{
        success: boolean;
        finalUrl: string;
        loadTime: number;
    }>;
    click(selector: string, options?: {
        timeout?: number;
        force?: boolean;
    }): Promise<{
        success: boolean;
    }>;
    clickCoordinates(x: number, y: number): Promise<{
        success: boolean;
    }>;
    type(selector: string, text: string, options?: {
        delay?: number;
        clear?: boolean;
    }): Promise<{
        success: boolean;
    }>;
    typeKeys(keys: string[]): Promise<{
        success: boolean;
    }>;
    scroll(options: {
        direction: 'up' | 'down' | 'left' | 'right';
        amount: number;
    }): Promise<void>;
    scrollToElement(selector: string): Promise<{
        success: boolean;
    }>;
    scrollToCoordinates(x: number, y: number): Promise<void>;
    select(selector: string, value: string): Promise<{
        success: boolean;
    }>;
    selectMultiple(selector: string, values: string[]): Promise<{
        success: boolean;
    }>;
    uploadFile(selector: string, filePath: string): Promise<{
        success: boolean;
    }>;
    screenshot(): Promise<string>;
    getHTML(): Promise<string>;
    evaluate<T>(script: string): Promise<T>;
    waitForSelector(selector: string, timeout?: number): Promise<boolean>;
    waitForNavigation(timeout?: number): Promise<boolean>;
    goBack(): Promise<void>;
    goForward(): Promise<void>;
    refresh(): Promise<void>;
    send(method: string, params?: any): Promise<any>;
    private sleep;
}
export default DesktopBrowserAdapter;
//# sourceMappingURL=desktop-browser-adapter.d.ts.map
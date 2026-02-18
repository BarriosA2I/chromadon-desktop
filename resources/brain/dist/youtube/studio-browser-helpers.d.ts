/**
 * YouTube Studio Browser Helpers
 *
 * Functions that return injectable JavaScript strings for page.evaluate().
 * These run in the BROWSER context (not Node.js) and handle YouTube Studio's
 * Lit/Polymer Shadow DOM architecture.
 *
 * @author Barrios A2I
 */
/**
 * Returns JS that recursively walks all shadow roots to find the first
 * element matching the given CSS selector.
 * Returns: HTMLElement | null
 */
export declare function deepQueryScript(selector: string): string;
/**
 * Returns JS that polls for an element (piercing shadow DOM) until found or timeout.
 * Returns: Promise<string> — element outerHTML snippet or 'TIMEOUT'
 */
export declare function waitForDeepElementScript(selector: string, timeoutMs?: number): string;
/**
 * Returns JS that finds a visible element containing the given text,
 * piercing all shadow roots. Useful for finding buttons by label.
 * Returns: { found: boolean, tag: string, text: string } | null
 */
export declare function waitForTextScript(text: string, timeoutMs?: number): string;
/**
 * Returns JS that properly types text into a Lit/Polymer input element.
 * Fires the full event chain that Lit's two-way data binding requires.
 * Returns: { success: boolean, message: string }
 */
export declare function litTextInputScript(selector: string, text: string): string;
/**
 * Returns JS that types a tag string and presses Enter to create a chip/token.
 * Used for YouTube Studio's tag input fields.
 * Returns: { success: boolean, message: string }
 */
export declare function litTagInputScript(selector: string, tag: string): string;
/**
 * Returns JS that clicks a Lit/Polymer element with the proper event chain.
 * Dispatches mousedown → mouseup → click for Polymer compatibility.
 * Returns: { success: boolean, message: string }
 */
export declare function litClickScript(selector: string): string;
/**
 * Returns JS that finds a visible element by text content (piercing shadow DOM)
 * and clicks it with the Lit/Polymer event chain.
 * Returns: { success: boolean, message: string }
 */
export declare function litClickByTextScript(text: string): string;
//# sourceMappingURL=studio-browser-helpers.d.ts.map
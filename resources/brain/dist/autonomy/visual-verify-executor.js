"use strict";
/**
 * Visual Verify Executor — AI vision verification of browser actions
 *
 * Takes a screenshot + DOM text, sends to Gemini vision (haiku tier = $0.10/M)
 * to classify whether the last action succeeded.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVisualVerifyExecutor = void 0;
const gemini_llm_1 = require("../agents/gemini-llm");
const VERIFY_SYSTEM_PROMPT = `You are a visual verification agent for browser automation.
Analyze the screenshot and DOM text to determine if the described action succeeded.

Respond with EXACTLY this JSON format (no markdown, no extra text):
{
  "verified": true/false,
  "evidence": "Brief description of what you see on the page that supports your conclusion",
  "recommendation": "If not verified, suggest what to try next. If verified, say 'Proceed to next step.'"
}`;
function createVisualVerifyExecutor(desktopUrl, activeTabRef) {
    return async (_toolName, input) => {
        const tabId = activeTabRef.tabId;
        if (!tabId) {
            return JSON.stringify({
                verified: false,
                evidence: 'No active browser tab to verify.',
                recommendation: 'Navigate to a page first.',
            });
        }
        try {
            // 1. Take screenshot of active tab
            const screenshotResp = await fetch(`${desktopUrl}/tabs/screenshot/${tabId}`);
            if (!screenshotResp.ok) {
                return JSON.stringify({
                    verified: false,
                    evidence: `Failed to take screenshot: HTTP ${screenshotResp.status}`,
                    recommendation: 'Try again or check if the tab is still open.',
                });
            }
            const buffer = Buffer.from(await screenshotResp.arrayBuffer());
            const base64 = buffer.toString('base64');
            // 2. Get DOM text for context
            let domText = '';
            try {
                const domResp = await fetch(`${desktopUrl}/tabs/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: tabId,
                        script: `(function(){ return { title: document.title, url: location.href, text: (document.body?.innerText || '').substring(0, 3000) }; })()`,
                    }),
                });
                if (domResp.ok) {
                    const domData = await domResp.json();
                    domText = JSON.stringify(domData.result || domData);
                }
            }
            catch {
                // DOM text is supplementary, not critical
            }
            // 3. Call Gemini vision (haiku = cheapest tier)
            const userMessage = [
                `Action performed: ${input.action}`,
                `Expected result: ${input.expected}`,
                domText ? `\nDOM context: ${domText}` : '',
                '\nAnalyze the screenshot and determine if the action succeeded.',
            ].join('\n');
            const result = await (0, gemini_llm_1.callGeminiVision)(VERIFY_SYSTEM_PROMPT, base64, userMessage, { model: 'haiku', maxTokens: 512, mimeType: 'image/png' });
            // Try to parse as JSON, return raw if not parseable
            try {
                JSON.parse(result);
                return result;
            }
            catch {
                return JSON.stringify({
                    verified: result.toLowerCase().includes('verified') && !result.toLowerCase().includes('not verified'),
                    evidence: result,
                    recommendation: 'Could not parse structured response. Review the evidence above.',
                });
            }
        }
        catch (err) {
            return JSON.stringify({
                verified: false,
                evidence: `Verification error: ${err.message}`,
                recommendation: 'Visual verification failed. Proceed with caution or retry the action.',
            });
        }
    };
}
exports.createVisualVerifyExecutor = createVisualVerifyExecutor;
//# sourceMappingURL=visual-verify-executor.js.map
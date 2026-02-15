"use strict";
/**
 * Social Media Monitoring - Platform-Specific Prompts
 *
 * Prompts instruct the AI to check notifications and respond to comments.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedMonitoringPlatforms = exports.getMonitoringPrompt = void 0;
function getMonitoringPrompt(platform, autoReplyRules) {
    const baseInstructions = `You are running a BACKGROUND MONITORING CYCLE. Do NOT greet the user or ask questions. Work silently and efficiently.

AUTO-REPLY RULES (from database):
${autoReplyRules || 'No auto-reply rules configured. Use your best judgment to reply helpfully.'}

INSTRUCTIONS:
1. Navigate to ${getPlatformNotificationsUrl(platform)}
2. Take a screenshot to see the current notifications/mentions
3. Look for NEW comments, replies, or mentions (things you haven't responded to)
4. For each new comment/mention:
   a. Check if any auto-reply rule matches (keyword, mention, question triggers)
   b. If a rule matches, compose a reply based on the template (adapt it, don't copy verbatim)
   c. If no rule matches, compose a brief, friendly, on-brand reply
   d. Post the reply by clicking the reply button and typing your response
5. After processing all visible items, report a JSON summary

RESPONSE FORMAT (output this JSON at the end):
\`\`\`json
{
  "platform": "${platform}",
  "comments_found": 3,
  "replies_sent": 2,
  "actions": [
    {"type": "reply", "author": "@username", "comment": "original comment text", "reply": "your reply text"},
    {"type": "skip", "author": "@other", "comment": "text", "reason": "already replied"}
  ],
  "errors": []
}
\`\`\`

RULES:
- Be brief and professional in replies
- Never be argumentative or defensive
- Match the brand voice (friendly, helpful, professional)
- Skip comments you've already replied to
- Skip spam or irrelevant comments
- Max 5 replies per cycle to avoid looking automated`;
    return baseInstructions;
}
exports.getMonitoringPrompt = getMonitoringPrompt;
function getPlatformNotificationsUrl(platform) {
    switch (platform) {
        case 'twitter': return 'https://twitter.com/notifications/mentions';
        case 'linkedin': return 'https://www.linkedin.com/notifications/';
        case 'instagram': return 'https://www.instagram.com/accounts/activity/';
        case 'facebook': return 'https://www.facebook.com/notifications';
        case 'youtube': return 'https://studio.youtube.com/channel/comments';
    }
}
function getSupportedMonitoringPlatforms() {
    return ['twitter', 'linkedin', 'youtube'];
}
exports.getSupportedMonitoringPlatforms = getSupportedMonitoringPlatforms;
//# sourceMappingURL=monitor-prompts.js.map
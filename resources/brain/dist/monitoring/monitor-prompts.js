"use strict";
/**
 * Social Media Monitoring - Platform-Specific Prompts
 *
 * Prompts instruct the AI to check EXISTING open tabs for new comments/mentions
 * and respond using safe, read-first patterns. NEVER navigates to new URLs.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedMonitoringPlatforms = exports.getMonitoringPrompt = exports.getPlatformDomains = void 0;
/**
 * Returns domains to match when looking for existing tabs for a platform.
 */
function getPlatformDomains(platform) {
    switch (platform) {
        case 'twitter': return ['x.com', 'twitter.com'];
        case 'linkedin': return ['linkedin.com', 'www.linkedin.com'];
        case 'instagram': return ['instagram.com', 'www.instagram.com'];
        case 'facebook': return ['facebook.com', 'www.facebook.com'];
        case 'youtube': return ['youtube.com', 'studio.youtube.com'];
    }
}
exports.getPlatformDomains = getPlatformDomains;
function getMonitoringPrompt(platform, autoReplyRules) {
    const domains = getPlatformDomains(platform);
    const platformInstructions = getPlatformInstructions(platform);
    return `You are running a BACKGROUND MONITORING CYCLE. Do NOT greet the user or ask questions. Work silently and efficiently.

AUTO-REPLY RULES (from database):
${autoReplyRules || 'No auto-reply rules configured. Use your best judgment to reply helpfully.'}

== STEP 1: FIND THE TAB ==
Call list_tabs() to see all open browser tabs.
Look for a tab whose URL contains any of these domains: ${domains.join(', ')}
If NO matching tab is found, output this JSON and stop:
\`\`\`json
{"platform": "${platform}", "comments_found": 0, "replies_sent": 0, "actions": [], "errors": ["No ${platform} tab open in browser"]}
\`\`\`

== STEP 2: SWITCH TO THE TAB ==
Call switch_tab with the matching tab's ID.

== STEP 3: READ THE PAGE (DO NOT CLICK ANYTHING YET) ==
1. Call take_screenshot() to see the current page state
2. Call extract_text() to read all visible text content
3. Read the text carefully. Look for:
   - New comments, replies, or mentions from other users
   - Notification badges or unread indicators
   - Comment sections under posts

== STEP 4: DECIDE WHAT TO DO ==
Based on what you read in Step 3:
- If there are new comments/mentions that need a reply, proceed to Step 5
- If there is nothing new or you have already replied to everything visible, output the JSON summary and stop
- If the page shows a login wall or error, report it in the errors array and stop

== STEP 5: REPLY TO COMMENTS (CAREFULLY) ==
For each new comment or mention (max 5 per cycle):
1. Call get_interactive_elements() to find all clickable elements
2. Find the REPLY button for that specific comment (see platform guide below)
3. Click ONLY the reply button
4. Type your reply in the text input that appears
5. Click the Post/Send/Submit button

When composing a reply:
- Keep it brief (1-2 sentences max)
- Be professional and helpful
- Match the brand voice (friendly, knowledgeable, not salesy)
- Acknowledge what the person said before responding
- Never be argumentative or defensive

${platformInstructions}

== SAFETY RULES (MANDATORY) ==
NEVER CLICK any button or element containing these words:
- delete, remove, mute, block, report, archive, dismiss, hide
- unfollow, disconnect, unfriend, leave
- "Clear all", "Mark all as read", "Delete all"
- Any "X" or close icon on notifications or popups
- Any "..." or "more options" menu (these often contain destructive actions)

SAFE TO CLICK (ONLY these):
- "Reply" or "Comment" buttons/links
- Text input fields for typing replies
- "Post", "Send", "Submit", "Reply" buttons ONLY after you have typed text
- "Like" buttons (if auto-reply rules say to like)

If you are UNSURE what a button does, call get_interactive_elements() first and check the element text/aria-label before clicking.

DO NOT navigate to any URL. DO NOT create new tabs. ONLY work on existing tabs.

== OUTPUT FORMAT ==
After processing, output this JSON:
\`\`\`json
{
  "platform": "${platform}",
  "comments_found": 0,
  "replies_sent": 0,
  "actions": [
    {"type": "reply", "author": "@username", "comment": "their comment", "reply": "your reply"},
    {"type": "skip", "author": "@other", "comment": "text", "reason": "already replied"}
  ],
  "errors": []
}
\`\`\`

RULES:
- Be brief and professional in replies
- Never be argumentative or defensive
- Match the brand voice (friendly, helpful, professional)
- Skip comments you have already replied to
- Skip spam or irrelevant comments
- Max 5 replies per cycle to avoid looking automated`;
}
exports.getMonitoringPrompt = getMonitoringPrompt;
function getPlatformInstructions(platform) {
    switch (platform) {
        case 'twitter':
            return `== PLATFORM GUIDE: Twitter/X ==
- Reply button: speech bubble icon in the action bar below each tweet
- After clicking reply, a text input appears — type your reply there
- Click the blue "Reply" button to submit
- Mentions appear in the Notifications tab or in your timeline
- DO NOT click the heart (like), retweet, or share buttons unless rules say to`;
        case 'linkedin':
            return `== PLATFORM GUIDE: LinkedIn ==
- Reply button: "Reply" text link under each comment on a post
- After clicking Reply, a text input appears — type your reply there
- Click "Post" or press Enter to submit
- Comments appear under posts in your feed or on your company page
- DO NOT click "..." menu on any comment or notification
- DO NOT click any notification dismiss or X icons
- DO NOT click "Delete" on any comment`;
        case 'youtube':
            return `== PLATFORM GUIDE: YouTube ==
- Reply button: "Reply" text link under each comment
- After clicking Reply, a text input appears — type your reply there
- Click the blue "Reply" button to submit
- In YouTube Studio, use the Comments section to see and reply
- DO NOT click the three-dot "..." menu on comments
- DO NOT click "Remove" or "Hide user" or "Report"`;
        case 'instagram':
            return `== PLATFORM GUIDE: Instagram ==
- Reply button: "Reply" text link under each comment
- After clicking Reply, a text input appears — type your reply there
- Press Enter or click the send arrow to submit
- DO NOT click "..." menu on any comment
- DO NOT click "Delete" on any comment`;
        case 'facebook':
            return `== PLATFORM GUIDE: Facebook ==
- Reply button: "Reply" text link under each comment
- After clicking Reply, a text input appears — type your reply there
- Press Enter to submit
- DO NOT click "..." menu on any comment or notification
- DO NOT click "Delete", "Hide", or "Report"`;
    }
}
function getSupportedMonitoringPlatforms() {
    return ['twitter', 'linkedin', 'youtube'];
}
exports.getSupportedMonitoringPlatforms = getSupportedMonitoringPlatforms;
//# sourceMappingURL=monitor-prompts.js.map
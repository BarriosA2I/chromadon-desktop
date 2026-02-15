"use strict";
/**
 * Social Media Overlord - Platform-Specific Prompt Templates
 * ==========================================================
 * Generates browser automation prompts for each platform + action combo.
 * The Agentic Orchestrator uses these to drive Claude's tool-use loop.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSocialPrompt = void 0;
// ============================================================================
// PLATFORM URLs
// ============================================================================
const PLATFORM_URLS = {
    twitter: 'https://x.com',
    linkedin: 'https://www.linkedin.com',
    instagram: 'https://www.instagram.com',
    facebook: 'https://www.facebook.com',
    tiktok: 'https://www.tiktok.com',
    youtube: 'https://www.youtube.com',
    pinterest: 'https://www.pinterest.com',
    google: 'https://www.google.com',
};
function getPlatformDomain(platform) {
    const url = PLATFORM_URLS[platform];
    try {
        return new URL(url).hostname.replace('www.', '');
    }
    catch {
        return platform + '.com';
    }
}
// ============================================================================
// PLATFORM-SPECIFIC ACTION PROMPTS
// ============================================================================
const PLATFORM_ACTIONS = {
    twitter: {
        post: `Navigate to x.com. Click the compose/post button (look for "Post" or the feather/quill icon in the sidebar, or the compose area). Type the provided content into the tweet composer. If hashtags are provided, append them at the end with spaces. Click the "Post" button to publish. After posting, verify the tweet appeared by checking for a success indicator or navigating to your profile.`,
        comment: `Navigate to the target URL. Find the reply/comment area below the tweet. Click on it and type the provided content. Click "Reply" to submit. Verify the reply appeared.`,
        like: `Navigate to the target URL. Find and click the heart/like button on the tweet. Verify it turned red/filled to confirm the like.`,
        follow: `Navigate to the target URL (user profile). Find and click the "Follow" button. Verify it changed to "Following".`,
        dm: `Navigate to x.com/messages. Click "New message" or the compose icon. Search for the recipient in the search field. Select them. Type the message content and send it.`,
        search: `Navigate to x.com. Find the search input. Type the search query. Press Enter. Extract the top results including tweet text, author, engagement counts.`,
        scrape: `Navigate to the target URL. Extract all visible content including text, engagement metrics (likes, retweets, replies), timestamps, and author information. Scroll down to capture more content if needed.`,
    },
    linkedin: {
        post: `Navigate to linkedin.com. Click "Start a post" in the share box at the top of the feed. Type the provided content into the post editor. If hashtags are provided, append them at the end. Click the "Post" button to publish. Verify the post appeared in your feed.`,
        comment: `Navigate to the target URL. Scroll to find the comment section. Click the comment input area. Type the provided content. Press Enter or click Post to submit. Verify the comment appeared.`,
        like: `Navigate to the target URL. Find and click the "Like" button (thumbs up icon). Verify it shows as liked.`,
        follow: `Navigate to the target URL (user or company profile). Click "Follow" or "Connect". If connecting, add a note if content is provided. Verify the action completed.`,
        dm: `Navigate to linkedin.com/messaging. Click "Compose" or start a new message. Search for the recipient. Type the message content and send.`,
        search: `Navigate to linkedin.com. Use the search bar to search for the query. Extract relevant results including names, titles, companies, and connection status.`,
        scrape: `Navigate to the target URL. Extract all visible content including post text, engagement (reactions, comments, reposts), author info, and timestamps.`,
    },
    instagram: {
        post: `This platform requires mobile or the Instagram web creator tools. Navigate to instagram.com. Look for the Create/New Post option (+ icon). If available, upload content and add a caption with the provided text and hashtags.`,
        comment: `Navigate to the target URL. Find the comment input field. Type the provided content. Press Enter or click Post to submit.`,
        like: `Navigate to the target URL. Find and click the heart/like button on the post. Verify it turned red.`,
        follow: `Navigate to the target URL (user profile). Click the "Follow" button. Verify it changed to "Following".`,
        dm: `Navigate to instagram.com/direct/inbox. Start a new message. Search for the recipient. Type and send the message.`,
        search: `Navigate to instagram.com. Use the search/explore feature. Search for the query. Extract relevant profiles and posts.`,
        scrape: `Navigate to the target URL. Extract visible content including post images/descriptions, likes, comments, and author info.`,
    },
    facebook: {
        post: `Navigate to facebook.com. Find the "What's on your mind?" composer. Click it. Type the provided content. Click "Post" to publish. Verify it appeared in your feed.`,
        comment: `Navigate to the target URL. Find the comment input. Type the provided content. Press Enter to submit.`,
        like: `Navigate to the target URL. Find and click the "Like" button. Verify it shows as liked.`,
        follow: `Navigate to the target URL. Click "Follow" or "Add Friend" depending on the profile type.`,
        dm: `Navigate to facebook.com/messages or messenger.com. Start a new message. Search for the recipient. Type and send the message.`,
        search: `Navigate to facebook.com. Use the search bar. Search for the query. Extract relevant results.`,
        scrape: `Navigate to the target URL. Extract all visible content including post text, engagement, and author info.`,
    },
    youtube: {
        post: `Navigate to youtube.com. Look for the community post option or Create button. If available, write the provided content as a community post.`,
        comment: `Navigate to the target URL (video page). Scroll down to the comments section. Click the comment input. Type the provided content. Click "Comment" to submit.`,
        like: `Navigate to the target URL (video page). Find and click the thumbs up/like button. Verify it shows as liked.`,
        follow: `Navigate to the target URL (channel page). Click the "Subscribe" button. Verify subscription.`,
        search: `Navigate to youtube.com. Use the search bar. Search for the query. Extract video titles, channels, view counts, and upload dates.`,
        scrape: `Navigate to the target URL. Extract video info: title, description, view count, likes, comments count, channel info, and upload date.`,
    },
    tiktok: {
        search: `Navigate to tiktok.com. Use the search/discover feature. Search for the query. Extract relevant results.`,
        scrape: `Navigate to the target URL. Extract visible content including video description, likes, comments, shares, and creator info.`,
        like: `Navigate to the target URL. Find and click the heart/like button.`,
        comment: `Navigate to the target URL. Find the comment input. Type the provided content. Submit it.`,
        follow: `Navigate to the target URL (creator profile). Click "Follow". Verify.`,
    },
    pinterest: {
        search: `Navigate to pinterest.com. Use the search bar. Search for the query. Extract pin titles, descriptions, and image info.`,
        scrape: `Navigate to the target URL. Extract pin details including title, description, source, and engagement.`,
        like: `Navigate to the target URL. Find and click the save/heart button.`,
    },
    google: {
        search: `Navigate to google.com. Type the search query into the search box. Press Enter. Extract the top search results including titles, URLs, and descriptions.`,
        scrape: `Navigate to the target URL. Extract all visible text content from the page.`,
    },
};
// ============================================================================
// PROMPT GENERATOR
// ============================================================================
function generateSocialPrompt(ctx) {
    const platformUrl = PLATFORM_URLS[ctx.platform] || ctx.platform;
    const actionTemplate = PLATFORM_ACTIONS[ctx.platform]?.[ctx.action];
    // Build the base instruction
    let prompt = '';
    // Pre-check instruction — tab-aware (reuse existing authenticated tabs)
    const domain = getPlatformDomain(ctx.platform);
    prompt += `IMPORTANT: First, call list_tabs() to see all open browser tabs. Look for a tab whose URL contains "${domain}".
- If you find a matching tab: call switch_tab with that tab's ID to switch to it.
- If NO matching tab exists: call navigate to go to ${platformUrl}.
Do NOT create a new tab if one already exists for this platform.
If the page shows a login screen or "Sign in" prompt, report "AUTH_WALL:${ctx.platform}" — the system will attempt automatic session restore. If session restore fails and you still see a login page, STOP and report that the user is not authenticated on ${ctx.platform}.\n\n`;
    if (ctx.action === 'custom' && ctx.customInstructions) {
        prompt += `TASK: ${ctx.customInstructions}\n`;
        prompt += `Platform: ${ctx.platform} (${platformUrl})\n`;
        // Include explicit posting steps so the AI navigates + posts, not just generates text
        const postTemplate = PLATFORM_ACTIONS[ctx.platform]?.['post'];
        if (postTemplate) {
            prompt += `\nAfter generating the content, POST IT using these steps:\n${postTemplate}\n`;
            prompt += `Use the generated content as the post text.\n`;
        }
    }
    else if (actionTemplate) {
        prompt += `TASK: ${actionTemplate}\n`;
    }
    else {
        // Fallback for unsupported platform+action combos
        prompt += `TASK: Perform a "${ctx.action}" action on ${ctx.platform} (${platformUrl}).\n`;
        prompt += `Use your best judgment to complete this task using the available browser tools.\n`;
    }
    // Add content context
    if (ctx.content) {
        prompt += `\nCONTENT TO USE:\n${ctx.content}\n`;
    }
    else {
        prompt += `\nNO CONTENT PROVIDED — YOU MUST GENERATE IT:
Compose an engaging, platform-appropriate ${ctx.platform} post${ctx.customInstructions ? ` about: ${ctx.customInstructions}` : ''}.
You are an expert social media content creator. Write compelling, authentic posts (not placeholders).
Follow the ORGANIC WRITING STYLE rules: no em dashes, no corporate AI tone, 1-3 emojis max.
Respect character limits: Twitter 280, LinkedIn 3000, Facebook 500, Instagram 2200.\n`;
    }
    if (ctx.targetUrl) {
        prompt += `\nTARGET URL: ${ctx.targetUrl}\n`;
    }
    if (ctx.hashtags && ctx.hashtags.length > 0) {
        prompt += `\nHASHTAGS: ${ctx.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}\n`;
    }
    if (ctx.mentions && ctx.mentions.length > 0) {
        prompt += `\nMENTIONS: ${ctx.mentions.map((m) => (m.startsWith('@') ? m : `@${m}`)).join(' ')}\n`;
    }
    if (ctx.mediaUrls && ctx.mediaUrls.length > 0) {
        prompt += `\nMEDIA FILES TO UPLOAD (${ctx.mediaUrls.length}):\n`;
        ctx.mediaUrls.forEach((url, i) => {
            prompt += `  ${i + 1}. ${url}\n`;
        });
        prompt += `\nIMPORTANT: BEFORE typing any text content, upload each media file first. Click the media/image/photo upload button on the platform, then use the upload_file tool with the file path above. After ALL media is uploaded and visible in the composer, THEN type the text content. Platforms often reset the text composer when media is added, so always upload media FIRST.\n`;
    }
    // Verification instruction — includes anti-double-post guard
    prompt += `\nAfter completing the action, verify it succeeded using take_screenshot or extract_text. Report what happened clearly and concisely.`;
    if (ctx.action === 'post' || ctx.action === 'custom') {
        prompt += `\nCRITICAL: If you already posted successfully (you see the posted content, a success message, or the composer closed after posting), STOP IMMEDIATELY. Do NOT attempt to post again. Report success and move on.`;
    }
    return prompt;
}
exports.generateSocialPrompt = generateSocialPrompt;
//# sourceMappingURL=social-prompts.js.map
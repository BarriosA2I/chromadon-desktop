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
        post: `Navigate to x.com. Click the compose/post button (look for "Post" or the feather/quill icon in the sidebar, or the compose area).
If media needs uploading: Click the image/media icon (mountain/photo icon) in the composer toolbar FIRST. Call upload_file with the media file path. Wait for the image preview to appear in the composer.
Then type the provided content into the tweet composer. If hashtags are provided, append them at the end with spaces.
Click the "Post" button to publish. After posting, verify the tweet appeared by checking for a success indicator or navigating to your profile.`,
        comment: `Navigate to the target URL. Find the reply/comment area below the tweet. Click on it and type the provided content. Click "Reply" to submit. Verify the reply appeared.`,
        like: `Navigate to the target URL. Find and click the heart/like button on the tweet. Verify it turned red/filled to confirm the like.`,
        follow: `Navigate to the target URL (user profile). Find and click the "Follow" button. Verify it changed to "Following".`,
        dm: `Navigate to x.com/messages. Click "New message" or the compose icon. Search for the recipient in the search field. Select them. Type the message content and send it.`,
        search: `Navigate to x.com. Find the search input. Type the search query. Press Enter. Extract the top results including tweet text, author, engagement counts.`,
        scrape: `Navigate to the target URL. Extract all visible content including text, engagement metrics (likes, retweets, replies), timestamps, and author information. Scroll down to capture more content if needed.`,
    },
    linkedin: {
        post: `Navigate to linkedin.com. Click "Start a post" in the share box at the top of the feed to open the post composer modal.
If media needs uploading:
  1. In the composer modal, look for the image/photo icon (mountain/landscape icon) in the toolbar at the bottom.
  2. Click the image icon to open the file upload dialog.
  3. Call upload_file with the media file path.
  4. Wait for the image/video preview to appear in the composer.
  5. If a "Next" or "Done" button appears, click it.
Type the provided content into the post editor text area. If hashtags are provided, append them at the end with spaces.
Click the blue "Post" button to publish.
After posting, take a screenshot to verify. If the composer closed or you see the post in the feed, it succeeded.`,
        comment: `Navigate to the target URL. Scroll to find the comment section. Click the comment input area. Type the provided content. Press Enter or click Post to submit. Verify the comment appeared.`,
        like: `Navigate to the target URL. Find and click the "Like" button (thumbs up icon). Verify it shows as liked.`,
        follow: `Navigate to the target URL (user or company profile). Click "Follow" or "Connect". If connecting, add a note if content is provided. Verify the action completed.`,
        dm: `Navigate to linkedin.com/messaging. Click "Compose" or start a new message. Search for the recipient. Type the message content and send.`,
        search: `Navigate to linkedin.com. Use the search bar to search for the query. Extract relevant results including names, titles, companies, and connection status.`,
        scrape: `Navigate to the target URL. Extract all visible content including post text, engagement (reactions, comments, reposts), author info, and timestamps.`,
    },
    instagram: {
        post: `Navigate to instagram.com. Look for the Create/New Post button (+ icon in the sidebar or top navigation).
Click the Create/New Post button to open the post creation flow.
If media needs uploading:
  1. The first screen should prompt for photo/video selection. Click "Select from computer" or the upload area.
  2. Call upload_file with the media file path.
  3. Wait for the image/video to load in the preview.
  4. Click "Next" to proceed to filters/editing. Click "Next" again to reach the caption screen.
Type the caption with the provided content. If hashtags are provided, append them at the end.
Click "Share" to publish the post.
Take a screenshot to verify the post was published successfully.`,
        comment: `Navigate to the target URL. Find the comment input field. Type the provided content. Press Enter or click Post to submit.`,
        like: `Navigate to the target URL. Find and click the heart/like button on the post. Verify it turned red.`,
        follow: `Navigate to the target URL (user profile). Click the "Follow" button. Verify it changed to "Following".`,
        dm: `Navigate to instagram.com/direct/inbox. Start a new message. Search for the recipient. Type and send the message.`,
        search: `Navigate to instagram.com. Use the search/explore feature. Search for the query. Extract relevant profiles and posts.`,
        scrape: `Navigate to the target URL. Extract visible content including post images/descriptions, likes, comments, and author info.`,
    },
    facebook: {
        post: `Navigate to facebook.com. Find the "What's on your mind?" composer area and click on it to open the post creation dialog.
If media needs uploading:
  1. In the composer dialog, look for the "Photo/video" option (green camera/photo icon) — it may be in the toolbar at the bottom of the composer or as a button inside the dialog.
  2. Click the "Photo/video" button to open the file picker.
  3. Call upload_file with the media file path.
  4. Wait for the upload preview (image thumbnail or video) to appear inside the composer.
  5. If a "Next" or "Done" button appears after uploading, click it to proceed back to the text composer.
Now type the post content into the "What's on your mind?" text area. If hashtags are provided, append them at the end.
Click the blue "Post" button at the bottom of the composer dialog to publish.
IMPORTANT: After clicking "Post", wait 3-5 seconds. Take a screenshot to verify the post was published. If you see the post in the feed, the composer has closed, or you see a success notification, the post is DONE. Do NOT attempt to post again.`,
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
        if (ctx.trinityContext) {
            prompt += `\nMARKET INTELLIGENCE (use this to inform your content — reference real products, services, and differentiators):\n${ctx.trinityContext}\n`;
        }
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
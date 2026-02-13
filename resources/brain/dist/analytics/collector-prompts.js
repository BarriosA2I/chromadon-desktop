"use strict";
/**
 * Social Media Analytics - Platform Collection Prompts
 *
 * Generates prompts that tell the orchestrator how to navigate to each
 * platform's analytics page and extract metrics.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedPlatforms = exports.getCollectionPrompt = void 0;
const PLATFORM_PROMPTS = {
    twitter: {
        navigation: `Navigate to https://analytics.twitter.com or https://x.com/BarriosA2I (our Twitter profile).
If analytics page isn't accessible, go to our profile page instead.`,
        extraction: `Extract the following Twitter/X metrics from the current page:
1. Follower count (exact number)
2. Following count
3. Number of tweets/posts visible
4. For the most recent 5 tweets visible, extract:
   - Tweet text content (first 200 chars)
   - Like count
   - Reply/comment count
   - Retweet/repost count
   - View/impression count if visible
   - Bookmark/save count if visible

Format your response as JSON:
{
  "followers": number,
  "following": number,
  "posts": [
    {
      "content": "tweet text...",
      "likes": number,
      "comments": number,
      "shares": number,
      "impressions": number,
      "saves": number,
      "published_at": "ISO date if visible"
    }
  ]
}`,
    },
    linkedin: {
        navigation: `Navigate to https://www.linkedin.com/company/barriosa2i/ or our LinkedIn company page.
If you can access the analytics tab, navigate there.`,
        extraction: `Extract the following LinkedIn metrics from the current page:
1. Follower count
2. Connection count (if personal) or Page followers (if company)
3. For recent posts visible, extract:
   - Post text content (first 200 chars)
   - Like/reaction count
   - Comment count
   - Share/repost count
   - Impression count if visible

Format your response as JSON:
{
  "followers": number,
  "following": number,
  "posts": [
    {
      "content": "post text...",
      "likes": number,
      "comments": number,
      "shares": number,
      "impressions": number,
      "published_at": "ISO date if visible"
    }
  ]
}`,
    },
    instagram: {
        navigation: `Navigate to https://www.instagram.com/barriosa2i/ or our Instagram profile page.`,
        extraction: `Extract the following Instagram metrics from the current page:
1. Follower count
2. Following count
3. Total post count
4. For the most recent posts visible, extract:
   - Post caption (first 200 chars)
   - Like count
   - Comment count
   - Post type (image, video, carousel, reel)

Format your response as JSON:
{
  "followers": number,
  "following": number,
  "total_posts": number,
  "posts": [
    {
      "content": "caption...",
      "likes": number,
      "comments": number,
      "shares": 0,
      "post_type": "image|video|carousel|reel",
      "published_at": "ISO date if visible"
    }
  ]
}`,
    },
    facebook: {
        navigation: `Navigate to https://www.facebook.com/barriosa2i or our Facebook page.
If you can access Page Insights, navigate there.`,
        extraction: `Extract the following Facebook metrics from the current page:
1. Page likes/followers count
2. For recent posts visible, extract:
   - Post text content (first 200 chars)
   - Like/reaction count
   - Comment count
   - Share count

Format your response as JSON:
{
  "followers": number,
  "following": 0,
  "posts": [
    {
      "content": "post text...",
      "likes": number,
      "comments": number,
      "shares": number,
      "published_at": "ISO date if visible"
    }
  ]
}`,
    },
    youtube: {
        navigation: `Navigate to https://www.youtube.com/@barriosa2i or our YouTube channel page.
If you can access YouTube Studio analytics, go there.`,
        extraction: `Extract the following YouTube metrics from the current page:
1. Subscriber count
2. Total video count
3. For visible videos, extract:
   - Video title
   - View count
   - Like count (if visible)
   - Comment count (if visible)
   - Published date

Format your response as JSON:
{
  "followers": number,
  "following": 0,
  "posts": [
    {
      "content": "video title...",
      "likes": number,
      "comments": number,
      "shares": 0,
      "impressions": number,
      "post_type": "video",
      "published_at": "ISO date if visible"
    }
  ]
}`,
    },
};
function getCollectionPrompt(platform) {
    const prompts = PLATFORM_PROMPTS[platform];
    if (!prompts)
        return `Unknown platform: ${platform}`;
    return `ANALYTICS COLLECTION TASK for ${platform.toUpperCase()}:

Step 1 - Navigate:
${prompts.navigation}

Step 2 - Extract Data:
${prompts.extraction}

IMPORTANT: Return ONLY the JSON data, no extra commentary. If you cannot access the page or find the data, return:
{"error": "reason why data couldn't be collected"}`;
}
exports.getCollectionPrompt = getCollectionPrompt;
function getSupportedPlatforms() {
    return Object.keys(PLATFORM_PROMPTS);
}
exports.getSupportedPlatforms = getSupportedPlatforms;
//# sourceMappingURL=collector-prompts.js.map
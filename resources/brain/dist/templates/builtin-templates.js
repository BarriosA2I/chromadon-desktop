"use strict";
/**
 * MISSION TEMPLATES — Built-in Template Library
 *
 * 10+ templates across social, ecommerce, content, research, monitoring.
 * Written to ~/.chromadon/templates/builtin.json on first startup (Fix #2).
 * After that, always loaded from file — allowing hot-updates without recompiling.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_TEMPLATES = void 0;
exports.BUILTIN_TEMPLATES = [
    // ═══════════════════════════════════════════════════
    // SOCIAL MEDIA
    // ═══════════════════════════════════════════════════
    {
        id: 'social-post-all',
        name: 'Post to All Platforms',
        category: 'social',
        icon: '📢',
        description: 'Post content to all connected social media platforms with platform-appropriate formatting.',
        prompt: 'Post the following content to all my connected social media platforms: {{postContent}}. Use platform-appropriate formatting for each. Verify each post was published successfully.',
        variables: [
            { name: 'postContent', label: 'What do you want to post?', type: 'text', required: true },
        ],
        estimatedDurationMinutes: 5,
        schedulable: true,
        suggestedSchedule: 'daily-9am',
        tags: ['social', 'post', 'cross-platform', 'publish'],
    },
    {
        id: 'social-engagement-check',
        name: 'Check Social Engagement',
        category: 'social',
        icon: '📊',
        description: 'Check engagement metrics (likes, comments, shares) on recent posts across all connected platforms.',
        prompt: 'Check engagement metrics (likes, comments, shares) on my most recent posts across all connected social platforms. Summarize the performance and highlight any posts that did particularly well or poorly.',
        variables: [],
        estimatedDurationMinutes: 3,
        schedulable: true,
        suggestedSchedule: 'daily-5pm',
        tags: ['social', 'analytics', 'engagement', 'metrics'],
    },
    {
        id: 'social-competitor-monitor',
        name: 'Monitor Competitor Activity',
        category: 'monitoring',
        icon: '🔍',
        description: 'Visit a competitor website and check their latest social media posts, website updates, and announcements.',
        prompt: 'Visit {{competitorUrl}} and check their latest social media posts, website updates, and any new products or announcements. Summarize findings with key takeaways for my business.',
        variables: [
            { name: 'competitorUrl', label: 'Competitor website URL', type: 'url', required: true },
        ],
        estimatedDurationMinutes: 5,
        schedulable: true,
        suggestedSchedule: 'weekly-monday',
        tags: ['competitor', 'monitor', 'research', 'intelligence'],
    },
    // ═══════════════════════════════════════════════════
    // E-COMMERCE
    // ═══════════════════════════════════════════════════
    {
        id: 'shopify-order-summary',
        name: 'Shopify Order Summary',
        category: 'ecommerce',
        icon: '🛍️',
        description: 'Log into Shopify admin and get a summary of recent orders, revenue, and any issues.',
        prompt: 'Log into my Shopify admin and provide a summary of orders from the last 24 hours: total orders, revenue, any pending/unfulfilled orders, and any issues that need attention.',
        variables: [],
        estimatedDurationMinutes: 3,
        schedulable: true,
        suggestedSchedule: 'daily-8am',
        tags: ['shopify', 'orders', 'ecommerce', 'revenue', 'daily'],
    },
    {
        id: 'shopify-inventory-check',
        name: 'Low Inventory Alert',
        category: 'ecommerce',
        icon: '📦',
        description: 'Check Shopify inventory and list products running low on stock.',
        prompt: 'Check my Shopify inventory and list any products with fewer than {{threshold}} units in stock. For each low-stock item, include the product name, current quantity, and a link to the product page.',
        variables: [
            { name: 'threshold', label: 'Low stock threshold', type: 'text', required: true, default: '10' },
        ],
        estimatedDurationMinutes: 3,
        schedulable: true,
        suggestedSchedule: 'daily-7am',
        tags: ['shopify', 'inventory', 'stock', 'alert', 'ecommerce'],
    },
    // ═══════════════════════════════════════════════════
    // CONTENT
    // ═══════════════════════════════════════════════════
    {
        id: 'content-blog-draft',
        name: 'Draft Blog Post',
        category: 'content',
        icon: '✍️',
        description: 'Generate a blog post about a topic using your brand voice and target audience.',
        prompt: 'Write a blog post about {{topic}} for my business. Use my brand voice and target audience from my client profile. The post should be approximately {{length}} words with an engaging title, introduction, body sections, and conclusion.',
        variables: [
            { name: 'topic', label: 'Blog topic', type: 'text', required: true },
            { name: 'length', label: 'Target word count', type: 'choice', required: true, choices: ['500', '1000', '1500', '2000'] },
        ],
        estimatedDurationMinutes: 2,
        schedulable: false,
        tags: ['content', 'blog', 'writing', 'draft'],
    },
    {
        id: 'content-newsletter',
        name: 'Weekly Newsletter Draft',
        category: 'content',
        icon: '📰',
        description: 'Draft a weekly newsletter with recent updates, promotions, and industry tips.',
        prompt: 'Draft a weekly newsletter for my business covering: recent updates from this week, any upcoming promotions or events, and a useful tip relevant to my industry. Use my brand voice and keep it under 500 words.',
        variables: [],
        estimatedDurationMinutes: 2,
        schedulable: true,
        suggestedSchedule: 'weekly-wednesday',
        tags: ['content', 'newsletter', 'email', 'weekly'],
    },
    // ═══════════════════════════════════════════════════
    // RESEARCH
    // ═══════════════════════════════════════════════════
    {
        id: 'research-industry-news',
        name: 'Industry News Roundup',
        category: 'research',
        icon: '📰',
        description: 'Search for the latest news and trends in your industry from the past week.',
        prompt: 'Search for the latest news and trends in the {{industry}} industry from the past week. Visit 3-5 relevant news sources and summarize the top 5 most relevant stories for my business. Include links where possible.',
        variables: [
            { name: 'industry', label: 'Your industry', type: 'text', required: true },
        ],
        estimatedDurationMinutes: 5,
        schedulable: true,
        suggestedSchedule: 'weekly-monday',
        tags: ['research', 'news', 'industry', 'trends', 'weekly'],
    },
    {
        id: 'research-seo-audit',
        name: 'Quick SEO Check',
        category: 'research',
        icon: '🔎',
        description: 'Visit a website and perform a basic SEO audit checking titles, meta, headings, and images.',
        prompt: 'Visit {{websiteUrl}} and perform a basic SEO audit. Check: page titles, meta descriptions, heading structure (H1/H2/H3), image alt tags, and overall page load impression. Report any issues found and suggest improvements.',
        variables: [
            { name: 'websiteUrl', label: 'Website to audit', type: 'url', required: true },
        ],
        estimatedDurationMinutes: 5,
        schedulable: true,
        suggestedSchedule: 'monthly-1st',
        tags: ['research', 'seo', 'audit', 'website', 'optimization'],
    },
    // ═══════════════════════════════════════════════════
    // MONITORING
    // ═══════════════════════════════════════════════════
    {
        id: 'monitor-website-health',
        name: 'Website Health Check',
        category: 'monitoring',
        icon: '🏥',
        description: 'Visit a website and verify it loads correctly with no visible errors.',
        prompt: 'Visit {{websiteUrl}} and verify: homepage loads correctly, navigation links work, contact information is visible, and there are no visible errors or broken elements. Take screenshots as proof of the check.',
        variables: [
            { name: 'websiteUrl', label: 'Website URL', type: 'url', required: true },
        ],
        estimatedDurationMinutes: 3,
        schedulable: true,
        suggestedSchedule: 'daily-6am',
        tags: ['monitor', 'website', 'health', 'uptime', 'daily'],
    },
];
//# sourceMappingURL=builtin-templates.js.map
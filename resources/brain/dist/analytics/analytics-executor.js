"use strict";
/**
 * Social Media Analytics - Tool Executor
 *
 * Routes analytics tool calls to the AnalyticsDatabase and returns
 * formatted text results for Claude's consumption.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnalyticsExecutor = void 0;
/**
 * Creates an executor function bound to an AnalyticsDatabase instance.
 */
function createAnalyticsExecutor(db) {
    return (toolName, input) => {
        try {
            switch (toolName) {
                case 'get_analytics_overview':
                    return formatOverview(db.getOverview(input.days || 30));
                case 'get_platform_analytics':
                    return formatPlatform(db.getPlatformAnalytics(input.platform, input.days || 30));
                case 'get_content_analytics':
                    return formatContent(db.getContentAnalytics(input.platform, input.days || 30, input.post_type));
                case 'get_audience_analytics':
                    return formatAudience(db.getAudienceHistory(input.platform, input.days || 30));
                case 'get_competitor_analytics':
                    return formatCompetitors(db.getCompetitorAnalytics(input.platform, input.competitor_id));
                case 'get_timing_heatmap':
                    return formatTiming(db.getTimingHeatmap(input.platform), input.platform);
                case 'get_roi_analytics':
                    return formatROI(db.getROIAnalytics(input.days || 30));
                case 'generate_analytics_report':
                    return generateReport(db, input);
                default:
                    return `Unknown analytics tool: ${toolName}`;
            }
        }
        catch (error) {
            return `Analytics error: ${error.message}`;
        }
    };
}
exports.createAnalyticsExecutor = createAnalyticsExecutor;
// ============================================================================
// FORMATTERS
// ============================================================================
function formatOverview(data) {
    const lines = [
        '# Analytics Overview',
        '',
        `**Total Followers:** ${data.totalFollowers.toLocaleString()} (${data.followerChange >= 0 ? '+' : ''}${data.followerChange.toLocaleString()} change)`,
        `**Total Posts:** ${data.totalPosts}`,
        `**Avg Engagement Rate:** ${(data.avgEngagement * 100).toFixed(2)}%`,
        `**Total Impressions:** ${data.totalImpressions.toLocaleString()}`,
    ];
    if (data.topPost) {
        lines.push('', '## Top Post');
        lines.push(`- **Platform:** ${data.topPost.platform}`);
        lines.push(`- **Content:** ${data.topPost.content.slice(0, 100)}${data.topPost.content.length > 100 ? '...' : ''}`);
        if (data.topPost.metrics) {
            lines.push(`- **Engagement:** ${(data.topPost.metrics.engagement_rate * 100).toFixed(2)}%`);
            lines.push(`- **Likes:** ${data.topPost.metrics.likes} | Comments: ${data.topPost.metrics.comments} | Shares: ${data.topPost.metrics.shares}`);
        }
    }
    if (data.platformBreakdown.length > 0) {
        lines.push('', '## Platform Breakdown');
        for (const p of data.platformBreakdown) {
            lines.push(`- **${p.platform}:** ${p.followers.toLocaleString()} followers, ${p.posts} posts, ${(p.engagement * 100).toFixed(2)}% engagement`);
        }
    }
    if (data.totalPosts === 0 && data.totalFollowers === 0) {
        lines.push('', '*No analytics data collected yet. Use the data collector to start gathering metrics.*');
    }
    return lines.join('\n');
}
function formatPlatform(data) {
    const lines = [
        `# ${data.platform.charAt(0).toUpperCase() + data.platform.slice(1)} Analytics`,
        '',
        `**Followers:** ${data.followers.toLocaleString()}`,
        `**Following:** ${data.following.toLocaleString()}`,
        `**Growth Rate:** ${(data.growthRate * 100).toFixed(2)}%`,
        `**Total Posts:** ${data.posts.length}`,
    ];
    if (data.topPosts.length > 0) {
        lines.push('', '## Top Posts (by engagement)');
        for (const post of data.topPosts.slice(0, 3)) {
            lines.push(`- ${post.content.slice(0, 80)}... (${(post.metrics?.engagement_rate || 0 * 100).toFixed(2)}% engagement, ${post.metrics?.likes || 0} likes)`);
        }
    }
    if (data.worstPosts.length > 0) {
        lines.push('', '## Worst Performing');
        for (const post of data.worstPosts.slice(0, 3)) {
            lines.push(`- ${post.content.slice(0, 80)}... (${(post.metrics?.engagement_rate || 0 * 100).toFixed(2)}% engagement)`);
        }
    }
    if (data.posts.length === 0) {
        lines.push('', `*No ${data.platform} data collected yet.*`);
    }
    return lines.join('\n');
}
function formatContent(data) {
    const lines = [
        '# Content Analytics',
        '',
        `**Total Posts Analyzed:** ${data.totalPosts}`,
    ];
    if (data.postTypeBreakdown.length > 0) {
        lines.push('', '## Post Type Performance');
        for (const t of data.postTypeBreakdown) {
            lines.push(`- **${t.type}:** ${t.count} posts, ${(t.avgEngagement * 100).toFixed(2)}% avg engagement`);
        }
    }
    if (data.hashtagPerformance.length > 0) {
        lines.push('', '## Top Hashtags');
        for (const h of data.hashtagPerformance.slice(0, 10)) {
            lines.push(`- **${h.hashtag}:** ${h.uses} uses, ${(h.avgEngagement * 100).toFixed(2)}% avg engagement`);
        }
    }
    if (data.topPosts.length > 0) {
        lines.push('', '## Top Content');
        for (const post of data.topPosts.slice(0, 5)) {
            lines.push(`- [${post.platform}] ${post.content.slice(0, 60)}... (${post.metrics?.likes || 0} likes, ${(post.metrics?.engagement_rate || 0 * 100).toFixed(2)}%)`);
        }
    }
    if (data.totalPosts === 0) {
        lines.push('', '*No content data collected yet.*');
    }
    return lines.join('\n');
}
function formatAudience(data) {
    const lines = ['# Audience Analytics', ''];
    if (data.current) {
        lines.push(`**Current Followers:** ${data.current.followers.toLocaleString()}`);
        lines.push(`**Following:** ${data.current.following.toLocaleString()}`);
        lines.push(`**Profile Views:** ${data.current.profile_views.toLocaleString()}`);
        lines.push(`**Growth Rate:** ${(data.current.growth_rate * 100).toFixed(2)}%`);
        try {
            const demographics = JSON.parse(data.current.demographics);
            if (Object.keys(demographics).length > 0) {
                lines.push('', '## Demographics');
                for (const [key, value] of Object.entries(demographics)) {
                    lines.push(`- **${key}:** ${value}`);
                }
            }
        }
        catch { /* skip */ }
        try {
            const hours = JSON.parse(data.current.active_hours);
            if (Object.keys(hours).length > 0) {
                lines.push('', '## Most Active Hours');
                for (const [hour, activity] of Object.entries(hours)) {
                    lines.push(`- **${hour}:00:** ${activity}`);
                }
            }
        }
        catch { /* skip */ }
    }
    if (data.growthTrend.length > 0) {
        lines.push('', '## Growth Trend');
        const start = data.growthTrend[0];
        const end = data.growthTrend[data.growthTrend.length - 1];
        const change = end.followers - start.followers;
        lines.push(`- From ${start.followers.toLocaleString()} to ${end.followers.toLocaleString()} (${change >= 0 ? '+' : ''}${change.toLocaleString()})`);
        lines.push(`- Data points: ${data.growthTrend.length}`);
    }
    if (!data.current && data.history.length === 0) {
        lines.push('*No audience data collected yet.*');
    }
    return lines.join('\n');
}
function formatCompetitors(data) {
    const lines = ['# Competitor Analytics', ''];
    if (data.competitors.length === 0) {
        lines.push('*No competitors tracked yet. Add competitors through the data collector.*');
        return lines.join('\n');
    }
    lines.push(`**Tracked Competitors:** ${data.competitors.length}`);
    for (const comp of data.competitors) {
        lines.push('', `## ${comp.name} (@${comp.handle} on ${comp.platform})`);
        if (comp.recentPosts.length > 0) {
            lines.push(`- Recent posts: ${comp.recentPosts.length}`);
            const avgEng = comp.recentPosts.reduce((s, p) => s + p.engagement_rate, 0) / comp.recentPosts.length;
            lines.push(`- Avg engagement: ${(avgEng * 100).toFixed(2)}%`);
            const topPost = comp.recentPosts.sort((a, b) => b.engagement_rate - a.engagement_rate)[0];
            lines.push(`- Best post: "${topPost.content.slice(0, 60)}..." (${(topPost.engagement_rate * 100).toFixed(2)}%)`);
        }
        else {
            lines.push('- No posts collected yet');
        }
    }
    return lines.join('\n');
}
function formatTiming(data, platform) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const lines = [
        `# ${platform.charAt(0).toUpperCase() + platform.slice(1)} Posting Schedule`,
        '',
    ];
    if (data.bestTimes.length > 0) {
        lines.push('## Best Times to Post');
        for (const t of data.bestTimes) {
            lines.push(`- **${dayNames[t.day]} ${t.hour}:00** - ${(t.engagement * 100).toFixed(2)}% engagement`);
        }
    }
    if (data.worstTimes.length > 0) {
        lines.push('', '## Worst Times to Post');
        for (const t of data.worstTimes) {
            lines.push(`- **${dayNames[t.day]} ${t.hour}:00** - ${(t.engagement * 100).toFixed(2)}% engagement`);
        }
    }
    // Simple ASCII heatmap
    lines.push('', '## Engagement Heatmap');
    lines.push('```');
    lines.push('     00 03 06 09 12 15 18 21');
    for (let day = 0; day < 7; day++) {
        const cells = [];
        for (let h = 0; h < 24; h += 3) {
            const val = data.heatmap[day][h];
            if (val === 0)
                cells.push('  .');
            else if (val < 0.02)
                cells.push('  -');
            else if (val < 0.05)
                cells.push('  +');
            else if (val < 0.1)
                cells.push('  #');
            else
                cells.push('  *');
        }
        lines.push(`${dayNames[day]}${cells.join('')}`);
    }
    lines.push('```');
    lines.push('Legend: . = no data, - = low, + = medium, # = high, * = peak');
    if (data.bestTimes.length === 0) {
        lines.push('', '*Not enough posting data to generate timing insights.*');
    }
    return lines.join('\n');
}
function formatROI(data) {
    const lines = [
        '# ROI Analytics',
        '',
        `**Total Engagements:** ${data.totalEngagements.toLocaleString()}`,
    ];
    if (data.totalSpend > 0) {
        lines.push(`**Total Spend:** $${data.totalSpend.toFixed(2)}`);
        lines.push(`**Cost Per Engagement:** $${data.costPerEngagement.toFixed(4)}`);
        lines.push(`**Cost Per Follower:** $${data.costPerFollower.toFixed(4)}`);
    }
    else {
        lines.push('*No spend data tracked yet. ROI calculation requires ad spend input.*');
    }
    if (data.platformROI.length > 0) {
        lines.push('', '## Platform Engagement');
        for (const p of data.platformROI) {
            lines.push(`- **${p.platform}:** ${p.engagements.toLocaleString()} engagements`);
        }
    }
    if (data.totalEngagements === 0) {
        lines.push('', '*No engagement data collected yet.*');
    }
    return lines.join('\n');
}
// ============================================================================
// REPORT GENERATOR
// ============================================================================
function generateReport(db, input) {
    const days = input.days || 30;
    const format = input.format || 'markdown';
    const platforms = input.platforms;
    const overview = db.getOverview(days);
    if (format === 'json') {
        const report = { overview, period: `${days} days` };
        if (platforms) {
            report.platforms = {};
            for (const p of platforms) {
                report.platforms[p] = db.getPlatformAnalytics(p, days);
            }
        }
        return JSON.stringify(report, null, 2);
    }
    if (format === 'summary') {
        const lines = [
            `Analytics Summary (${days} days):`,
            `Followers: ${overview.totalFollowers.toLocaleString()} (${overview.followerChange >= 0 ? '+' : ''}${overview.followerChange})`,
            `Posts: ${overview.totalPosts}`,
            `Avg Engagement: ${(overview.avgEngagement * 100).toFixed(2)}%`,
            `Impressions: ${overview.totalImpressions.toLocaleString()}`,
        ];
        if (overview.topPost) {
            lines.push(`Top Post: "${overview.topPost.content.slice(0, 60)}..." on ${overview.topPost.platform}`);
        }
        return lines.join('\n');
    }
    // Markdown report (default)
    const sections = [
        `# Social Media Analytics Report`,
        `> Period: Last ${days} days | Generated: ${new Date().toISOString().split('T')[0]}`,
        '',
        formatOverview(overview),
    ];
    // Platform sections
    const platformList = platforms || overview.platformBreakdown.map(p => p.platform);
    for (const p of platformList) {
        sections.push('', '---', '', formatPlatform(db.getPlatformAnalytics(p, days)));
    }
    // Content analysis
    sections.push('', '---', '', formatContent(db.getContentAnalytics(undefined, days)));
    // Timing for each platform
    for (const p of platformList) {
        sections.push('', '---', '', formatTiming(db.getTimingHeatmap(p), p));
    }
    sections.push('', '---', '', '# Recommendations');
    sections.push('');
    // Auto-generate basic recommendations
    if (overview.totalPosts === 0) {
        sections.push('1. **Start collecting data** - No posts tracked yet. Run data collection to begin.');
    }
    else {
        if (overview.avgEngagement < 0.02) {
            sections.push('1. **Improve engagement** - Average engagement is below 2%. Experiment with different content types.');
        }
        if (overview.topPost?.metrics) {
            sections.push(`2. **Replicate success** - Your top post on ${overview.topPost.platform} had ${(overview.topPost.metrics.engagement_rate * 100).toFixed(1)}% engagement. Create similar content.`);
        }
        const content = db.getContentAnalytics(undefined, days);
        if (content.hashtagPerformance.length > 0) {
            const topTag = content.hashtagPerformance[0];
            sections.push(`3. **Use proven hashtags** - ${topTag.hashtag} performs best with ${(topTag.avgEngagement * 100).toFixed(1)}% engagement.`);
        }
    }
    return sections.join('\n');
}
//# sourceMappingURL=analytics-executor.js.map
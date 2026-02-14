"use strict";
/**
 * Marketing Queue - Tool Executor
 *
 * Routes marketing tool calls to the Desktop's queue API
 * and analytics database, returning formatted text for Claude's consumption.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMarketingExecutor = void 0;
// Platform formatting guidelines for repurpose_content
const PLATFORM_GUIDELINES = {
    twitter: {
        charLimit: 280,
        hashtags: '2-3 max, placed at end',
        tone: 'Punchy, conversational, direct. Use hooks. Thread for long content.',
        tips: 'Use line breaks for readability. Emojis OK sparingly. Ask questions for engagement.',
    },
    linkedin: {
        charLimit: 3000,
        hashtags: '3-5, placed at end after spacing',
        tone: 'Professional but personable. Story-driven. Value-first.',
        tips: 'Start with a strong hook line. Use short paragraphs. Add a call-to-action. Personal stories perform best.',
    },
    instagram: {
        charLimit: 2200,
        hashtags: '15-25, in first comment or after line breaks',
        tone: 'Visual-first. Aspirational. Community-focused.',
        tips: 'Caption supports the visual. Use line breaks. End with CTA or question. Hashtags can go in first comment.',
    },
    facebook: {
        charLimit: 63206,
        hashtags: '1-2 max or none',
        tone: 'Conversational, shareable. Community-oriented.',
        tips: 'Questions and polls drive engagement. Native video gets priority. Keep it relatable.',
    },
    youtube: {
        charLimit: 5000,
        hashtags: '3-5 in description, first 3 appear above title',
        tone: 'Descriptive, keyword-rich. SEO-optimized.',
        tips: 'First 2 lines are critical (shown before "Show more"). Include links and timestamps.',
    },
    tiktok: {
        charLimit: 2200,
        hashtags: '3-5, trending + niche mix',
        tone: 'Casual, authentic, trend-aware. Gen Z friendly.',
        tips: 'Hook in first 3 seconds. Use trending sounds/effects references. Keep it raw and real.',
    },
};
/**
 * Creates an executor function that calls the Desktop control server's
 * queue endpoints and analytics DB to handle marketing tools.
 */
function createMarketingExecutor(desktopUrl, analyticsDb) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                // =================================================================
                // EXISTING TOOLS
                // =================================================================
                case 'schedule_post': {
                    const { platforms, content, action, scheduled_time, recurrence, priority, hashtags, target_url, media_urls, } = input;
                    const batchId = platforms.length > 1 ? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : undefined;
                    const results = [];
                    for (const platform of platforms) {
                        const resp = await fetch(`${desktopUrl}/queue/add`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                platform,
                                action: action || 'post',
                                content,
                                targetUrl: target_url,
                                priority: priority ?? 5,
                                scheduledTime: scheduled_time && scheduled_time !== 'null' ? scheduled_time : undefined,
                                recurrence: recurrence && recurrence !== 'none' ? { type: recurrence } : undefined,
                                batchId,
                                hashtags,
                                mediaUrls: media_urls,
                            }),
                        });
                        const data = await resp.json();
                        results.push({
                            platform,
                            taskId: data.task?.id || 'unknown',
                            status: data.task?.status || 'unknown',
                        });
                    }
                    const lines = [];
                    const mediaNote = media_urls?.length ? ` with ${media_urls.length} media file(s)` : '';
                    if (scheduled_time && scheduled_time !== 'null') {
                        lines.push(`Scheduled ${results.length} post(s) for ${scheduled_time}${mediaNote}:`);
                    }
                    else {
                        lines.push(`Added ${results.length} task(s) to queue for immediate execution${mediaNote}:`);
                    }
                    for (const r of results) {
                        lines.push(`  - ${r.platform}: task ${r.taskId} (${r.status})`);
                    }
                    if (batchId) {
                        lines.push(`Cross-post batch: ${batchId}`);
                    }
                    return lines.join('\n');
                }
                case 'get_scheduled_posts': {
                    const { status_filter, platform_filter } = input;
                    const resp = await fetch(`${desktopUrl}/queue`);
                    const data = await resp.json();
                    let tasks = data.queue || [];
                    if (status_filter && status_filter !== 'all') {
                        tasks = tasks.filter((t) => t.status === status_filter);
                    }
                    if (platform_filter) {
                        tasks = tasks.filter((t) => t.platform === platform_filter);
                    }
                    if (tasks.length === 0) {
                        const filterDesc = [status_filter && status_filter !== 'all' ? status_filter : '', platform_filter]
                            .filter(Boolean)
                            .join(' ');
                        return `No ${filterDesc} tasks in the marketing queue.`;
                    }
                    const stats = data.stats || {};
                    const lines = [
                        `Marketing Queue: ${tasks.length} task(s)`,
                        `Stats: ${stats.queued || 0} queued, ${stats.scheduled || 0} scheduled, ${stats.running || 0} running, ${stats.completed || 0} completed, ${stats.failed || 0} failed`,
                        '',
                    ];
                    for (const task of tasks) {
                        const scheduledInfo = task.scheduledTime
                            ? ` | Scheduled: ${task.scheduledTime}`
                            : '';
                        const batchInfo = task.batchId ? ` | Batch: ${task.batchId}` : '';
                        lines.push(`[${task.status.toUpperCase()}] ${task.platform} ${task.action} (ID: ${task.id})${scheduledInfo}${batchInfo}`);
                        if (task.content) {
                            lines.push(`  Content: ${task.content.slice(0, 100)}${task.content.length > 100 ? '...' : ''}`);
                        }
                        if (task.error) {
                            lines.push(`  Error: ${task.error}`);
                        }
                    }
                    return lines.join('\n');
                }
                // =================================================================
                // NEW MARKETING AUTOMATION TOOLS (v1.4.0)
                // =================================================================
                case 'content_calendar': {
                    const days = input.days || 7;
                    const platform = input.platform;
                    const lines = ['CONTENT CALENDAR', ''];
                    // Upcoming scheduled posts from Desktop queue
                    try {
                        const resp = await fetch(`${desktopUrl}/queue`);
                        const data = await resp.json();
                        let scheduled = (data.queue || []).filter((t) => t.status === 'scheduled' || t.status === 'queued');
                        if (platform) {
                            scheduled = scheduled.filter((t) => t.platform === platform);
                        }
                        lines.push(`UPCOMING (${scheduled.length} scheduled):`);
                        if (scheduled.length === 0) {
                            lines.push('  No upcoming posts scheduled.');
                        }
                        else {
                            for (const task of scheduled.slice(0, 20)) {
                                const time = task.scheduledTime || 'Immediate';
                                const recur = task.recurrence?.type && task.recurrence.type !== 'none'
                                    ? ` [${task.recurrence.type}]` : '';
                                lines.push(`  ${time}${recur} | ${task.platform} | ${(task.content || '').slice(0, 60)}...`);
                            }
                        }
                    }
                    catch {
                        lines.push('UPCOMING: Unable to fetch queue (Desktop may be offline)');
                    }
                    // Recent completed posts from analytics DB
                    if (analyticsDb) {
                        lines.push('');
                        const overview = analyticsDb.getOverview(days);
                        lines.push(`RECENT (last ${days} days): ${overview.totalPosts} posts published`);
                        for (const pb of overview.platformBreakdown) {
                            if (!platform || pb.platform === platform) {
                                lines.push(`  ${pb.platform}: ${pb.posts} posts, ${(pb.engagement * 100).toFixed(1)}% avg engagement`);
                            }
                        }
                        if (overview.topPost) {
                            lines.push('');
                            lines.push(`TOP PERFORMER: ${overview.topPost.platform} — ${(overview.topPost.content || '').slice(0, 80)}...`);
                            if (overview.topPost.metrics) {
                                lines.push(`  Engagement: ${(overview.topPost.metrics.engagement_rate * 100).toFixed(1)}% | Likes: ${overview.topPost.metrics.likes} | Comments: ${overview.topPost.metrics.comments}`);
                            }
                        }
                    }
                    else {
                        lines.push('', 'RECENT: Analytics database not available.');
                    }
                    return lines.join('\n');
                }
                case 'repurpose_content': {
                    const { content, source_platform, target_platforms } = input;
                    const lines = [
                        `REPURPOSE CONTENT`,
                        `Original (${source_platform}): "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
                        '',
                    ];
                    for (const target of target_platforms) {
                        const guide = PLATFORM_GUIDELINES[target];
                        if (!guide) {
                            lines.push(`${target.toUpperCase()}: Unknown platform`);
                            continue;
                        }
                        lines.push(`--- ${target.toUpperCase()} ---`);
                        lines.push(`Character limit: ${guide.charLimit}`);
                        lines.push(`Hashtags: ${guide.hashtags}`);
                        lines.push(`Tone: ${guide.tone}`);
                        lines.push(`Tips: ${guide.tips}`);
                        lines.push('');
                    }
                    lines.push('ORIGINAL CONTENT FOR REFERENCE:');
                    lines.push(content);
                    lines.push('');
                    lines.push('Please rewrite the content above following each platform\'s guidelines.');
                    return lines.join('\n');
                }
                case 'hashtag_research': {
                    const { topic, platform } = input;
                    const lines = [`HASHTAG RESEARCH: "${topic}"`, ''];
                    // Analytics-based hashtag data
                    if (analyticsDb) {
                        const contentData = analyticsDb.getContentAnalytics(platform, 90);
                        if (contentData.hashtagPerformance.length > 0) {
                            lines.push('YOUR TOP PERFORMING HASHTAGS (last 90 days):');
                            for (const h of contentData.hashtagPerformance.slice(0, 15)) {
                                lines.push(`  ${h.hashtag} — ${h.uses} uses, ${(h.avgEngagement * 100).toFixed(1)}% avg engagement`);
                            }
                            lines.push('');
                        }
                    }
                    // Platform-specific guidelines
                    const guide = platform ? PLATFORM_GUIDELINES[platform] : null;
                    if (guide) {
                        lines.push(`${platform.toUpperCase()} HASHTAG BEST PRACTICES:`);
                        lines.push(`  Recommended count: ${guide.hashtags}`);
                        lines.push('');
                    }
                    lines.push('HASHTAG STRATEGY GUIDELINES:');
                    lines.push('  Mix ratio: 30% broad/trending + 40% niche + 30% branded');
                    lines.push('  Always include your branded hashtag');
                    lines.push('  Research competitor hashtags for gaps');
                    lines.push(`  Topic "${topic}" — suggest relevant hashtags based on the topic above`);
                    return lines.join('\n');
                }
                case 'engagement_report': {
                    const days = input.days || 30;
                    const platform = input.platform;
                    if (!analyticsDb) {
                        return 'Engagement report unavailable — analytics database not connected.';
                    }
                    const lines = [`ENGAGEMENT REPORT (last ${days} days)`, ''];
                    if (platform) {
                        const pd = analyticsDb.getPlatformAnalytics(platform, days);
                        lines.push(`Platform: ${platform}`);
                        lines.push(`Followers: ${pd.followers} | Growth: ${(pd.growthRate * 100).toFixed(1)}%`);
                        lines.push(`Total posts: ${pd.posts.length}`);
                        lines.push('');
                        if (pd.topPosts.length > 0) {
                            lines.push('TOP 5 POSTS BY ENGAGEMENT:');
                            for (const p of pd.topPosts.slice(0, 5)) {
                                if (p.metrics) {
                                    lines.push(`  ${(p.metrics.engagement_rate * 100).toFixed(1)}% | L:${p.metrics.likes} C:${p.metrics.comments} S:${p.metrics.shares} | "${(p.content || '').slice(0, 50)}..."`);
                                }
                            }
                            lines.push('');
                        }
                        if (pd.worstPosts.length > 0) {
                            lines.push('LOWEST 5 POSTS:');
                            for (const p of pd.worstPosts.slice(0, 5)) {
                                if (p.metrics) {
                                    lines.push(`  ${(p.metrics.engagement_rate * 100).toFixed(1)}% | L:${p.metrics.likes} C:${p.metrics.comments} S:${p.metrics.shares} | "${(p.content || '').slice(0, 50)}..."`);
                                }
                            }
                        }
                    }
                    else {
                        const overview = analyticsDb.getOverview(days);
                        lines.push(`Total followers: ${overview.totalFollowers} (${overview.followerChange >= 0 ? '+' : ''}${overview.followerChange})`);
                        lines.push(`Total posts: ${overview.totalPosts}`);
                        lines.push(`Avg engagement: ${(overview.avgEngagement * 100).toFixed(1)}%`);
                        lines.push(`Total impressions: ${overview.totalImpressions.toLocaleString()}`);
                        lines.push('');
                        lines.push('PLATFORM BREAKDOWN:');
                        for (const pb of overview.platformBreakdown) {
                            lines.push(`  ${pb.platform}: ${pb.followers} followers, ${pb.posts} posts, ${(pb.engagement * 100).toFixed(1)}% engagement`);
                        }
                        if (overview.topPost?.metrics) {
                            lines.push('');
                            lines.push(`TOP POST: ${overview.topPost.platform} — ${(overview.topPost.metrics.engagement_rate * 100).toFixed(1)}% engagement`);
                            lines.push(`  "${(overview.topPost.content || '').slice(0, 80)}..."`);
                        }
                    }
                    return lines.join('\n');
                }
                case 'competitor_watch': {
                    const { action, name, platform, handle, competitor_id } = input;
                    if (!analyticsDb) {
                        return 'Competitor tracking unavailable — analytics database not connected.';
                    }
                    switch (action) {
                        case 'add': {
                            if (!name || !platform || !handle) {
                                return 'Error: name, platform, and handle are required to add a competitor.';
                            }
                            const id = analyticsDb.insertCompetitor({
                                name,
                                platform,
                                handle,
                                profile_url: '',
                                is_active: 1,
                            });
                            return `Added competitor: ${name} (@${handle}) on ${platform} (ID: ${id})`;
                        }
                        case 'remove': {
                            if (!competitor_id)
                                return 'Error: competitor_id is required to remove.';
                            analyticsDb.deactivateCompetitor(competitor_id);
                            return `Deactivated competitor ID ${competitor_id}.`;
                        }
                        case 'list':
                        case 'compare': {
                            const data = analyticsDb.getCompetitorAnalytics(platform);
                            if (data.competitors.length === 0) {
                                return 'No competitors being tracked. Use action "add" to start tracking.';
                            }
                            const lines = [`COMPETITORS (${data.competitors.length} tracked)`, ''];
                            for (const c of data.competitors) {
                                lines.push(`[ID:${c.id}] ${c.name} (@${c.handle}) — ${c.platform}`);
                                if (c.recentPosts.length > 0) {
                                    const avgEng = c.recentPosts.reduce((s, p) => s + p.engagement_rate, 0) / c.recentPosts.length;
                                    lines.push(`  ${c.recentPosts.length} recent posts, ${(avgEng * 100).toFixed(1)}% avg engagement`);
                                }
                            }
                            if (action === 'compare' && data.comparison.length > 0) {
                                lines.push('', 'COMPARISON:');
                                for (const c of data.comparison) {
                                    lines.push(`  ${c.name}: ${(c.avgEngagement * 100).toFixed(1)}% engagement, ${c.postFrequency} posts tracked`);
                                }
                            }
                            return lines.join('\n');
                        }
                        default:
                            return `Unknown competitor_watch action: ${action}. Use add, remove, list, or compare.`;
                    }
                }
                case 'auto_reply': {
                    const { action, platform, trigger_type, trigger_value, reply_template, rule_id } = input;
                    if (!analyticsDb) {
                        return 'Auto-reply rules unavailable — analytics database not connected.';
                    }
                    switch (action) {
                        case 'add': {
                            if (!platform || !reply_template) {
                                return 'Error: platform and reply_template are required.';
                            }
                            const id = analyticsDb.insertAutoReplyRule({
                                platform,
                                trigger_type: trigger_type || 'keyword',
                                trigger_value: trigger_value || '',
                                reply_template,
                                is_active: 1,
                            });
                            return `Auto-reply rule created (ID: ${id}): When ${trigger_type || 'keyword'} "${trigger_value || 'any'}" on ${platform}, reply with: "${reply_template.slice(0, 80)}..."`;
                        }
                        case 'remove': {
                            if (!rule_id)
                                return 'Error: rule_id is required to remove.';
                            analyticsDb.deleteAutoReplyRule(rule_id);
                            return `Deleted auto-reply rule ID ${rule_id}.`;
                        }
                        case 'list': {
                            const rules = analyticsDb.getAutoReplyRules(platform, true);
                            if (rules.length === 0) {
                                return 'No auto-reply rules configured. Use action "add" to create one.';
                            }
                            const lines = [`AUTO-REPLY RULES (${rules.length} active)`, ''];
                            for (const r of rules) {
                                lines.push(`[ID:${r.id}] ${r.platform} | Trigger: ${r.trigger_type} "${r.trigger_value}" | Used ${r.uses}x`);
                                lines.push(`  Reply: "${r.reply_template.slice(0, 80)}${r.reply_template.length > 80 ? '...' : ''}"`);
                            }
                            return lines.join('\n');
                        }
                        default:
                            return `Unknown auto_reply action: ${action}. Use add, remove, or list.`;
                    }
                }
                case 'lead_capture': {
                    const { action, name, platform, handle, interest, source, notes, lead_id, status, status_filter } = input;
                    if (!analyticsDb) {
                        return 'Lead capture unavailable — analytics database not connected.';
                    }
                    switch (action) {
                        case 'add': {
                            if (!name || !platform) {
                                return 'Error: name and platform are required to add a lead.';
                            }
                            const id = analyticsDb.insertLead({
                                name,
                                platform,
                                handle: handle || '',
                                interest: interest || '',
                                source: source || '',
                                notes: notes || '',
                                status: 'new',
                            });
                            return `Lead captured (ID: ${id}): ${name}${handle ? ` (@${handle})` : ''} on ${platform}${interest ? ` — interested in: ${interest}` : ''}`;
                        }
                        case 'update': {
                            if (!lead_id || !status) {
                                return 'Error: lead_id and status are required to update.';
                            }
                            analyticsDb.updateLeadStatus(lead_id, status, notes);
                            return `Lead ${lead_id} updated to status: ${status}${notes ? ` (notes: ${notes})` : ''}`;
                        }
                        case 'list': {
                            const leads = analyticsDb.getLeads(status_filter, platform);
                            if (leads.length === 0) {
                                return `No leads found${status_filter ? ` with status "${status_filter}"` : ''}${platform ? ` on ${platform}` : ''}. Use action "add" to capture leads.`;
                            }
                            const lines = [`LEADS (${leads.length})`, ''];
                            for (const l of leads) {
                                lines.push(`[ID:${l.id}] ${l.name}${l.handle ? ` (@${l.handle})` : ''} — ${l.platform} [${l.status.toUpperCase()}]`);
                                if (l.interest)
                                    lines.push(`  Interest: ${l.interest}`);
                                if (l.source)
                                    lines.push(`  Source: ${l.source}`);
                                if (l.notes)
                                    lines.push(`  Notes: ${l.notes}`);
                            }
                            return lines.join('\n');
                        }
                        default:
                            return `Unknown lead_capture action: ${action}. Use add, list, or update.`;
                    }
                }
                case 'campaign_tracker': {
                    const { action, name, description, platforms, campaign_id, post_id, start_date, end_date } = input;
                    if (!analyticsDb) {
                        return 'Campaign tracking unavailable — analytics database not connected.';
                    }
                    switch (action) {
                        case 'create': {
                            if (!name)
                                return 'Error: name is required to create a campaign.';
                            const id = analyticsDb.insertCampaign({
                                name,
                                description: description || '',
                                platforms: JSON.stringify(platforms || []),
                                start_date: start_date || null,
                                end_date: end_date || null,
                                status: 'active',
                            });
                            return `Campaign created (ID: ${id}): "${name}"${platforms?.length ? ` on ${platforms.join(', ')}` : ''}`;
                        }
                        case 'list': {
                            const campaigns = analyticsDb.getCampaigns();
                            if (campaigns.length === 0) {
                                return 'No campaigns found. Use action "create" to start one.';
                            }
                            const lines = [`CAMPAIGNS (${campaigns.length})`, ''];
                            for (const c of campaigns) {
                                const platList = (() => { try {
                                    return JSON.parse(c.platforms).join(', ');
                                }
                                catch {
                                    return c.platforms;
                                } })();
                                lines.push(`[ID:${c.id}] "${c.name}" [${c.status.toUpperCase()}]`);
                                if (c.description)
                                    lines.push(`  ${c.description}`);
                                if (platList)
                                    lines.push(`  Platforms: ${platList}`);
                                if (c.start_date || c.end_date)
                                    lines.push(`  Period: ${c.start_date || '?'} to ${c.end_date || 'ongoing'}`);
                            }
                            return lines.join('\n');
                        }
                        case 'add_post': {
                            if (!campaign_id || !post_id)
                                return 'Error: campaign_id and post_id are required.';
                            analyticsDb.linkPostToCampaign(campaign_id, post_id);
                            return `Post ${post_id} added to campaign ${campaign_id}.`;
                        }
                        case 'report': {
                            if (!campaign_id)
                                return 'Error: campaign_id is required for report.';
                            const result = analyticsDb.getCampaignWithPosts(campaign_id);
                            if (!result)
                                return `Campaign ${campaign_id} not found.`;
                            const { campaign, posts } = result;
                            const lines = [`CAMPAIGN REPORT: "${campaign.name}"`, ''];
                            lines.push(`Status: ${campaign.status}`);
                            if (campaign.description)
                                lines.push(`Description: ${campaign.description}`);
                            lines.push(`Posts: ${posts.length}`);
                            if (posts.length > 0) {
                                let totalLikes = 0, totalComments = 0, totalShares = 0, totalImpressions = 0;
                                let engRates = [];
                                lines.push('', 'POSTS:');
                                for (const p of posts) {
                                    lines.push(`  ${p.platform} — "${(p.content || '').slice(0, 50)}..."`);
                                    if (p.metrics) {
                                        totalLikes += p.metrics.likes;
                                        totalComments += p.metrics.comments;
                                        totalShares += p.metrics.shares;
                                        totalImpressions += p.metrics.impressions;
                                        engRates.push(p.metrics.engagement_rate);
                                        lines.push(`    L:${p.metrics.likes} C:${p.metrics.comments} S:${p.metrics.shares} | ${(p.metrics.engagement_rate * 100).toFixed(1)}%`);
                                    }
                                }
                                if (engRates.length > 0) {
                                    const avgEng = engRates.reduce((s, r) => s + r, 0) / engRates.length;
                                    lines.push('', 'TOTALS:');
                                    lines.push(`  Impressions: ${totalImpressions.toLocaleString()}`);
                                    lines.push(`  Likes: ${totalLikes} | Comments: ${totalComments} | Shares: ${totalShares}`);
                                    lines.push(`  Avg engagement: ${(avgEng * 100).toFixed(1)}%`);
                                }
                            }
                            return lines.join('\n');
                        }
                        default:
                            return `Unknown campaign_tracker action: ${action}. Use create, list, add_post, or report.`;
                    }
                }
                default:
                    return `Unknown marketing tool: ${toolName}`;
            }
        }
        catch (error) {
            return `Marketing tool error: ${error.message}`;
        }
    };
}
exports.createMarketingExecutor = createMarketingExecutor;
//# sourceMappingURL=marketing-executor.js.map
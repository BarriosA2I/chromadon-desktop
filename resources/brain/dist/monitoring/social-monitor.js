"use strict";
/**
 * Social Media Monitoring - Always-On Monitor
 *
 * Follows DataCollector pattern: uses orchestrator.chat() with a silent
 * CollectorWriter to run monitoring in the background without interfering
 * with the user's active chat session.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMonitor = void 0;
const monitor_prompts_1 = require("./monitor-prompts");
// ============================================================================
// COLLECTOR WRITER (captures orchestrator output silently)
// ============================================================================
class MonitorWriter {
    chunks = [];
    closed = false;
    writeEvent(event, data) {
        if (event === 'text_delta' && data.text) {
            this.chunks.push(data.text);
        }
    }
    close() {
        this.closed = true;
    }
    isClosed() {
        return this.closed;
    }
    getText() {
        return this.chunks.join('');
    }
}
// ============================================================================
// SOCIAL MONITOR
// ============================================================================
const DEFAULT_CONFIG = {
    enabled: false,
    intervalMinutes: 10,
    platforms: ['twitter', 'linkedin', 'youtube'],
    maxRepliesPerCycle: 5,
    idleThresholdMs: 2 * 60 * 1000, // 2 minutes
};
class SocialMonitor {
    orchestrator;
    contextFactory;
    db;
    desktopUrl;
    monitorInterval = null;
    isMonitoring = false;
    config;
    lastRunAt = null;
    totalReplies = 0;
    totalCycles = 0;
    constructor(orchestrator, contextFactory, db, desktopUrl, config) {
        this.orchestrator = orchestrator;
        this.contextFactory = contextFactory;
        this.db = db;
        this.desktopUrl = desktopUrl;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    start(intervalMs) {
        if (this.monitorInterval)
            return;
        const ms = intervalMs || this.config.intervalMinutes * 60 * 1000;
        this.config.enabled = true;
        console.log(`[SocialMonitor] Started (${(ms / 60000).toFixed(0)}min interval, platforms: ${this.config.platforms.join(', ')})`);
        this.monitorInterval = setInterval(() => this.runCycle(), ms);
        // Run first cycle after 30s delay (let things settle)
        setTimeout(() => this.runCycle(), 30000);
    }
    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.config.enabled = false;
        console.log('[SocialMonitor] Stopped');
    }
    configure(updates) {
        const wasEnabled = this.config.enabled;
        Object.assign(this.config, updates);
        // Restart interval if it changed while running
        if (wasEnabled && this.config.enabled && updates.intervalMinutes) {
            this.stop();
            this.start();
        }
    }
    getStatus() {
        const nextRunMs = this.monitorInterval && this.lastRunAt
            ? new Date(this.lastRunAt).getTime() + this.config.intervalMinutes * 60000
            : null;
        return {
            enabled: this.config.enabled,
            running: this.isMonitoring,
            lastRunAt: this.lastRunAt,
            nextRunAt: nextRunMs ? new Date(nextRunMs).toISOString() : null,
            config: { ...this.config },
            totalReplies: this.totalReplies,
            totalCycles: this.totalCycles,
        };
    }
    getConfig() {
        return { ...this.config };
    }
    // =========================================================================
    // MONITORING CYCLE
    // =========================================================================
    async runCycle() {
        if (this.isMonitoring) {
            console.log('[SocialMonitor] Already monitoring, skipping cycle');
            return;
        }
        // Check if user is idle
        const idle = await this.checkUserIdle();
        if (!idle) {
            console.log('[SocialMonitor] User is active, skipping cycle');
            return;
        }
        this.isMonitoring = true;
        this.totalCycles++;
        this.lastRunAt = new Date().toISOString();
        console.log(`[SocialMonitor] Cycle #${this.totalCycles} starting (${this.config.platforms.length} platforms)`);
        for (const platform of this.config.platforms) {
            try {
                // Re-check idle before each platform (abort if user became active)
                const stillIdle = await this.checkUserIdle();
                if (!stillIdle) {
                    console.log(`[SocialMonitor] User became active, aborting cycle at ${platform}`);
                    break;
                }
                await this.monitorPlatform(platform);
                // Rate limit: 10s between platforms
                await new Promise(r => setTimeout(r, 10000));
            }
            catch (error) {
                console.error(`[SocialMonitor] ${platform} monitoring failed:`, error.message);
            }
        }
        this.isMonitoring = false;
        console.log(`[SocialMonitor] Cycle #${this.totalCycles} complete (total replies: ${this.totalReplies})`);
    }
    async monitorPlatform(platform) {
        console.log(`[SocialMonitor] Checking ${platform}...`);
        // Get auto-reply rules for this platform
        let rulesText = 'No rules configured.';
        try {
            const rules = this.db.getAutoReplyRules(platform, true);
            if (rules.length > 0) {
                rulesText = rules.map(r => `- Trigger: ${r.trigger_type}${r.trigger_value ? ` "${r.trigger_value}"` : ''} → Reply: "${r.reply_template}"`).join('\n');
            }
        }
        catch { /* DB might not have the method yet */ }
        const prompt = (0, monitor_prompts_1.getMonitoringPrompt)(platform, rulesText);
        const writer = new MonitorWriter();
        try {
            const { context, pageContext } = await this.contextFactory();
            // Use undefined sessionId = fresh session (no interference with user chat)
            await this.orchestrator.chat(undefined, prompt, writer, context, pageContext);
            const responseText = writer.getText();
            this.parseAndLog(platform, responseText);
        }
        catch (error) {
            console.error(`[SocialMonitor] ${platform} orchestrator call failed:`, error.message);
        }
    }
    parseAndLog(platform, responseText) {
        // Try to extract JSON from response
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) {
            console.log(`[SocialMonitor] ${platform}: No structured response, raw text: ${responseText.slice(0, 200)}`);
            return;
        }
        try {
            const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            const actions = data.actions || [];
            let repliesThisPlatform = 0;
            for (const action of actions) {
                if (action.type === 'reply') {
                    repliesThisPlatform++;
                    this.totalReplies++;
                }
                // Log to database if available
                try {
                    this.db.insertMonitoringLog?.({
                        platform,
                        action_type: action.type,
                        comment_author: action.author || null,
                        comment_text: (action.comment || '').slice(0, 500),
                        reply_text: (action.reply || '').slice(0, 500),
                        rule_id: action.rule_id || null,
                    });
                }
                catch { /* monitoring_log table might not exist yet */ }
            }
            console.log(`[SocialMonitor] ${platform}: ${data.comments_found || 0} comments found, ${repliesThisPlatform} replies sent`);
        }
        catch {
            console.log(`[SocialMonitor] ${platform}: Could not parse response JSON`);
        }
    }
    // =========================================================================
    // IDLE DETECTION
    // =========================================================================
    async checkUserIdle() {
        try {
            const res = await fetch(`${this.desktopUrl}/monitoring/idle-status`, {
                signal: AbortSignal.timeout(2000),
            });
            const data = await res.json();
            // Idle if no activity for threshold AND not processing a chat message
            return data.idleMs >= this.config.idleThresholdMs && !data.isProcessing;
        }
        catch {
            // If Desktop is unreachable, assume not idle (don't monitor)
            return false;
        }
    }
    // =========================================================================
    // CLEANUP
    // =========================================================================
    destroy() {
        this.stop();
    }
}
exports.SocialMonitor = SocialMonitor;
//# sourceMappingURL=social-monitor.js.map
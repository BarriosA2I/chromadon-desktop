"use strict";
/**
 * Session Warmup — Platform Session Preflight Checks
 *
 * Periodically validates social platform sessions are alive.
 * Stubs actual CDP validation for now — wired when browser module exposes health check.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionWarmup = void 0;
const PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube'];
class SessionWarmup {
    missionRegistry;
    interval = null;
    checkIntervalMs;
    statuses = new Map();
    running = false;
    constructor(missionRegistry, checkIntervalMs = 6 * 60 * 60 * 1000) {
        this.missionRegistry = missionRegistry;
        this.checkIntervalMs = checkIntervalMs;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        // Initial check after 30s
        setTimeout(() => this.checkAll(), 30000);
        this.interval = setInterval(() => this.checkAll(), this.checkIntervalMs);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
    }
    async checkAll() {
        for (const platform of PLATFORMS) {
            try {
                await this.preflightCheck(platform);
            }
            catch (err) {
                this.statuses.set(platform, {
                    platform,
                    alive: false,
                    lastChecked: Date.now(),
                    error: err.message,
                });
            }
        }
    }
    async preflightCheck(platform) {
        // Create a warmup mission for tracking
        if (this.missionRegistry) {
            const missionId = this.missionRegistry.create('SESSION_WARMUP', {
                clientId: 'system',
                targetPlatform: platform,
            });
            // TODO: Wire CDP session validation from src/browser/
            // For now, mark as alive (stub)
            const status = {
                platform,
                alive: true,
                lastChecked: Date.now(),
            };
            this.statuses.set(platform, status);
            this.missionRegistry.updateStatus(missionId, 'COMPLETED');
            this.missionRegistry.updateResult(missionId, {
                success: true,
                outputSummary: `${platform} session preflight: alive (stub)`,
            });
            return status;
        }
        const status = {
            platform,
            alive: true,
            lastChecked: Date.now(),
        };
        this.statuses.set(platform, status);
        return status;
    }
    getStatuses() {
        const result = {};
        for (const [key, val] of this.statuses) {
            result[key] = val;
        }
        return result;
    }
}
exports.SessionWarmup = SessionWarmup;
//# sourceMappingURL=session-warmup.js.map
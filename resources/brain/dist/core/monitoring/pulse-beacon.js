"use strict";
/**
 * Pulse Beacon — Telemetry Heartbeat
 *
 * Periodically sends Brain health data to a remote endpoint (if configured).
 * In local mode (no PULSE_ENDPOINT), only logs to console.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PulseBeacon = void 0;
class PulseBeacon {
    missionRegistry;
    budgetMonitor;
    interval = null;
    endpoint;
    intervalMs;
    startTime;
    errorCount = 0;
    consecutiveFailures = 0;
    running = false;
    constructor(missionRegistry, budgetMonitor, intervalMs = 5 * 60 * 1000) {
        this.missionRegistry = missionRegistry;
        this.budgetMonitor = budgetMonitor;
        this.intervalMs = intervalMs;
        this.endpoint = process.env.PULSE_ENDPOINT || null;
        this.startTime = Date.now();
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        if (!this.endpoint) {
            console.log('[PulseBeacon] Local mode (no PULSE_ENDPOINT configured)');
        }
        else {
            console.log(`[PulseBeacon] Sending heartbeats to ${this.endpoint} every ${this.intervalMs / 1000}s`);
        }
        // Initial send after 5s delay
        setTimeout(() => this.send(), 5000);
        this.interval = setInterval(() => this.send(), this.intervalMs);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
    }
    recordError() {
        this.errorCount++;
    }
    getStatus() {
        return {
            running: this.running,
            endpoint: this.endpoint,
            failures: this.consecutiveFailures,
            errors: this.errorCount,
        };
    }
    buildPayload() {
        const mem = process.memoryUsage();
        const missionStats = this.missionRegistry?.getStats() || { total: 0, active: 0, completed: 0, failed: 0, cancelled: 0 };
        const cost24h = this.budgetMonitor
            ? this.budgetMonitor.getGlobalStats().totalCost
            : 0;
        return {
            timestamp: new Date().toISOString(),
            uptimeMs: Date.now() - this.startTime,
            memoryMb: {
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
                rss: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
            },
            missions: {
                total: missionStats.total,
                active: missionStats.active,
                completed: missionStats.completed,
                failed: missionStats.failed,
            },
            cost24h,
            errorCount: this.errorCount,
        };
    }
    async send() {
        const payload = this.buildPayload();
        if (!this.endpoint)
            return; // Local mode — skip remote send
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            this.consecutiveFailures = 0;
        }
        catch {
            this.consecutiveFailures++;
            if (this.consecutiveFailures <= 3) {
                console.log(`[PulseBeacon] Send failed (attempt ${this.consecutiveFailures}/3)`);
            }
            // Silently swallow after 3 warnings
        }
    }
}
exports.PulseBeacon = PulseBeacon;
//# sourceMappingURL=pulse-beacon.js.map
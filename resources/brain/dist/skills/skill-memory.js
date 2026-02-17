"use strict";
/**
 * CHROMADON Skill Memory Manager
 *
 * Reads/writes proven action sequences so the Brain gets faster on repeat visits.
 * Stores runtime skills in userData (writable), ships defaults in resources/brain/.
 *
 * v2.1: Drift detection, per-task stats, versioning, compact summary.
 *
 * @author Barrios A2I
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillMemory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('skills');
// ─── Constants ───
const MAX_RECENT_HISTORY = 10;
const MAX_DRIFT_RECORDS = 10;
const MAX_PREVIOUS_VERSIONS = 3;
// ─── Skill Memory Class ───
class SkillMemory {
    skillsPath;
    defaultsPath;
    cache = null;
    constructor(dataDir, defaultsPath) {
        this.skillsPath = path.join(dataDir, 'brain-skills.json');
        this.defaultsPath = defaultsPath;
        // Eagerly load on construction so getSkillsJson() is always ready
        this.cache = this.loadSkills();
        const stats = this.getStats();
        log.info(`[SkillMemory] Initialized (${stats.domains} domains, ${stats.totalTasks} tasks)`);
    }
    // ─── Core I/O ───
    loadSkills() {
        // Try runtime skills first
        if (fs.existsSync(this.skillsPath)) {
            try {
                return JSON.parse(fs.readFileSync(this.skillsPath, 'utf-8'));
            }
            catch (err) {
                log.error({ err: err }, '[SkillMemory] Corrupted skills file, falling back to defaults:');
            }
        }
        // Copy defaults to runtime location
        if (fs.existsSync(this.defaultsPath)) {
            try {
                const defaults = fs.readFileSync(this.defaultsPath, 'utf-8');
                fs.mkdirSync(path.dirname(this.skillsPath), { recursive: true });
                fs.writeFileSync(this.skillsPath, defaults);
                return JSON.parse(defaults);
            }
            catch (err) {
                log.error({ err: err }, '[SkillMemory] Failed to load defaults:');
            }
        }
        return { version: '2.1', skills: {}, globalRules: [] };
    }
    save() {
        if (!this.cache)
            return;
        try {
            fs.mkdirSync(path.dirname(this.skillsPath), { recursive: true });
            fs.writeFileSync(this.skillsPath, JSON.stringify(this.cache, null, 2));
        }
        catch (err) {
            log.error({ err: err }, '[SkillMemory] Failed to save skills:');
        }
    }
    // ─── Lookups ───
    getSkillsForDomain(domain) {
        const skills = this.cache || this.loadSkills();
        if (skills.skills[domain])
            return skills.skills[domain];
        const bare = domain.replace(/^www\./, '');
        if (skills.skills[bare])
            return skills.skills[bare];
        if (skills.skills[`www.${bare}`])
            return skills.skills[`www.${bare}`];
        return null;
    }
    findMatchingTask(domain, intent) {
        const site = this.getSkillsForDomain(domain);
        if (!site)
            return null;
        if (!intent) {
            // Return the first task
            const firstKey = Object.keys(site.tasks)[0];
            return firstKey ? { site, taskName: firstKey, task: site.tasks[firstKey] } : null;
        }
        const intentLower = intent.toLowerCase();
        const intentWords = intentLower.split(/\s+/).filter(w => w.length > 2);
        let bestMatch = null;
        for (const [taskName, task] of Object.entries(site.tasks)) {
            const haystack = `${taskName.replace(/_/g, ' ')} ${task.description}`.toLowerCase();
            const score = intentWords.filter(w => haystack.includes(w)).length;
            if (score >= 2 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { taskName, task, score };
            }
        }
        return bestMatch ? { site, taskName: bestMatch.taskName, task: bestMatch.task } : null;
    }
    // ─── Learning ───
    learnNewSkill(domain, taskName, steps, options) {
        if (!this.cache)
            this.cache = this.loadSkills();
        if (!this.cache.skills[domain]) {
            this.cache.skills[domain] = {
                domain,
                siteName: options?.siteName || domain,
                tasks: {},
                siteRules: options?.siteRules || [],
                knownSelectors: {},
            };
        }
        const site = this.cache.skills[domain];
        if (site.tasks[taskName]) {
            // Archive previous steps if they differ (version management)
            const existing = site.tasks[taskName];
            const stepsChanged = JSON.stringify(existing.steps) !== JSON.stringify(steps);
            if (stepsChanged && existing.steps.length > 0) {
                if (!existing.previousVersions)
                    existing.previousVersions = [];
                const currentRate = existing.stats?.successRate ??
                    (existing.successCount / Math.max(1, existing.successCount + existing.failCount));
                existing.previousVersions.unshift({
                    steps: existing.steps,
                    savedAt: new Date().toISOString(),
                    successRate: currentRate,
                    reason: 'updated_steps',
                });
                // Keep max 3 versions
                if (existing.previousVersions.length > MAX_PREVIOUS_VERSIONS) {
                    existing.previousVersions = existing.previousVersions.slice(0, MAX_PREVIOUS_VERSIONS);
                }
            }
            // Update existing
            existing.successCount++;
            existing.lastUsed = new Date().toISOString();
            existing.lastVerified = new Date().toISOString();
            existing.steps = steps;
            if (options?.rules)
                existing.rules = options.rules;
        }
        else {
            // Brand new skill
            site.tasks[taskName] = {
                description: options?.description || `Learned task: ${taskName}`,
                learned: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                lastVerified: new Date().toISOString(),
                successCount: 1,
                failCount: 0,
                steps,
                rules: options?.rules || [],
                clientNotes: options?.clientNotes,
            };
        }
        if (options?.siteRules) {
            for (const rule of options.siteRules) {
                if (!site.siteRules.includes(rule))
                    site.siteRules.push(rule);
            }
        }
        // Record execution stats
        this.recordExecution(domain, taskName, true, options?.durationMs);
        this.save();
        log.info(`[SkillMemory] Learned: ${domain} -> ${taskName} (${site.tasks[taskName].successCount} successes)`);
    }
    recordFailure(domain, taskName, failedStep, error, failedSelector) {
        if (!this.cache)
            this.cache = this.loadSkills();
        if (this.cache.skills[domain]?.tasks[taskName]) {
            this.cache.skills[domain].tasks[taskName].failCount++;
            // Record execution stats
            this.recordExecution(domain, taskName, false, undefined, failedStep, error);
            // Record drift if selector provided
            if (failedSelector) {
                this.recordSelectorDrift(domain, taskName, failedStep, failedSelector, error);
            }
            this.save();
            log.info(`[SkillMemory] Failure: ${domain} -> ${taskName} step ${failedStep}: ${error}`);
        }
    }
    addSelector(domain, elementType, selector) {
        if (!this.cache)
            this.cache = this.loadSkills();
        if (!this.cache.skills[domain]) {
            this.cache.skills[domain] = { domain, siteName: domain, tasks: {}, siteRules: [], knownSelectors: {} };
        }
        const selectors = this.cache.skills[domain].knownSelectors;
        if (!selectors[elementType])
            selectors[elementType] = [];
        if (!selectors[elementType].includes(selector)) {
            selectors[elementType].push(selector);
            this.save();
        }
    }
    addSiteRule(domain, rule) {
        if (!this.cache)
            this.cache = this.loadSkills();
        if (this.cache.skills[domain] && !this.cache.skills[domain].siteRules.includes(rule)) {
            this.cache.skills[domain].siteRules.push(rule);
            this.save();
        }
    }
    saveClientNotes(domain, taskName, notes) {
        if (!this.cache)
            this.cache = this.loadSkills();
        if (this.cache.skills[domain]?.tasks[taskName]) {
            this.cache.skills[domain].tasks[taskName].clientNotes = notes;
            this.save();
            log.info(`[SkillMemory] Client notes saved: ${domain} -> ${taskName}`);
        }
    }
    // ─── Execution Stats ───
    recordExecution(domain, taskName, success, durationMs, failedStep, error) {
        if (!this.cache)
            this.cache = this.loadSkills();
        const task = this.cache.skills[domain]?.tasks[taskName];
        if (!task)
            return;
        if (!task.stats) {
            task.stats = {
                totalAttempts: 0,
                totalSuccesses: 0,
                totalFailures: 0,
                lastAttempt: null,
                lastSuccess: null,
                lastFailure: null,
                averageDurationMs: 0,
                successRate: 0,
                recentHistory: [],
            };
        }
        const now = new Date().toISOString();
        const s = task.stats;
        s.totalAttempts++;
        s.lastAttempt = now;
        if (success) {
            s.totalSuccesses++;
            s.lastSuccess = now;
            if (durationMs !== undefined && durationMs > 0) {
                // Rolling average
                s.averageDurationMs = s.averageDurationMs > 0
                    ? Math.round((s.averageDurationMs + durationMs) / 2)
                    : durationMs;
            }
        }
        else {
            s.totalFailures++;
            s.lastFailure = now;
        }
        s.successRate = s.totalAttempts > 0
            ? Math.round((s.totalSuccesses / s.totalAttempts) * 1000) / 1000
            : 0;
        // FIFO recent history
        s.recentHistory.unshift({
            timestamp: now,
            success,
            durationMs,
            failedStep,
            error,
        });
        if (s.recentHistory.length > MAX_RECENT_HISTORY) {
            s.recentHistory = s.recentHistory.slice(0, MAX_RECENT_HISTORY);
        }
    }
    // ─── Drift Detection ───
    recordSelectorDrift(domain, _taskName, _step, failedSelector, error) {
        if (!this.cache)
            this.cache = this.loadSkills();
        const task = this.cache.skills[domain]?.tasks[_taskName];
        if (!task)
            return;
        if (!task.drift) {
            task.drift = {
                driftCount: 0,
                lastDriftAt: null,
                driftedSelectors: [],
                stabilityScore: 1.0,
            };
        }
        const d = task.drift;
        d.driftCount++;
        d.lastDriftAt = new Date().toISOString();
        // Add drift record (FIFO, max 10)
        d.driftedSelectors.unshift({
            selector: failedSelector,
            failedAt: new Date().toISOString(),
            error,
        });
        if (d.driftedSelectors.length > MAX_DRIFT_RECORDS) {
            d.driftedSelectors = d.driftedSelectors.slice(0, MAX_DRIFT_RECORDS);
        }
        // Recompute stability score
        d.stabilityScore = this.computeStabilityScore(task);
    }
    resolveSelectorDrift(domain, taskName, failedSelector, newSelector) {
        if (!this.cache)
            this.cache = this.loadSkills();
        const task = this.cache.skills[domain]?.tasks[taskName];
        if (!task?.drift)
            return;
        const record = task.drift.driftedSelectors.find(r => r.selector === failedSelector && !r.resolvedAt);
        if (record) {
            record.replacedBy = newSelector;
            record.resolvedAt = new Date().toISOString();
            task.drift.stabilityScore = this.computeStabilityScore(task);
            this.save();
            log.info(`[SkillMemory] Drift resolved: ${failedSelector} → ${newSelector}`);
        }
    }
    computeStabilityScore(task) {
        if (!task.drift || !task.stats || task.stats.totalAttempts === 0)
            return 1.0;
        // Score = 1 - (unresolved drift events / total attempts), clamped to [0, 1]
        const unresolvedCount = task.drift.driftedSelectors.filter(d => !d.resolvedAt).length;
        const score = 1 - (unresolvedCount / Math.max(1, task.stats.totalAttempts));
        return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
    }
    getDriftedTasks() {
        const data = this.cache || this.loadSkills();
        const results = [];
        for (const [domainKey, site] of Object.entries(data.skills)) {
            for (const [taskName, task] of Object.entries(site.tasks)) {
                if (task.drift) {
                    const unresolved = task.drift.driftedSelectors.filter(d => !d.resolvedAt).length;
                    if (unresolved > 0) {
                        results.push({ domain: domainKey, taskName, drift: task.drift });
                    }
                }
            }
        }
        return results;
    }
    // ─── Reliability ───
    getReliabilityReport() {
        const data = this.cache || this.loadSkills();
        const results = [];
        for (const [domainKey, site] of Object.entries(data.skills)) {
            for (const [taskName, task] of Object.entries(site.tasks)) {
                const rate = task.stats?.successRate ??
                    (task.successCount / Math.max(1, task.successCount + task.failCount));
                results.push({
                    domain: domainKey,
                    taskName,
                    successRate: Math.round(rate * 1000) / 1000,
                    totalAttempts: task.stats?.totalAttempts ?? (task.successCount + task.failCount),
                    lastAttempt: task.stats?.lastAttempt ?? task.lastUsed,
                });
            }
        }
        return results.sort((a, b) => a.successRate - b.successRate);
    }
    getTaskStats(domain, taskName) {
        const task = this.cache?.skills[domain]?.tasks[taskName];
        return task?.stats || null;
    }
    // ─── Rollback ───
    rollbackSkill(domain, taskName) {
        if (!this.cache)
            this.cache = this.loadSkills();
        const task = this.cache.skills[domain]?.tasks[taskName];
        if (!task?.previousVersions?.length)
            return false;
        const previousVersion = task.previousVersions.shift();
        task.steps = previousVersion.steps;
        task.lastUsed = new Date().toISOString();
        this.save();
        log.info(`[SkillMemory] Rolled back: ${domain} -> ${taskName} to version from ${previousVersion.savedAt}`);
        return true;
    }
    // ─── Prompt Injection ───
    getSkillsJson() {
        return JSON.stringify(this.cache || this.loadSkills(), null, 2);
    }
    /** Compact summary for system prompt — no step details, just task names + stats */
    getSkillsSummary() {
        const data = this.cache || this.loadSkills();
        const summary = {
            version: data.version,
            domains: {},
            globalRules: data.globalRules,
        };
        for (const [domainKey, site] of Object.entries(data.skills)) {
            const tasks = {};
            for (const [taskName, task] of Object.entries(site.tasks)) {
                const rate = task.stats?.successRate ??
                    (task.successCount / Math.max(1, task.successCount + task.failCount));
                const unresolvedDrift = task.drift?.driftedSelectors.filter(d => !d.resolvedAt).length ?? 0;
                tasks[taskName] = {
                    description: task.description,
                    stepCount: task.steps.length,
                    successRate: Math.round(rate * 100) / 100,
                    lastVerified: task.lastVerified || task.lastUsed,
                    hasDrift: unresolvedDrift > 0,
                };
            }
            summary.domains[domainKey] = {
                siteName: site.siteName,
                tasks,
                siteRules: site.siteRules,
            };
        }
        return JSON.stringify(summary, null, 2);
    }
    // ─── Stats ───
    getStats() {
        const data = this.cache || this.loadSkills();
        let totalTasks = 0, totalSuccesses = 0, totalFailures = 0;
        for (const site of Object.values(data.skills)) {
            for (const task of Object.values(site.tasks)) {
                totalTasks++;
                totalSuccesses += task.successCount;
                totalFailures += task.failCount;
            }
        }
        return { domains: Object.keys(data.skills).length, totalTasks, totalSuccesses, totalFailures };
    }
}
exports.SkillMemory = SkillMemory;
//# sourceMappingURL=skill-memory.js.map
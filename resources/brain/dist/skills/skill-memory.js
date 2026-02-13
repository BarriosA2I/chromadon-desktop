"use strict";
/**
 * CHROMADON Skill Memory Manager
 *
 * Reads/writes proven action sequences so the Brain gets faster on repeat visits.
 * Stores runtime skills in userData (writable), ships defaults in resources/brain/.
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
        console.log(`[SkillMemory] Initialized (${stats.domains} domains, ${stats.totalTasks} tasks)`);
    }
    // ─── Core I/O ───
    loadSkills() {
        // Try runtime skills first
        if (fs.existsSync(this.skillsPath)) {
            try {
                return JSON.parse(fs.readFileSync(this.skillsPath, 'utf-8'));
            }
            catch (err) {
                console.error('[SkillMemory] Corrupted skills file, falling back to defaults:', err);
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
                console.error('[SkillMemory] Failed to load defaults:', err);
            }
        }
        return { version: '2.0', skills: {}, globalRules: [] };
    }
    save() {
        if (!this.cache)
            return;
        try {
            fs.mkdirSync(path.dirname(this.skillsPath), { recursive: true });
            fs.writeFileSync(this.skillsPath, JSON.stringify(this.cache, null, 2));
        }
        catch (err) {
            console.error('[SkillMemory] Failed to save skills:', err);
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
            // Update existing
            site.tasks[taskName].successCount++;
            site.tasks[taskName].lastUsed = new Date().toISOString();
            site.tasks[taskName].steps = steps;
            if (options?.rules)
                site.tasks[taskName].rules = options.rules;
        }
        else {
            // Brand new skill
            site.tasks[taskName] = {
                description: options?.description || `Learned task: ${taskName}`,
                learned: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
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
        this.save();
        console.log(`[SkillMemory] Learned: ${domain} -> ${taskName} (${site.tasks[taskName].successCount} successes)`);
    }
    recordFailure(domain, taskName, failedStep, error) {
        if (!this.cache)
            this.cache = this.loadSkills();
        if (this.cache.skills[domain]?.tasks[taskName]) {
            this.cache.skills[domain].tasks[taskName].failCount++;
            this.save();
            console.log(`[SkillMemory] Failure: ${domain} -> ${taskName} step ${failedStep}: ${error}`);
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
            console.log(`[SkillMemory] Client notes saved: ${domain} -> ${taskName}`);
        }
    }
    // ─── Prompt Injection ───
    getSkillsJson() {
        return JSON.stringify(this.cache || this.loadSkills(), null, 2);
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
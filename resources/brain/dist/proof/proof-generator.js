"use strict";
/**
 * PROOF OF WORK — Evidence Generator (Fix #4: Retention)
 *
 * Generates proof packages for completed missions.
 * Screenshots stored at {dataDir}/proof/{missionId}/
 * 30-day / 1GB retention policy enforced on startup.
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
exports.ProofGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('proof');
const MAX_AGE_DAYS = 30;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024; // 1GB
class ProofGenerator {
    proofDir;
    desktopUrl;
    constructor(desktopUrl, dataDir) {
        const base = dataDir || process.env.CHROMADON_DATA_DIR || path.join(os.homedir(), '.chromadon');
        this.proofDir = path.join(base, 'proof');
        fs.mkdirSync(this.proofDir, { recursive: true });
        this.desktopUrl = desktopUrl || 'http://127.0.0.1:3002';
    }
    /**
     * Generate a proof package for a completed mission.
     * Collects activity entries, takes a screenshot, writes proof.json.
     */
    async generate(missionId, activityLog, summary, status = 'success') {
        const missionDir = path.join(this.proofDir, missionId);
        fs.mkdirSync(missionDir, { recursive: true });
        // 1. Collect activity entries for this mission
        const activities = activityLog.getByMissionId(missionId);
        // 2. Take a final screenshot
        const screenshots = [];
        try {
            const screenshotPath = path.join(missionDir, `proof-${Date.now()}.png`);
            const response = await fetch(`${this.desktopUrl}/screenshot`);
            if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(screenshotPath, buffer);
                screenshots.push(screenshotPath);
            }
        }
        catch {
            // Screenshot is best-effort — don't fail proof generation
        }
        // 3. Extract platforms from activities
        const platforms = [...new Set(activities
                .filter(a => a.platform)
                .map(a => a.platform))];
        // 4. Calculate duration from first to last activity
        let durationMs;
        if (activities.length >= 2) {
            const first = new Date(activities[0].timestamp).getTime();
            const last = new Date(activities[activities.length - 1].timestamp).getTime();
            durationMs = last - first;
        }
        // 5. Build proof package
        const proof = {
            missionId,
            generatedAt: new Date().toISOString(),
            summary,
            activities,
            screenshots,
            durationMs,
            platforms,
            status,
        };
        // 6. Write proof.json
        fs.writeFileSync(path.join(missionDir, 'proof.json'), JSON.stringify(proof, null, 2), 'utf-8');
        return proof;
    }
    /**
     * Retrieve a proof package by mission ID.
     */
    get(missionId) {
        const proofFile = path.join(this.proofDir, missionId, 'proof.json');
        try {
            const data = fs.readFileSync(proofFile, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    /**
     * Fix #4: Retention policy — delete proof dirs >30 days, then enforce 1GB cap.
     * Called once on startup.
     */
    pruneOldProofs() {
        let deletedByAge = 0;
        let deletedBySize = 0;
        if (!fs.existsSync(this.proofDir))
            return { deletedByAge, deletedBySize };
        const entries = fs.readdirSync(this.proofDir, { withFileTypes: true })
            .filter(e => e.isDirectory());
        const now = Date.now();
        const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        // Phase 1: Delete dirs older than 30 days
        const remaining = [];
        for (const entry of entries) {
            const dirPath = path.join(this.proofDir, entry.name);
            try {
                const stat = fs.statSync(dirPath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                    deletedByAge++;
                }
                else {
                    // Calculate directory size
                    const size = this.getDirSize(dirPath);
                    remaining.push({ name: entry.name, mtimeMs: stat.mtimeMs, size });
                }
            }
            catch {
                // Skip inaccessible dirs
            }
        }
        // Phase 2: If total > 1GB, delete oldest first (FIFO)
        remaining.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first
        let totalSize = remaining.reduce((sum, r) => sum + r.size, 0);
        while (totalSize > MAX_TOTAL_BYTES && remaining.length > 0) {
            const oldest = remaining.shift();
            const dirPath = path.join(this.proofDir, oldest.name);
            try {
                fs.rmSync(dirPath, { recursive: true, force: true });
                totalSize -= oldest.size;
                deletedBySize++;
            }
            catch {
                // Skip
            }
        }
        if (deletedByAge > 0 || deletedBySize > 0) {
            log.info(`[ProofGenerator] Pruned ${deletedByAge} expired + ${deletedBySize} over-cap proof dirs. ` +
                `Remaining: ${remaining.length} dirs, ${(totalSize / (1024 * 1024)).toFixed(1)}MB`);
        }
        return { deletedByAge, deletedBySize };
    }
    /**
     * Get total size of a directory in bytes.
     */
    getDirSize(dirPath) {
        let total = 0;
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    total += stat.size;
                }
                else if (stat.isDirectory()) {
                    total += this.getDirSize(filePath);
                }
            }
        }
        catch {
            // Skip inaccessible
        }
        return total;
    }
}
exports.ProofGenerator = ProofGenerator;
//# sourceMappingURL=proof-generator.js.map
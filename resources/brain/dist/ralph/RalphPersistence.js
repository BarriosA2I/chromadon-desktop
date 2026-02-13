"use strict";
// @ts-nocheck
/**
 * RALPH Persistence Layer
 *
 * Manages filesystem state for crash recovery and cross-session persistence.
 * All state is stored in .ralph/ directory.
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
exports.RalphPersistence = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RalphPersistence {
    baseDir;
    missionId;
    constructor(baseDir = '.ralph', missionId) {
        this.missionId = missionId || `mission_${Date.now()}`;
        this.baseDir = path.join(baseDir, this.missionId);
    }
    /**
     * Initialize .ralph directory structure
     */
    async initialize() {
        const dirs = [
            this.baseDir,
            path.join(this.baseDir, 'iterations'),
            path.join(this.baseDir, 'checkpoints'),
            path.join(this.baseDir, 'memory'),
            path.join(this.baseDir, 'artifacts'),
            path.join(this.baseDir, 'artifacts', 'screenshots'),
            path.join(this.baseDir, 'intervention'),
            path.join(this.baseDir, 'costs'),
        ];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
    /**
     * Save current state
     */
    async saveState(state) {
        const statePath = path.join(this.baseDir, 'state.json');
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    }
    /**
     * Load current state (returns null if not exists)
     */
    async loadState() {
        const statePath = path.join(this.baseDir, 'state.json');
        if (!fs.existsSync(statePath)) {
            return null;
        }
        const content = fs.readFileSync(statePath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Save iteration record
     */
    async saveIteration(record) {
        const iterationPath = path.join(this.baseDir, 'iterations', `iteration-${String(record.iteration).padStart(3, '0')}.json`);
        fs.writeFileSync(iterationPath, JSON.stringify(record, null, 2));
    }
    /**
     * Load iteration record
     */
    async loadIteration(iteration) {
        const iterationPath = path.join(this.baseDir, 'iterations', `iteration-${String(iteration).padStart(3, '0')}.json`);
        if (!fs.existsSync(iterationPath)) {
            return null;
        }
        const content = fs.readFileSync(iterationPath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Get all iteration records
     */
    async loadAllIterations() {
        const iterationsDir = path.join(this.baseDir, 'iterations');
        if (!fs.existsSync(iterationsDir)) {
            return [];
        }
        const files = fs.readdirSync(iterationsDir)
            .filter(f => f.startsWith('iteration-') && f.endsWith('.json'))
            .sort();
        const records = [];
        for (const file of files) {
            const content = fs.readFileSync(path.join(iterationsDir, file), 'utf-8');
            records.push(JSON.parse(content));
        }
        return records;
    }
    /**
     * Save checkpoint
     */
    async saveCheckpoint(checkpoint) {
        const checkpointPath = path.join(this.baseDir, 'checkpoints', `checkpoint-${String(checkpoint.iteration).padStart(3, '0')}.json`);
        fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    }
    /**
     * Load latest checkpoint
     */
    async loadLatestCheckpoint() {
        const checkpointsDir = path.join(this.baseDir, 'checkpoints');
        if (!fs.existsSync(checkpointsDir)) {
            return null;
        }
        const files = fs.readdirSync(checkpointsDir)
            .filter(f => f.startsWith('checkpoint-') && f.endsWith('.json'))
            .sort()
            .reverse();
        if (files.length === 0) {
            return null;
        }
        const content = fs.readFileSync(path.join(checkpointsDir, files[0]), 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Save memory snapshot
     */
    async saveMemory(type, data) {
        const memoryPath = path.join(this.baseDir, 'memory', `${type}.json`);
        fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
    }
    /**
     * Load memory snapshot
     */
    async loadMemory(type) {
        const memoryPath = path.join(this.baseDir, 'memory', `${type}.json`);
        if (!fs.existsSync(memoryPath)) {
            return null;
        }
        const content = fs.readFileSync(memoryPath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Save intervention request
     */
    async saveInterventionRequest(request) {
        const requestPath = path.join(this.baseDir, 'intervention', 'request.json');
        fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
    }
    /**
     * Load intervention response
     */
    async loadInterventionResponse() {
        const responsePath = path.join(this.baseDir, 'intervention', 'response.json');
        if (!fs.existsSync(responsePath)) {
            return null;
        }
        const content = fs.readFileSync(responsePath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Clear intervention files
     */
    async clearIntervention() {
        const requestPath = path.join(this.baseDir, 'intervention', 'request.json');
        const responsePath = path.join(this.baseDir, 'intervention', 'response.json');
        if (fs.existsSync(requestPath))
            fs.unlinkSync(requestPath);
        if (fs.existsSync(responsePath))
            fs.unlinkSync(responsePath);
    }
    /**
     * Check for pause/abort signals
     */
    async checkSignals() {
        const pausePath = path.join(this.baseDir, 'PAUSE');
        const abortPath = path.join(this.baseDir, 'ABORT');
        return {
            pause: fs.existsSync(pausePath),
            abort: fs.existsSync(abortPath),
            reason: fs.existsSync(abortPath)
                ? fs.readFileSync(abortPath, 'utf-8').trim()
                : undefined,
        };
    }
    /**
     * Save screenshot artifact
     */
    async saveScreenshot(iteration, data) {
        const screenshotPath = path.join(this.baseDir, 'artifacts', 'screenshots', `iteration-${String(iteration).padStart(3, '0')}.png`);
        if (typeof data === 'string') {
            // Assume base64
            fs.writeFileSync(screenshotPath, Buffer.from(data, 'base64'));
        }
        else {
            fs.writeFileSync(screenshotPath, data);
        }
        return screenshotPath;
    }
    /**
     * Get mission ID
     */
    getMissionId() {
        return this.missionId;
    }
    /**
     * Get base directory
     */
    getBaseDir() {
        return this.baseDir;
    }
    /**
     * Check if mission exists (for resume)
     */
    static exists(baseDir, missionId) {
        const missionDir = path.join(baseDir, missionId);
        return fs.existsSync(path.join(missionDir, 'state.json'));
    }
    /**
     * List all missions
     */
    static listMissions(baseDir = '.ralph') {
        if (!fs.existsSync(baseDir)) {
            return [];
        }
        return fs.readdirSync(baseDir)
            .filter(f => {
            const statePath = path.join(baseDir, f, 'state.json');
            return fs.existsSync(statePath);
        });
    }
}
exports.RalphPersistence = RalphPersistence;

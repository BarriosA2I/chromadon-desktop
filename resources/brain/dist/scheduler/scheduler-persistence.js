"use strict";
/**
 * THE_SCHEDULER — Atomic File Persistence
 *
 * Follows the RALPH pattern: synchronous atomic writes with backup file.
 * State file: ~/.chromadon/scheduler-state.json
 * Backup:     ~/.chromadon/scheduler-state.backup.json
 *
 * Crash recovery: any task in EXECUTING status on load → reset to PENDING.
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
exports.SchedulerPersistence = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const scheduler_types_1 = require("./scheduler-types");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('scheduler');
class SchedulerPersistence {
    stateFile;
    backupFile;
    tmpFile;
    constructor(baseDir) {
        const dir = baseDir || path.join(os.homedir(), '.chromadon');
        this.stateFile = path.join(dir, 'scheduler-state.json');
        this.backupFile = path.join(dir, 'scheduler-state.backup.json');
        this.tmpFile = path.join(dir, 'scheduler-state.tmp');
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    /**
     * Atomic write: write to .tmp, then rename over the main file.
     * Before overwriting, copy current state to backup.
     */
    saveState(state) {
        state.lastSavedAt = new Date().toISOString();
        const json = JSON.stringify(state, null, 2);
        // Backup current state before overwriting
        if (fs.existsSync(this.stateFile)) {
            try {
                fs.copyFileSync(this.stateFile, this.backupFile);
            }
            catch {
                // Non-critical — backup failure shouldn't block save
            }
        }
        // Atomic write: tmp → rename
        fs.writeFileSync(this.tmpFile, json);
        fs.renameSync(this.tmpFile, this.stateFile);
    }
    /**
     * Load state from disk. Falls back to backup if main file is corrupt.
     * Crash recovery: EXECUTING tasks → PENDING (were interrupted).
     */
    loadState() {
        let state = this.tryLoadFile(this.stateFile);
        if (!state) {
            log.info('[SchedulerPersistence] Main state corrupt/missing, trying backup...');
            state = this.tryLoadFile(this.backupFile);
        }
        if (!state)
            return null;
        // Crash recovery: interrupted tasks go back to PENDING
        let recovered = 0;
        for (const task of state.tasks) {
            if (task.status === scheduler_types_1.TaskStatus.EXECUTING) {
                task.status = scheduler_types_1.TaskStatus.PENDING;
                task.lastError = 'Recovered after crash/restart';
                recovered++;
            }
        }
        if (recovered > 0) {
            log.info(`[SchedulerPersistence] Crash recovery: ${recovered} task(s) reset to PENDING`);
            this.saveState(state);
        }
        return state;
    }
    tryLoadFile(filePath) {
        try {
            if (!fs.existsSync(filePath))
                return null;
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (!parsed.version || !Array.isArray(parsed.tasks))
                return null;
            return parsed;
        }
        catch (err) {
            log.error(`[SchedulerPersistence] Failed to load ${filePath}:`, err.message);
            return null;
        }
    }
}
exports.SchedulerPersistence = SchedulerPersistence;
//# sourceMappingURL=scheduler-persistence.js.map
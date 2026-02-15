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
import { SchedulerState } from './scheduler-types';
export declare class SchedulerPersistence {
    private readonly stateFile;
    private readonly backupFile;
    private readonly tmpFile;
    constructor(baseDir?: string);
    /**
     * Atomic write: write to .tmp, then rename over the main file.
     * Before overwriting, copy current state to backup.
     */
    saveState(state: SchedulerState): void;
    /**
     * Load state from disk. Falls back to backup if main file is corrupt.
     * Crash recovery: EXECUTING tasks → PENDING (were interrupted).
     */
    loadState(): SchedulerState | null;
    private tryLoadFile;
}
//# sourceMappingURL=scheduler-persistence.d.ts.map
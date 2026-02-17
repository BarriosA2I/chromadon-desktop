/**
 * Skill Memory Executor
 *
 * Async executor factory for skill memory tools.
 * v2.1: Enhanced with drift warnings, reliability info, drift report, stats, rollback.
 *
 * @author Barrios A2I
 */
import { SkillMemory } from './skill-memory';
export declare function createSkillExecutor(skillMemory: SkillMemory): (toolName: string, input: Record<string, any>) => Promise<string>;
//# sourceMappingURL=skill-executor.d.ts.map
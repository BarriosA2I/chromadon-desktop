/**
 * Skill Memory Executor
 *
 * Async executor factory for skill memory tools.
 * Follows the createYouTubeExecutor() / createAnalyticsExecutor() pattern.
 *
 * @author Barrios A2I
 */
import { SkillMemory } from './skill-memory';
export declare function createSkillExecutor(skillMemory: SkillMemory): (toolName: string, input: Record<string, any>) => Promise<string>;
//# sourceMappingURL=skill-executor.d.ts.map
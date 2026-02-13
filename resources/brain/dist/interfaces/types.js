"use strict";
/**
 * CHROMADON Core Types
 *
 * Neural RAG Brain Integration:
 * - Complexity enum for dual-process routing
 * - Reflection tokens for action verification
 * - CRAG actions for self-healing
 * - Memory tiers for context management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorSchema = exports.MissionSchema = exports.MemoryTier = exports.CircuitState = exports.CRAGAction = exports.Complexity = void 0;
const zod_1 = require("zod");
// =============================================================================
// NEURAL RAG BRAIN PATTERNS
// =============================================================================
/**
 * Complexity classification for dual-process routing.
 * System 1: Fast, intuitive (<500ms)
 * System 2: Deliberate, analytical (1-5s)
 */
var Complexity;
(function (Complexity) {
    Complexity["SIMPLE"] = "simple";
    Complexity["MODERATE"] = "moderate";
    Complexity["COMPLEX"] = "complex";
})(Complexity || (exports.Complexity = Complexity = {}));
/**
 * CRAG corrective action types for self-healing.
 */
var CRAGAction;
(function (CRAGAction) {
    CRAGAction["GENERATE"] = "generate";
    CRAGAction["DECOMPOSE"] = "decompose";
    CRAGAction["WEBSEARCH"] = "websearch";
})(CRAGAction || (exports.CRAGAction = CRAGAction = {}));
/**
 * Circuit breaker states for fault isolation.
 */
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
/**
 * Memory tiers for hierarchical context management.
 */
var MemoryTier;
(function (MemoryTier) {
    MemoryTier["WORKING"] = "L0_working";
    MemoryTier["EPISODIC"] = "L1_episodic";
    MemoryTier["SEMANTIC"] = "L2_semantic";
    MemoryTier["PROCEDURAL"] = "L3_procedural";
})(MemoryTier || (exports.MemoryTier = MemoryTier = {}));
// =============================================================================
// ZOD SCHEMAS FOR VALIDATION
// =============================================================================
exports.MissionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    description: zod_1.z.string().min(1),
    actions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        type: zod_1.z.enum(['navigate', 'click', 'fill', 'select', 'hover', 'scroll', 'screenshot', 'wait', 'conditional']),
    })).min(1),
    complexity: zod_1.z.nativeEnum(Complexity),
    timeout: zod_1.z.number().positive().optional(),
    checkpoints: zod_1.z.boolean().optional(),
});
exports.SelectorSchema = zod_1.z.object({
    value: zod_1.z.string().min(1),
    strategy: zod_1.z.enum(['css', 'xpath', 'text', 'aria', 'testid', 'visual']),
    confidence: zod_1.z.number().min(0).max(1),
});

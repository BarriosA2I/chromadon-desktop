"use strict";
/**
 * CHROMADON Interfaces
 *
 * Core abstractions for the Autonomous Browser Agent.
 * All interfaces implement Neural RAG Brain patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorSchema = exports.MissionSchema = exports.MemoryTier = exports.CircuitState = exports.CRAGAction = exports.Complexity = void 0;
// Core types and enums
var types_1 = require("./types");
// Enums
Object.defineProperty(exports, "Complexity", { enumerable: true, get: function () { return types_1.Complexity; } });
Object.defineProperty(exports, "CRAGAction", { enumerable: true, get: function () { return types_1.CRAGAction; } });
Object.defineProperty(exports, "CircuitState", { enumerable: true, get: function () { return types_1.CircuitState; } });
Object.defineProperty(exports, "MemoryTier", { enumerable: true, get: function () { return types_1.MemoryTier; } });
// Zod schemas
Object.defineProperty(exports, "MissionSchema", { enumerable: true, get: function () { return types_1.MissionSchema; } });
Object.defineProperty(exports, "SelectorSchema", { enumerable: true, get: function () { return types_1.SelectorSchema; } });
//# sourceMappingURL=index.js.map
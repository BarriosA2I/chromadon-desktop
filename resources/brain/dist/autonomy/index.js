"use strict";
/**
 * Autonomy Module — Tools for autonomous browser operation
 *
 * visual_verify: AI vision verification after critical browser actions
 * policy_check: Risk classification before consequential actions
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolicyExecutor = exports.POLICY_TOOL_NAMES = exports.POLICY_TOOLS = exports.createVisualVerifyExecutor = exports.VISUAL_VERIFY_TOOL_NAMES = exports.VISUAL_VERIFY_TOOLS = void 0;
var visual_verify_tools_1 = require("./visual-verify-tools");
Object.defineProperty(exports, "VISUAL_VERIFY_TOOLS", { enumerable: true, get: function () { return visual_verify_tools_1.VISUAL_VERIFY_TOOLS; } });
Object.defineProperty(exports, "VISUAL_VERIFY_TOOL_NAMES", { enumerable: true, get: function () { return visual_verify_tools_1.VISUAL_VERIFY_TOOL_NAMES; } });
var visual_verify_executor_1 = require("./visual-verify-executor");
Object.defineProperty(exports, "createVisualVerifyExecutor", { enumerable: true, get: function () { return visual_verify_executor_1.createVisualVerifyExecutor; } });
var policy_tools_1 = require("./policy-tools");
Object.defineProperty(exports, "POLICY_TOOLS", { enumerable: true, get: function () { return policy_tools_1.POLICY_TOOLS; } });
Object.defineProperty(exports, "POLICY_TOOL_NAMES", { enumerable: true, get: function () { return policy_tools_1.POLICY_TOOL_NAMES; } });
var policy_executor_1 = require("./policy-executor");
Object.defineProperty(exports, "createPolicyExecutor", { enumerable: true, get: function () { return policy_executor_1.createPolicyExecutor; } });
//# sourceMappingURL=index.js.map
"use strict";
/**
 * Policy Check Executor — Pure regex risk classification
 *
 * No LLM calls. No external dependencies. Runs in microseconds.
 * FORBIDDEN: irreversible account/financial actions
 * RISKY: publishing, payments, terms acceptance
 * SAFE: everything else
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolicyExecutor = void 0;
const FORBIDDEN_PATTERNS = [
    /delete\s*(my\s+)?account/i,
    /close\s*(my\s+)?account/i,
    /deactivate\s*(my\s+)?account/i,
    /cancel\s*(my\s+)?subscription/i,
    /remove\s*(all\s+)?payment/i,
    /wire\s*transfer/i,
    /bitcoin|crypto\s*payment/i,
    /confirm\s*purchase\s*.*\$[5-9]\d{2,}/i, // purchases $500+
    /confirm\s*purchase\s*.*\$\d{4,}/i, // purchases $1000+
    /permanently\s*delete/i,
    /erase\s*(all|my)\s*(data|history)/i,
    /factory\s*reset/i,
    /revoke\s*all\s*(access|permissions)/i,
];
const RISKY_PATTERNS = [
    /submit\s*(payment|order)/i,
    /enter\s*credit\s*card/i,
    /confirm\s*(order|purchase)/i,
    /post\s*(it\s+)?publicly/i,
    /publish/i,
    /send\s*email\s*to\s*all/i,
    /broadcast/i,
    /grant\s*(access|permission)/i,
    /accept\s*terms/i,
    /authorize/i,
    /download\s*.*\.(exe|msi|dmg|bat|sh|ps1)/i,
    /install\s*(software|program|app)/i,
    /change\s*password/i,
    /update\s*email/i,
    /modify\s*billing/i,
    /unsubscribe/i,
    /opt[\s-]*out/i,
];
function createPolicyExecutor() {
    return async (_toolName, input) => {
        const action = String(input.action || '');
        // Check forbidden first
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(action)) {
                return JSON.stringify({
                    level: 'FORBIDDEN',
                    reason: 'This action has irreversible real-world consequences. Ask the user for explicit confirmation before proceeding.',
                    action,
                });
            }
        }
        // Check risky
        for (const pattern of RISKY_PATTERNS) {
            if (pattern.test(action)) {
                return JSON.stringify({
                    level: 'RISKY',
                    reason: 'This action may have real-world consequences. Proceed with caution and call visual_verify afterward to confirm success.',
                    action,
                    recommendation: 'Call visual_verify after executing this action.',
                });
            }
        }
        return JSON.stringify({
            level: 'SAFE',
            action,
        });
    };
}
exports.createPolicyExecutor = createPolicyExecutor;
//# sourceMappingURL=policy-executor.js.map
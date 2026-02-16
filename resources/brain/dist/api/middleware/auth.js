"use strict";
/**
 * Brain Auth Token Middleware
 *
 * Validates X-Brain-Token header against BRAIN_AUTH_TOKEN env var.
 * If no token is configured (dev mode), all requests pass through.
 * Exempt paths: /health, /api/system/diagnostics
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.brainAuthMiddleware = void 0;
const EXEMPT_PATHS = new Set(['/health', '/api/system/diagnostics']);
function brainAuthMiddleware(req, res, next) {
    const expectedToken = process.env.BRAIN_AUTH_TOKEN;
    // Dev mode — no token configured, pass all
    if (!expectedToken) {
        next();
        return;
    }
    // Exempt paths
    if (EXEMPT_PATHS.has(req.path)) {
        next();
        return;
    }
    const providedToken = req.headers['x-brain-token'];
    if (providedToken === expectedToken) {
        next();
        return;
    }
    res.status(401).json({ error: 'Unauthorized — invalid or missing X-Brain-Token header' });
}
exports.brainAuthMiddleware = brainAuthMiddleware;
//# sourceMappingURL=auth.js.map
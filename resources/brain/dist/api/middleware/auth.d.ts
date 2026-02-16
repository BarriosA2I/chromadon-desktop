/**
 * Brain Auth Token Middleware
 *
 * Validates X-Brain-Token header against BRAIN_AUTH_TOKEN env var.
 * If no token is configured (dev mode), all requests pass through.
 * Exempt paths: /health, /api/system/diagnostics
 *
 * @author Barrios A2I
 */
import type { Request, Response, NextFunction } from 'express';
export declare function brainAuthMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map
/**
 * Request ID Correlation Middleware
 *
 * Reads X-Request-Id header or generates UUID. Sets on req and response header.
 *
 * @author Barrios A2I
 */
import type { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=request-id.d.ts.map
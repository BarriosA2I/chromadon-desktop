"use strict";
/**
 * Request ID Correlation Middleware
 *
 * Reads X-Request-Id header or generates UUID. Sets on req and response header.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const uuid_1 = require("uuid");
function requestIdMiddleware(req, res, next) {
    const id = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}
exports.requestIdMiddleware = requestIdMiddleware;
//# sourceMappingURL=request-id.js.map
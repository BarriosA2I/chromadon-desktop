/**
 * Centralized Structured Logger — pino-based JSON logging for CHROMADON Brain
 *
 * Usage:
 *   import { createChildLogger } from '../lib/logger.js';
 *   const log = createChildLogger('api');
 *   log.info({ port: 3001 }, 'Server started');
 *
 * @author Barrios A2I
 */
import pino from 'pino';
/**
 * Root pino logger — all child loggers inherit from this.
 * Redacts sensitive fields in logged objects.
 */
export declare const rootLogger: import("pino").Logger<never>;
/**
 * Create a domain-scoped child logger.
 *
 * @param domain - Logical domain name (e.g. 'api', 'orchestrator', 'scheduler')
 */
export declare function createChildLogger(domain: string): pino.Logger;
/**
 * Generate a unique correlation ID for request tracing.
 */
export declare function generateCorrelationId(): string;
//# sourceMappingURL=logger.d.ts.map
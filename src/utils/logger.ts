/**
 * Structured Logger for CHROMADON Desktop
 *
 * Replaces bare console.log calls with structured JSON output.
 * Each log entry includes: level, message, component, timestamp, and optional metadata.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  component: string
  message: string
  timestamp: string
  [key: string]: unknown
}

function emit(level: LogLevel, component: string, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    component,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }

  switch (level) {
    case 'debug':
      console.debug('[CHROMADON]', JSON.stringify(entry))
      break
    case 'info':
      console.info('[CHROMADON]', JSON.stringify(entry))
      break
    case 'warn':
      console.warn('[CHROMADON]', JSON.stringify(entry))
      break
    case 'error':
      console.error('[CHROMADON]', JSON.stringify(entry))
      break
  }
}

/**
 * Create a scoped logger for a specific component.
 *
 * Usage:
 *   const log = createLogger('useStreamingChat')
 *   log.info('Connected to Brain API', { mode: 'DESKTOP' })
 *   log.error('SSE stream failed', { error: err.message })
 */
export function createLogger(component: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => emit('debug', component, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => emit('info', component, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit('warn', component, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => emit('error', component, message, meta),
  }
}

"use strict";
/**
 * CollectorWriter - Internal SSEWriter that collects events into arrays.
 * Used by SocialOverlord for batch/non-streaming task processing.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectorWriter = void 0;
class CollectorWriter {
    events = [];
    fullText = '';
    toolResults = [];
    sessionId = null;
    _closed = false;
    writeEvent(event, data) {
        if (this._closed)
            return;
        this.events.push({ event, data, timestamp: Date.now() });
        switch (event) {
            case 'text_delta':
                if (data.text)
                    this.fullText += data.text;
                break;
            case 'tool_result':
                this.toolResults.push({
                    id: data.id,
                    name: data.name,
                    success: data.success,
                    result: data.result,
                    error: data.error,
                    durationMs: data.durationMs,
                });
                break;
            case 'session_id':
                this.sessionId = data.sessionId;
                break;
        }
    }
    close() {
        this._closed = true;
    }
    isClosed() {
        return this._closed;
    }
    /** Get a summary of what happened during execution. */
    getSummary() {
        if (this.fullText)
            return this.fullText;
        if (this.toolResults.length > 0) {
            const succeeded = this.toolResults.filter((r) => r.success).length;
            return `Executed ${this.toolResults.length} tool calls (${succeeded} succeeded, ${this.toolResults.length - succeeded} failed).`;
        }
        return 'No output captured.';
    }
}
exports.CollectorWriter = CollectorWriter;
//# sourceMappingURL=social-collector-writer.js.map
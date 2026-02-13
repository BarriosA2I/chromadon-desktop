"use strict";
/**
 * Document Chunker — Sentence-Aware Text Splitting
 *
 * Splits text into ~500-token chunks with 50-token overlap
 * at sentence boundaries for optimal retrieval.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentChunker = void 0;
const DEFAULT_OPTIONS = {
    maxTokens: 500,
    overlapTokens: 50,
};
class DocumentChunker {
    options;
    constructor(options) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    chunk(text) {
        if (!text || text.trim().length === 0)
            return [];
        const sentences = this.splitSentences(text);
        if (sentences.length === 0)
            return [];
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;
        let chunkStartChar = 0;
        let currentCharPos = 0;
        let sentenceStartPositions = [];
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const sentenceTokens = this.estimateTokens(sentence);
            // If single sentence exceeds max, split it by words
            if (sentenceTokens > this.options.maxTokens && currentChunk.length === 0) {
                const wordChunks = this.splitLongSentence(sentence, currentCharPos);
                for (const wc of wordChunks) {
                    wc.chunkIndex = chunks.length;
                    chunks.push(wc);
                }
                currentCharPos += sentence.length;
                continue;
            }
            // If adding this sentence exceeds max, flush current chunk
            if (currentTokens + sentenceTokens > this.options.maxTokens && currentChunk.length > 0) {
                const chunkText = currentChunk.join(' ');
                chunks.push({
                    content: chunkText.trim(),
                    chunkIndex: chunks.length,
                    startChar: chunkStartChar,
                    endChar: currentCharPos,
                    estimatedTokens: currentTokens,
                });
                // Overlap: keep last few sentences that fit in overlap budget
                const overlapSentences = [];
                let overlapTokens = 0;
                for (let j = currentChunk.length - 1; j >= 0; j--) {
                    const st = this.estimateTokens(currentChunk[j]);
                    if (overlapTokens + st > this.options.overlapTokens)
                        break;
                    overlapSentences.unshift(currentChunk[j]);
                    overlapTokens += st;
                }
                currentChunk = overlapSentences;
                currentTokens = overlapTokens;
                chunkStartChar = sentenceStartPositions[sentenceStartPositions.length - overlapSentences.length] ?? currentCharPos;
                sentenceStartPositions = sentenceStartPositions.slice(-overlapSentences.length);
            }
            sentenceStartPositions.push(currentCharPos);
            currentChunk.push(sentence);
            currentTokens += sentenceTokens;
            currentCharPos += sentence.length;
        }
        // Flush remaining
        if (currentChunk.length > 0) {
            const chunkText = currentChunk.join(' ');
            chunks.push({
                content: chunkText.trim(),
                chunkIndex: chunks.length,
                startChar: chunkStartChar,
                endChar: currentCharPos,
                estimatedTokens: currentTokens,
            });
        }
        return chunks;
    }
    // =========================================================================
    // SENTENCE SPLITTING
    // =========================================================================
    splitSentences(text) {
        // Split on sentence-ending punctuation followed by whitespace
        const raw = text.split(/(?<=[.!?])\s+/);
        return raw.filter(s => s.trim().length > 0);
    }
    splitLongSentence(sentence, charOffset) {
        const words = sentence.split(/\s+/);
        const chunks = [];
        let current = [];
        let currentTokens = 0;
        let pos = charOffset;
        for (const word of words) {
            const wordTokens = this.estimateTokens(word);
            if (currentTokens + wordTokens > this.options.maxTokens && current.length > 0) {
                const chunkText = current.join(' ');
                chunks.push({
                    content: chunkText,
                    chunkIndex: 0, // Will be re-assigned
                    startChar: pos - chunkText.length,
                    endChar: pos,
                    estimatedTokens: currentTokens,
                });
                current = [];
                currentTokens = 0;
            }
            current.push(word);
            currentTokens += wordTokens;
            pos += word.length + 1;
        }
        if (current.length > 0) {
            const chunkText = current.join(' ');
            chunks.push({
                content: chunkText,
                chunkIndex: 0,
                startChar: pos - chunkText.length,
                endChar: pos,
                estimatedTokens: currentTokens,
            });
        }
        return chunks;
    }
    // =========================================================================
    // TOKEN ESTIMATION
    // =========================================================================
    estimateTokens(text) {
        // ~4 chars per token for English text
        return Math.ceil(text.length / 4);
    }
}
exports.DocumentChunker = DocumentChunker;
//# sourceMappingURL=document-chunker.js.map
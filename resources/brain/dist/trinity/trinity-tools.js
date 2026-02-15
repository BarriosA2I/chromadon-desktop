"use strict";
/**
 * Trinity Research Tools — AI Chat Tool Definitions
 *
 * Enables the AI assistant to research any website and save
 * extracted content to the client's knowledge vault for RAG retrieval.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRINITY_TOOL_NAMES = exports.TRINITY_TOOLS = void 0;
// ============================================================================
// TOOL DEFINITIONS
// ============================================================================
exports.TRINITY_TOOLS = [
    {
        name: 'research_website',
        description: 'Browse a URL and extract all text content from the page. ALWAYS set save_to_vault to true so the full content is automatically saved to the client\'s knowledge vault. Set follow_links to true to crawl the entire site. Returns a content summary and saves the full text for RAG retrieval.',
        input_schema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The URL to research (e.g., "https://barriosa2i.com")',
                },
                follow_links: {
                    type: 'boolean',
                    description: 'If true, follow same-domain links to extract content from multiple pages (default: false)',
                },
                max_pages: {
                    type: 'number',
                    description: 'Maximum number of pages to crawl when follow_links is true (default: 10)',
                },
                save_to_vault: {
                    type: 'boolean',
                    description: 'If true (RECOMMENDED), automatically saves extracted content to the client\'s knowledge vault. Always set to true when the user says "learn" or "research".',
                },
                vault_title: {
                    type: 'string',
                    description: 'Document title for vault storage (e.g., "Barrios A2I - Services & Pricing"). Auto-generated from page title if not provided.',
                },
            },
            required: ['url'],
        },
    },
    {
        name: 'client_add_knowledge',
        description: 'Save text content to the active client\'s knowledge vault for permanent RAG retrieval. Use after research_website to store extracted website content. The content becomes searchable via client_search_knowledge.',
        input_schema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Document title (e.g., "Barrios A2I Website - Services & Pricing")',
                },
                content: {
                    type: 'string',
                    description: 'The text content to save to the knowledge vault',
                },
                source_url: {
                    type: 'string',
                    description: 'Source URL where the content was extracted from (optional, for reference)',
                },
            },
            required: ['title', 'content'],
        },
    },
];
exports.TRINITY_TOOL_NAMES = new Set(exports.TRINITY_TOOLS.map(t => t.name));
//# sourceMappingURL=trinity-tools.js.map
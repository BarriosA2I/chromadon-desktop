# CHROMADON Desktop - Changelog (Archived)

Older changelog entries moved from CLAUDE.md to reduce context size.

## Changes (v1.25.8 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Brain v1.10.8 — Full Trinity Intelligence Pipeline: 3 new AI chat tools for vault-powered market analysis | `resources/brain/dist/` |

## Changes (v1.25.7 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Brain v1.10.7 — Trinity Research tools: website research + knowledge vault | `resources/brain/dist/` |

## Changes (v1.25.6 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.6 — Gemini empty responses on tool calls now retry automatically | `resources/brain/dist/` |

## Changes (v1.25.5 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.5 — Client data stored in `CHROMADON_DATA_DIR` | `resources/brain/dist/` |

## Changes (v1.25.4 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Brand Assets thumbnail previews in responsive grid | `src/components/documents/MediaAssetCard.tsx`, `src/components/documents/BrandAssets.tsx` |
| Updated: Brain dist v1.10.4 | `resources/brain/dist/` |

## Changes (v1.25.3 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Client onboarding uses Gemini API instead of Anthropic | `resources/brain/dist/` |
| Fixed: Document Vault auto-creates client on first click | `src/App.tsx` |
| Updated: Brain dist v1.10.3 | `resources/brain/dist/` |

## Changes (v1.25.2 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Client Media Vault — Brand Assets tab in Document Vault | `src/components/documents/BrandAssets.tsx` (NEW), `src/components/documents/MediaAssetCard.tsx` (NEW) |
| Updated: Brain dist v1.10.2 | `resources/brain/dist/` |

## Changes (v1.25.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.1 — Scheduled posts include upload_file instructions | `release/win-unpacked/resources/brain/dist/` |
| Fixed: CRITICAL — Facebook/LinkedIn/Instagram posting templates rewritten | `release/win-unpacked/resources/brain/dist/` |

## Changes (v1.25.0 — 2026-02-15)

| Change | File |
|--------|------|
| Updated: Brain dist v1.10.0 — Autonomous social posting, linked platforms | `resources/brain/dist/` |

## Changes (v1.24.2 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: "Check for Updates" button works in dev mode | `src/components/SettingsModal.tsx` |

## Changes (v1.24.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Bundled Brain package.json version was stale | `resources/brain/package.json` |

## Changes (v1.24.0 — 2026-02-15)

| Change | File |
|--------|------|
| Added: THE_SCHEDULER — general-purpose browser automation scheduling | Brain `src/scheduler/` |
| Added: 5 scheduler tools + NL time parsing | Brain `src/scheduler/scheduler-tools.ts` |
| Updated: Brain dist v1.9.0 | `resources/brain/dist/` |

## Changes (v1.23.2 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Scheduled posts use existing tabs instead of navigating | Brain `src/core/social-prompts.ts` |
| Fixed: CRITICAL — Monitoring uses focused system prompt | Brain `src/core/agentic-orchestrator.ts` |
| Updated: Brain dist v1.8.3 | `resources/brain/dist/` |

## Changes (v1.23.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Stale Brain processes killed before forking new Brain | `electron/main.ts` |
| Updated: Brain dist v1.8.2 | `resources/brain/dist/` |

## Changes (v1.23.0 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Zombie Brain detection + kill + restart | `electron/main.ts` |
| Fixed: Brain HTTP server verification (25s probe) | `electron/main.ts` |
| Fixed: Brain `app.listen()` errors properly reject | Brain `src/api/server.ts` |

## Changes (v1.22.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Monitoring chat routes to FAST tier | `resources/brain/dist/routing/cost-router.js` |

## Changes (v1.22.0 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Social Media Monitoring with Settings UI + TitleBar indicator | `electron/main.ts`, `src/components/SettingsModal.tsx`, `src/components/TitleBar.tsx` |
| Updated: Brain dist v1.8.0 | `resources/brain/dist/` |

## Changes (v1.21.0 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — better-sqlite3 rebuilt for Electron Node.js ABI | `resources/brain/node_modules/better-sqlite3` |
| Fixed: Health check supports Gemini-only clients | `electron/main.ts` |
| Added: Exponential backoff for Brain crash restarts | `electron/main.ts` |

## Changes (v1.20.2 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Brain init errors shown to user | `src/hooks/useStreamingChat.ts` |
| Updated: Brain v1.6.1 | `resources/brain/dist/` |

## Changes (v1.20.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Auto-updater check interval reduced to 1 hour | `electron/main.ts` |
| Added: Native OS dialog on update download | `electron/main.ts` |

## Changes (v1.20.0 — 2026-02-15)

| Change | File |
|--------|------|
| Added: OBS Studio integration — 9 AI chat tools | `resources/brain/dist/obs/` |
| Updated: Brain dist v1.6.0 | `resources/brain/dist/` |

## Changes (v1.19.11 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: "AI assistant is starting up" now shows "No API key" immediately | `src/hooks/useStreamingChat.ts` |
| Updated: Brain dist v1.5.10 | `resources/brain/dist/` |

## Changes (v1.19.10 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Times in UTC → EST | `resources/brain/dist/` |

## Changes (v1.19.9 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: AI says "Done." → now shows schedule | `resources/brain/dist/` |

## Changes (v1.19.8 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Empty AI response for browser navigation | `resources/brain/.env` |

## Changes (v1.19.7 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Internal provider messages no longer leak to chat | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.6 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Provider bounce loop capped at 3 | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.5 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Gemini MALFORMED_FUNCTION_CALL recovery | `resources/brain/dist/providers/gemini-provider.js` |

## Changes (v1.19.4 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: SSE streaming dead after first message | `src/hooks/useStreamingChat.ts` |
| Fixed: Gemini tool call compatibility | `resources/brain/dist/` |

## Changes (v1.19.3 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Anthropic billing errors bounce to Gemini | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.2 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Brain starts with EITHER Gemini or Anthropic key | `resources/brain/dist/api/server.js` |

## Changes (v1.19.1 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: `usingGemini` variable scoping | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.0 — 2026-02-14)

| Change | File |
|--------|------|
| Added: Gemini API key input in Settings (primary provider) | `src/components/SettingsModal.tsx` |
| Added: DPAPI encryption for Gemini key | `electron/main.ts` |

## Changes (v1.18.0 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist v1.5.0 — Gemini provider, 3-tier cost router | `resources/brain/dist/` |

## Changes (v1.17.0 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist v1.4.0 — 16 new AI chat tools (8 marketing + 8 YouTube) | `resources/brain/dist/` |

## Changes (v1.16.6 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Scheduler routes through AI chat | `electron/main.ts` |

## Changes (v1.16.5 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist — capped 429 retries | `resources/brain/dist/` |

## Changes (v1.16.4 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist — 529 overloaded detection fix | `resources/brain/dist/` |

## Changes (v1.16.3 — 2026-02-14)

| Change | File |
|--------|------|
| Added: `mediaUrls` to MarketingTask | `electron/main.ts`, `electron/preload.ts`, `src/store/chromadonStore.ts` |

## Changes (v1.16.2 — 2026-02-14)

| Change | File |
|--------|------|
| Added: `POST /chat/send` endpoint | `electron/main.ts` |

## Changes (v1.16.1 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Scheduler execution payload format | `electron/main.ts` |

## Changes (v1.16.0 — 2026-02-14)

| Change | File |
|--------|------|
| Added: Multi-platform cross-posting, scheduling UI, queue persistence | `src/components/MarketingQueue.tsx`, `electron/main.ts` |

## Changes (v1.15.1 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Route ordering for `/sessions/backups` | `electron/main.ts` |

## Changes (v1.15.0 — 2026-02-13)

| Change | File |
|--------|------|
| Added: Session backup/restore with AES encryption | `electron/session-backup.ts` (NEW) |
| Added: Circuit breaker + backoff to streaming chat | `src/hooks/useStreamingChat.ts` |

## Changes (v1.14.1 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Logo black backgrounds → transparent | `src/assets/*.png` |

## Changes (v1.14.0 — 2026-02-13)

| Change | File |
|--------|------|
| Added: Real CHROMADON dragon crest logo throughout app | `src/components/TitleBar.tsx`, `src/components/SplashScreen.tsx` |

## Changes (v1.13.4 — 2026-02-13)

| Change | File |
|--------|------|
| Added: Email crash alerts via Resend.com | `electron/main.ts` |

## Changes (v1.13.3 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Brain dist agents compiled correctly | `resources/brain/dist/agents/*` |

## Changes (v1.13.2 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Brain bundle had stale dist | `resources/brain/dist/*` |
| Fixed: Auto-updater — repo now public | GitHub |

## Changes (v1.13.1 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Deprecated Haiku model refs updated | Brain: various |
| Fixed: JSON parse crash from control characters | Brain: `ai-engine-v3.ts` |
| Fixed: Scroll uses `behavior: 'instant'` | `electron/main.ts` |

See git log for full details on all versions.

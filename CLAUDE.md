# CHROMADON Desktop - Claude Code Instructions

**Project:** Electron Desktop Shell for CHROMADON Browser Automation
**Author:** Barrios A2I (Gary Barrios)
**Stack:** Electron 28 + React 18 + TypeScript + Vite
**Status:** Production Ready | **Audit Score: 6.6/10 (B-) - 2026-02-06**

---

## Recent Changes (v1.25.11 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain crash-restart loop — `brainRestartCount` reset to 0 on every fork, making BRAIN_MAX_RESTARTS unreachable — now only resets after 60s stability | `electron/main.ts` |
| Fixed: CRITICAL — Signal-based deaths (SIGKILL, SIGSEGV, OOM) treated as clean exit — no restart. Now properly detected and trigger restart with backoff | `electron/main.ts` |
| Fixed: CRITICAL — `brainRestarting` flag could get stuck forever, permanently blocking all restart attempts — added 30s safety timeout | `electron/main.ts` |
| Fixed: CRITICAL — `healthRestartCount` never reset after reaching max (3), permanently disabling health monitoring — now resets after 5 consecutive healthy checks | `electron/main.ts` |
| Added: Brain crash diagnostics — stderr capture (last 2KB), uptime tracking, comprehensive crash info logged on exit | `electron/main.ts` |
| Added: Native module self-test — tests better-sqlite3 before forking Brain, catches ABI mismatches early with user-friendly error | `electron/main.ts` |

## Changes (v1.25.10 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.10 — Scheduled posts now generate actual text content before posting — two-phase execution pre-generates post text via LLM, then sends browser-only instructions with pre-written content | `resources/brain/dist/` |
| Fixed: Brain v1.10.10 — Source filter for legacy vault chunks now parses Source URL from chunk content text + domain diversity fallback when no client profile exists | `resources/brain/dist/` |

## Changes (v1.25.9 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.9 — `get_trending_topics` and `analyze_competitors` no longer return client's own business content — source filtering excludes client's own domain from market analysis | `resources/brain/dist/` |
| Added: Trinity Intelligence wired to Analytics Dashboard — Overview shows market trends, Competitors shows vault research insights, Audience shows full audience profile (personas, brand voice, USPs) | `src/components/analytics/OverviewPanel.tsx`, `CompetitorPanel.tsx`, `AudiencePanel.tsx` |
| Added: `trinityData` field in analytics state — fetched from new Brain endpoint `GET /api/analytics/trinity` | `src/hooks/useAnalytics.ts`, `src/store/analyticsTypes.ts` |

## Changes (v1.25.8 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Brain v1.10.8 — Full Trinity Intelligence Pipeline: 3 new AI chat tools (analyze_competitors, get_trending_topics, get_audience_insights) for vault-powered market analysis. Auto-injects market intelligence into social content generation. | `resources/brain/dist/` |

## Changes (v1.25.7 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Brain v1.10.7 — Trinity Research tools: AI assistant can now research any website and save content to client knowledge vault for permanent RAG retrieval. "Learn barriosa2i.com" crawls full site and saves real pricing/services. | `resources/brain/dist/` |

## Changes (v1.25.6 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.6 — Gemini empty responses on tool calls (document search, client info) now retry automatically — users see actual results instead of blank chat | `resources/brain/dist/` |

## Changes (v1.25.5 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.5 — Client data now stored in `CHROMADON_DATA_DIR` (Electron userData) in packaged app — documents/media persist correctly across restarts | `resources/brain/dist/` |

## Changes (v1.25.4 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Brand Assets thumbnail previews — images and videos now show actual visual thumbnails in a responsive grid layout instead of emoji icons | `src/components/documents/MediaAssetCard.tsx`, `src/components/documents/BrandAssets.tsx` |
| Added: Video play icon overlay on video thumbnails | `src/components/documents/MediaAssetCard.tsx` |
| Added: Primary Logo badge overlaid on thumbnail (gold, top-left) | `src/components/documents/MediaAssetCard.tsx` |
| Added: Hover overlay with Set Logo / Delete actions on thumbnails | `src/components/documents/MediaAssetCard.tsx` |
| Updated: Brain dist v1.10.4 — `GET /api/client-context/media/file/:id` endpoint for serving media files | `resources/brain/dist/` |

## Changes (v1.25.3 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Client onboarding (InterviewEngine), strategy generation, and document processing now use Gemini API instead of hardcoded Anthropic — clients with Gemini-only keys no longer get "credit balance too low" errors | `resources/brain/dist/` |
| Fixed: Document Vault and Growth Strategy buttons no longer disabled when no client exists — auto-creates "My Business" client on first click | `src/App.tsx` |
| Added: `createClient` method to useClientContext hook — calls `POST /api/client-context/clients` | `src/hooks/useClientContext.ts` |
| Updated: Brain dist v1.10.3 — shared LLM helper (Gemini-first, Anthropic fallback), POST /clients endpoint | `resources/brain/dist/` |

## Changes (v1.25.2 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Client Media Vault — Brand Assets tab in Document Vault for per-client logos, images, and videos | `src/components/documents/BrandAssets.tsx` (NEW), `src/components/documents/MediaAssetCard.tsx` (NEW) |
| Added: Tab switcher in Document Vault — "Documents" and "Brand Assets" tabs with teal active styling | `src/components/documents/DocumentVault.tsx` |
| Added: `BrandAsset` type definition for client brand media | `src/store/clientContextTypes.ts` |
| Added: 4 media API methods — `fetchMediaAssets`, `uploadMediaAsset`, `deleteMediaAsset`, `setPrimaryLogo` | `src/hooks/useClientContext.ts` |
| Added: Drag-and-drop upload for brand assets (PNG, JPG, WEBP, GIF, JFIF, MP4, MOV, AVI, WEBM) | `src/components/documents/BrandAssets.tsx` |
| Added: Primary Logo designation — gold badge, "Set Logo" button on hover | `src/components/documents/MediaAssetCard.tsx` |
| Updated: Brain dist v1.10.2 — `client_get_media` AI tool, media API endpoints, scheduler media priority chain | `resources/brain/dist/` |

## Changes (v1.25.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.10.1 — Scheduled posts now include explicit `upload_file` tool instructions with file paths | `release/win-unpacked/resources/brain/dist/` |
| Fixed: CRITICAL — Brain TAB MANAGEMENT rule prevents duplicate tabs — AI must list_tabs() before navigating to social media | `release/win-unpacked/resources/brain/dist/` |
| Fixed: CRITICAL — Facebook posting completes — template now includes media upload, "Next" button, and "Post" button steps | `release/win-unpacked/resources/brain/dist/` |
| Fixed: LinkedIn + Instagram post templates rewritten with full media upload flows | `release/win-unpacked/resources/brain/dist/` |

## Changes (v1.25.0 — 2026-02-15)

| Change | File |
|--------|------|
| Updated: Brain dist v1.10.0 — Autonomous social posting, linked platforms, CHROMADON product knowledge | `resources/brain/dist/` |
| Brain: AI no longer asks for content, platforms, or media — generates content at execution time | Brain `scheduler-executor.ts`, `orchestrator-system-prompt.ts` |
| Brain: Platform sessions from Desktop injected into system prompt — AI knows which platforms are authenticated | Brain `server.ts`, `agentic-orchestrator.ts` |
| Brain: Executor auto-filters unauthenticated platforms (e.g., Instagram when not linked) | Brain `scheduler-executor.ts` |
| Brain: Auto-attaches CHROMADON media assets — Logo.jfif for social, video for TikTok/YouTube | Brain `scheduler-executor.ts` |
| Brain: Auto-includes #CHROMADON #BarriosA2I hashtags + barriosa2i.com link on CHROMADON posts | Brain `scheduler-executor.ts` |
| Brain: CHROMADON product knowledge in full + compact system prompts for quality content generation | Brain `orchestrator-system-prompt.ts` |

## Changes (v1.24.2 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: "Check for Updates" button in Settings was non-functional in dev mode — now checks GitHub API directly for latest release and shows available version | `src/components/SettingsModal.tsx` |
| Fixed: Dev mode update check no longer fakes "Up to date" — compares current version against latest GitHub release | `src/components/SettingsModal.tsx` |

## Changes (v1.24.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Bundled Brain package.json version was 1.8.2 (stale) — now correctly shows 1.9.0 in health endpoint | `resources/brain/package.json` |
| Fixed: Fresh Brain dist rebuild ensures all scheduler code is current | `resources/brain/dist/` |

## Changes (v1.24.0 — 2026-02-15)

| Change | File |
|--------|------|
| Added: THE_SCHEDULER (Agent 0.2) — zero-cost idle tick loop, general-purpose browser automation scheduling. Replaces Desktop's fragile 30-second checkScheduledTasks() loop. | Brain `src/scheduler/` (6 new files) |
| Added: 5 new AI chat tools — `schedule_task` (general-purpose), `schedule_post` (social alias), `get_scheduled_tasks`, `cancel_scheduled_task`, `reschedule_task` | Brain `src/scheduler/scheduler-tools.ts` |
| Added: Natural language time parsing — "3pm tomorrow", "next Monday at 9am", "in 2 hours" via chrono-node | Brain `src/scheduler/scheduler-executor.ts` |
| Added: Task recurrence — daily/weekly/biweekly/monthly with automatic next occurrence generation | Brain `src/scheduler/the-scheduler.ts` |
| Added: Crash-resilient persistence — `~/.chromadon/scheduler-state.json` with atomic writes + backup | Brain `src/scheduler/scheduler-persistence.ts` |
| Added: REST endpoints — `GET /api/scheduler/status`, `GET /api/scheduler/tasks` | Brain `src/api/server.ts` |
| Updated: Brain dist v1.9.0 — TheScheduler agent, 5 scheduler tools, NL time parsing | `resources/brain/dist/` |

## Changes (v1.23.2 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Scheduled posts never execute — social prompts now use `list_tabs` + `switch_tab` to find client's existing authenticated tabs instead of navigating to fresh URLs that hit login walls | Brain `src/core/social-prompts.ts` |
| Fixed: CRITICAL — Tab duplication — social prompts and monitoring no longer open new tabs when platform tab already exists | Brain `src/core/social-prompts.ts` |
| Fixed: CRITICAL — Monitoring scrolls aimlessly — monitoring now uses focused 2-sentence system prompt via `systemPromptOverride` instead of 40KB prompt that drowns instructions | Brain `src/core/agentic-orchestrator.ts`, `src/monitoring/social-monitor.ts` |
| Added: Scheduler dispatch logging — task ID, platform, action logged before and after dispatch | `electron/main.ts` |
| Added: TheContentGenerator new methods — `generateComment()`, `generateReply()`, `generateMessage()` for agent-composed social replies | Brain `src/agents/tier2-execution.ts` |
| Changed: TheContentGenerator switched from Anthropic to Gemini 2.5 Flash (90%+ cost reduction) | Brain `src/agents/tier2-execution.ts` |
| Added: DesktopBrowserAdapter tab management — `listTabs()`, `switchTab()`, `findTabByDomain()` | Brain `src/adapters/desktop-browser-adapter.ts` |
| Updated: Brain dist v1.8.3 — tab-aware posting, monitoring override, agent content generation | `resources/brain/dist/` |

## Changes (v1.23.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Stale Brain processes from app crashes killed before forking new Brain (netstat + taskkill on port 3001) — prevents EADDRINUSE loop that left clients stuck with red Brain | `electron/main.ts` |
| Fixed: .env NODE_ENV changed from development to production | `resources/brain/.env` |
| Updated: Brain dist v1.8.2 — monitoring safety rewrite, orchestrator retry, version logging, cost router fix | `resources/brain/dist/` |

## Changes (v1.23.0 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Zombie Brain processes never detected or killed — health check now kills unreachable Brain after 3 consecutive failures (90s) and restarts | `electron/main.ts` |
| Fixed: CRITICAL — Brain HTTP server verification (25s probe) now kills zombie process and triggers restart instead of just logging | `electron/main.ts` |
| Fixed: Brain `startBrainServer()` always resets `brainRestarting` flag on exit/error — prevents permanent hung state | `electron/main.ts` |
| Fixed: Brain process 'error' event now triggers restart with backoff (was only logging) | `electron/main.ts` |
| Fixed: Brain clean exit (code 0) now notifies UI instead of silent failure | `electron/main.ts` |
| Fixed: Missing `brainRestarting = false` when Brain entry file not found — prevents permanent hang | `electron/main.ts` |
| Fixed: Brain `app.listen()` errors now properly reject the startup promise (was hanging forever on port conflicts) | Brain `src/api/server.ts` |
| Fixed: Brain `startServer().catch()` now exits with code 1 so Desktop restarts it (was just logging) | Brain `src/api/server.ts` |
| Fixed: EADDRINUSE exits with code 1 instead of code 0 — Desktop now properly restarts on port conflicts | Brain `src/api/server.ts` |
| Fixed: SocialMonitor timer callbacks wrapped with `.catch()` — prevents unhandled promise rejections from destabilizing process | Brain `src/monitoring/social-monitor.ts` |

## Changes (v1.22.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Monitoring chat commands returning empty response — Brain cost router now routes monitoring keywords to FAST tier (gemini-2.0-flash) instead of BALANCED (gemini-2.5-flash) which returns 0 output tokens | `resources/brain/dist/routing/cost-router.js` |

## Changes (v1.22.0 — 2026-02-15)

| Change | File |
|--------|------|
| Added: Social Media Monitoring — always-on background monitoring for comments/mentions with auto-reply, configurable via Settings or AI chat | `electron/main.ts`, `electron/preload.ts`, `src/vite-env.d.ts` |
| Added: Settings UI — Social Monitoring section with enable/disable toggle, interval selector (5/10/15/30/60 min), platform checkboxes (Twitter, LinkedIn, YouTube, Facebook) | `src/components/SettingsModal.tsx` |
| Added: TitleBar monitoring indicator — gold pulsing LED + "MON" label when monitoring is active | `src/components/TitleBar.tsx` |
| Added: `GET /monitoring/idle-status` endpoint — Brain checks user idle time before monitoring cycles | `electron/main.ts` |
| Added: User activity tracking — `/chat/send` updates lastUserActivity timestamp for idle detection | `electron/main.ts` |
| Added: 4 IPC handlers — monitoring:getStatus, monitoring:toggle, monitoring:getLog + onMonitoringStatus event | `electron/main.ts`, `electron/preload.ts` |
| Updated: Brain dist v1.8.0 — SocialMonitor, monitoring tools, DB migration v3, REST endpoints | `resources/brain/dist/` |

## Changes (v1.21.0 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain "green then red" crash loop for clients — better-sqlite3 native module now rebuilt for Electron's Node.js ABI | `resources/brain/node_modules/better-sqlite3` |
| Fixed: CRITICAL — better-sqlite3 lazy-loaded at runtime instead of top-level import — native module crash no longer kills Brain process | `resources/brain/dist/analytics/database.js`, `resources/brain/dist/client-context/vector-store.js` |
| Fixed: Health check now supports Gemini-only clients (was checking Anthropic key only, ignoring Gemini clients entirely) | `electron/main.ts` |
| Fixed: Health check restart loop — added 60s cooldown and max 3 health-triggered restarts per session (was infinite with counter reset) | `electron/main.ts` |
| Fixed: Brain crash restarts use exponential backoff (3s→6s→12s→24s→30s cap) instead of fixed 3s delay | `electron/main.ts` |
| Increased: Max Brain restart attempts from 5 to 10 | `electron/main.ts` |
| Added: Brain startup verification — Desktop confirms HTTP server actually responds after fork (25s timeout) | `electron/main.ts` |
| Added: Brain crash status sent to UI with attempt count and error details | `electron/main.ts` |

## Changes (v1.20.2 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Clients with valid API key still seeing "starting up" — Brain init errors now shown to user instead of swallowed | `src/hooks/useStreamingChat.ts` |
| Fixed: Health check handles `init_error` reason — shows actual error message from Brain with recovery instructions | `src/hooks/useStreamingChat.ts` |
| Fixed: Brain v1.6.1 — non-critical component failures no longer prevent orchestrator from starting | `resources/brain/dist/` |

## Changes (v1.20.1 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Auto-updater check interval reduced from 4 hours to 1 hour — clients get updates faster | `electron/main.ts` |
| Added: Native OS dialog on update download — "Restart Now" / "Later" prompt so clients can't miss updates | `electron/main.ts` |
| Fixed: Scheduler checks for overdue tasks on startup (5s delay for renderer mount) instead of waiting 30s | `electron/main.ts` |
| Added: Scheduler debug logging — shows next scheduled task time and count on ~10% of checks | `electron/main.ts` |

## Changes (v1.20.0 — 2026-02-15)

| Change | File |
|--------|------|
| Added: OBS Studio integration — 9 AI chat tools for live streaming control (start/stop stream, record, scenes, mic, sources) | `resources/brain/dist/obs/` |
| Added: OBS env vars (OBS_WS_HOST, OBS_WS_PORT, OBS_WS_PASSWORD, OBS_SAFE_MODE, OBS_SAFE_SCENES) passed to Brain fork | `electron/main.ts` |
| Updated: Brain dist v1.6.0 — OBS WebSocket client + tools + executor + system prompt updates | `resources/brain/dist/` |

## Changes (v1.19.11 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Clients stuck on "AI assistant is starting up" for entire day — now shows "No API key configured. Open Settings..." immediately | `src/hooks/useStreamingChat.ts` |
| Fixed: Health check now reads `orchestratorReason` from Brain — detects `no_api_key` instantly instead of waiting 10 seconds | `src/hooks/useStreamingChat.ts` |
| Updated: Brain dist v1.5.10 — health endpoint returns `orchestratorReason` field | `resources/brain/dist/` |

## Changes (v1.19.10 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Times displayed in UTC instead of user's EST timezone — Brain v1.5.9 | `resources/brain/dist/` |
| Updated: Brain dist v1.5.9 — all times now display in EST for scheduling and queue display | `resources/brain/dist/` |

## Changes (v1.19.9 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: AI says "Done." for scheduled posts instead of showing schedule — Brain v1.5.8 routes scheduling queries to FAST tier | `resources/brain/dist/` |
| Fixed: `get_scheduled_posts` now returns compact date-grouped summary (no content echo) | `resources/brain/dist/marketing/` |
| Updated: Brain dist v1.5.8 — cost router continuation routing + compact schedule responses | `resources/brain/dist/` |

## Changes (v1.19.8 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Empty AI response for browser navigation — Brain v1.5.7 removes `LLM_MODEL` override that forced thinking model | `resources/brain/.env` |
| Updated: Brain dist v1.5.7 — FAST tier now correctly uses `gemini-2.0-flash` for browser actions | `resources/brain/dist/` |

## Changes (v1.19.7 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: Internal provider retry/fallback messages no longer leak to user chat stream | `resources/brain/dist/core/agentic-orchestrator.js` |
| Removed: "Rate limited", "Switching providers", "Switching to backup model", "Retrying", "Anthropic key issue" text from user-visible SSE stream | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.6 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Provider bounce loop — Gemini→Anthropic→Gemini infinite loop now capped at 3 bounces | `resources/brain/dist/core/agentic-orchestrator.js` |
| Fixed: Gemini 429 rate limit handling — respects retry delay, retries 2x before fallback | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.5 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Gemini MALFORMED_FUNCTION_CALL — system prompts now include current UTC datetime for relative time computations | `resources/brain/dist/core/orchestrator-system-prompt.js` |
| Added: MALFORMED_FUNCTION_CALL recovery — parses Python-style code and reconstructs valid tool_use blocks | `resources/brain/dist/providers/gemini-provider.js` |
| Added: Graceful fallback for unrecoverable malformed calls — user sees friendly retry message | `resources/brain/dist/providers/gemini-provider.js` |

## Changes (v1.19.4 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: SSE streaming dead after first message — reader.releaseLock() + cache:no-store | `src/hooks/useStreamingChat.ts` |
| Fixed: Gemini tool calls — tool_result uses function name for functionResponse | `resources/brain/dist/providers/gemini-provider.js` |
| Fixed: API key check now accepts Gemini key (was Anthropic-only gate) | `src/hooks/useStreamingChat.ts` |
| Added: `tool_name` field on all tool_result blocks for Gemini compatibility | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.3 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Anthropic billing/auth errors bounce back to Gemini instead of dying | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.2 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Brain now starts with EITHER Gemini or Anthropic key (was requiring Anthropic) | `resources/brain/dist/api/server.js` |
| Added: Anthropic fallback guard — prevents fallback calls when no Anthropic key is set | `resources/brain/dist/core/agentic-orchestrator.js` |
| Fixed: NeuralRAGAIEngine conditionally initialized only when Anthropic key is present | `resources/brain/dist/api/server.js` |

## Changes (v1.19.1 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: `usingGemini` variable scoping — was declared inside try block, referenced after loop | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.19.0 — 2026-02-14)

| Change | File |
|--------|------|
| Added: Gemini API key input in Settings (Primary provider, teal-themed) | `src/components/SettingsModal.tsx` |
| Added: Anthropic key relabeled as "Fallback" provider (gold-themed) | `src/components/SettingsModal.tsx` |
| Added: Gemini key storage with DPAPI encryption (same pattern as Anthropic) | `electron/main.ts` |
| Added: 4 IPC handlers — getGeminiKeyStatus, setGeminiKey, validateGeminiKey, removeGeminiKey | `electron/main.ts` |
| Added: Gemini key validation against Google Generative AI REST API | `electron/main.ts` |
| Added: `GEMINI_API_KEY` env var passed to Brain on startup | `electron/main.ts` |
| Added: 4 preload bridge methods + type definitions for Gemini settings | `electron/preload.ts` |
| Added: `geminiKeyStatus` state + `setGeminiKeyStatus` action in store | `src/store/chromadonStore.ts` |
| Updated: Settings auto-open only when NEITHER key is configured | `src/App.tsx` |
| Updated: Status indicator shows "Gemini (primary)" / "Anthropic only" / "No API Key" | `src/components/SettingsModal.tsx` |

## Changes (v1.18.0 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist v1.5.0 — Gemini provider as primary LLM (90%+ cost reduction) | `resources/brain/dist/` |
| Added: `@google/generative-ai` SDK to bundled brain dependencies | `resources/brain/node_modules/` |
| Brain: 3-tier cost router (FAST/BALANCED/REASONING) with compact system prompt | Brain `routing/cost-router.js`, `providers/gemini-provider.js` |
| Brain: Automatic Anthropic fallback on Gemini errors | Brain `core/agentic-orchestrator.js` |

## Changes (v1.17.0 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist v1.4.0 — 16 new AI chat tools (8 marketing + 8 YouTube Studio) | `resources/brain/dist/` |
| Marketing tools: content_calendar, repurpose_content, hashtag_research, engagement_report, competitor_watch, auto_reply, lead_capture, campaign_tracker | Brain `marketing/` |
| YouTube Studio tools: video_analytics, comment_manager, seo_optimizer, thumbnail_test, community_post, revenue_report, playlist_manager, upload_scheduler | Brain `youtube/` |

## Changes (v1.16.6 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Scheduler now routes through AI assistant chat instead of calling Social Overlord API directly | `electron/main.ts` |
| Fixed: Brain dist — capped 429 retries + disabled SDK auto-retry (Brain v1.3.5) | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.16.5 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist — capped 429 retries + disabled SDK auto-retry (Brain v1.3.5) | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.16.4 — 2026-02-14)

| Change | File |
|--------|------|
| Updated: Brain dist — 529 overloaded detection fix + model fallback (Brain v1.3.4) | `resources/brain/dist/core/agentic-orchestrator.js` |

## Changes (v1.16.3 — 2026-02-14)

| Change | File |
|--------|------|
| Added: `mediaUrls?: string[]` to MarketingTask interface — stores file paths for post attachments | `electron/main.ts`, `electron/preload.ts`, `src/store/chromadonStore.ts` |
| Added: `mediaUrls` accepted in `POST /queue/add` endpoint and stored on tasks | `electron/main.ts` |
| Added: `mediaUrls` included in scheduler auto-execution payload to Brain | `electron/main.ts` |

## Changes (v1.16.2 — 2026-02-14)

| Change | File |
|--------|------|
| Added: `POST /chat/send` endpoint — sends messages through AI assistant chat panel via executeJavaScript + CustomEvent | `electron/main.ts` |

## Changes (v1.16.1 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Scheduler auto-execution payload wrapped in `{ task: {...} }` to match Brain's expected format | `electron/main.ts` |

## Changes (v1.16.0 — 2026-02-14)

| Change | File |
|--------|------|
| Added: Multi-platform cross-posting — toggle buttons to select multiple platforms per task | `src/components/MarketingQueue.tsx` |
| Added: Scheduling UI — datetime picker, recurrence selector (none/daily/weekly), schedule toggle | `src/components/MarketingQueue.tsx` |
| Added: Scheduled task display — indigo status badge, countdown timer, recurrence label | `src/components/MarketingQueue.tsx` |
| Added: Hashtag input — comma/space separated with live preview badges | `src/components/MarketingQueue.tsx` |
| Added: Cross-post batch indicator + batch ID display in task cards | `src/components/MarketingQueue.tsx` |
| Added: Queue persistence — tasks survive app restarts via JSON file (7-day auto-cleanup) | `electron/main.ts` |
| Added: 30-second scheduler loop — auto-executes due scheduled tasks, handles daily/weekly recurrence | `electron/main.ts` |
| Added: `scheduledTime`, `recurrence`, `batchId`, `hashtags`, `analyticsPostId` to MarketingTask type | `electron/main.ts`, `electron/preload.ts`, `src/store/chromadonStore.ts` |
| Added: `'scheduled'` status to MarketingTask + QueueStats | All type files |
| Added: `saveQueue()` calls to all 10 queue mutation handlers (IPC + HTTP) | `electron/main.ts` |

## Changes (v1.15.1 — 2026-02-14)

| Change | File |
|--------|------|
| Fixed: Route ordering — `/sessions/backups` now registered before `/sessions/:platform` wildcard | `electron/main.ts` |

## Changes (v1.15.0 — 2026-02-13)

| Change | File |
|--------|------|
| Added: Session backup/restore — encrypted cookie export/import per platform | `electron/session-backup.ts` (NEW) |
| Added: 6 IPC handlers + 4 HTTP control server endpoints for session backup | `electron/main.ts` |
| Added: Hourly auto-backup when user has done at least one manual backup | `electron/main.ts` |
| Added: Preload bridge methods for session backup/restore | `electron/preload.ts` |
| Added: Backup/Restore buttons per platform in Session Setup UI | `src/components/SessionSetup.tsx` |
| Added: "Backup All" button + password prompt modal + backup status indicators | `src/components/SessionSetup.tsx` |
| Added: sessionBackups state to Zustand store | `src/store/chromadonStore.ts` |
| Added: Circuit breaker + exponential backoff to streaming chat | `src/hooks/useStreamingChat.ts` |
| Added: Structured JSON logger utility | `src/utils/logger.ts` |

## Changes (v1.14.1 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Logo black backgrounds removed — all PNGs now have transparent backgrounds | `src/assets/*.png`, `public/icon.png` |

## Changes (v1.14.0 — 2026-02-13)

| Change | File |
|--------|------|
| Added: Real CHROMADON dragon crest logo in TitleBar (replaces generic hexagon SVG) | `src/components/TitleBar.tsx` |
| Added: Cinematic dragon crest reveal animation on SplashScreen | `src/components/SplashScreen.tsx` |
| Added: Baby dragon mascot on welcome screen (replaces globe emoji) | `src/App.tsx` |
| Added: Barrios A2I branding footer in Settings modal | `src/components/SettingsModal.tsx` |
| Fixed: Electron window icon now uses real dragon crest PNG (256x256) | `public/icon.png`, `electron/main.ts` |
| Fixed: electron-builder win.icon configured for proper installer branding | `package.json` |
| Added: 7 logo assets (dragon crest, baby dragon, full dragon, Barrios A2I) | `src/assets/` |

## Changes (v1.13.4 — 2026-02-13)

| Change | File |
|--------|------|
| Added: Email crash alerts via Resend.com — notifies Gary when a client's brain exhausts all restart attempts | `electron/main.ts` |

## Changes (v1.13.3 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Brain dist agents compiled with correct decorator settings (tier1/tier4 were missing) | `resources/brain/dist/agents/*` |
| Fixed: Production `.env` — `NODE_ENV=production`, removed empty `ANTHROPIC_API_KEY` override | `resources/brain/.env` |

## Changes (v1.13.2 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Brain bundle had stale dist with deprecated Haiku model — full rebuild + clean copy | `resources/brain/dist/*` |
| Fixed: 4 additional `claude-3-5-haiku-latest` refs in ai-engine-v3.ts + document-processor.ts | Brain: `ai-engine-v3.ts`, `document-processor.ts` |
| Fixed: Auto-updater failing for clients — repo was private, now public | GitHub repo visibility |

## Changes (v1.13.1 — 2026-02-13)

| Change | File |
|--------|------|
| Fixed: Deprecated `claude-3-5-haiku-latest` → `claude-haiku-4-5-20251001` across all agent tiers | Brain: `interview-engine.ts`, `tier0/1/4`, `vision-client.ts` |
| Fixed: JSON parse crash from control characters in AI responses | Brain: `ai-engine-v3.ts` |
| Fixed: RAG/RAG-powered terminology banned from ALL responses (was only social posts) | Brain: `orchestrator-system-prompt.ts` |
| Added: YouTube test suite (12 prompts, 3 phases: API tools, Studio nav, content) | Brain: `test-youtube.mjs` |
| Fixed: `/tabs/scroll/:id` uses `behavior: 'instant'` + verifies scrollTop; keyboard fallback | `electron/main.ts` |
| Fixed: Interview panel scroll (`h-0` + `flex-shrink-0`) | `src/components/interview/InterviewChat.tsx`, `InterviewScreen.tsx` |

---

## CRITICAL: BROWSER AUTOMATION RULES

### NEVER USE THESE (FORBIDDEN)
```
- chromadon MCP tools (take_screenshot, click, fill, navigate, etc.)
- CDP Chrome (--remote-debugging-port=9222)
- External Chrome browser
- Any browser outside CHROMADON Desktop app
- Playwright/Puppeteer connecting to external browsers
```

**WHY:** The `chromadon` MCP tools connect to an EXTERNAL Chrome browser via CDP protocol on port 9222. This is NOT the CHROMADON Desktop app. Using these tools means you're controlling a completely separate browser that has nothing to do with our app.

### ALWAYS USE THESE (REQUIRED)
```
- Desktop Control Server API (http://127.0.0.1:3002)
- Brain API (http://127.0.0.1:3001) with mode: "DESKTOP"
- test-sse.mjs script for chat testing
- test-social.mjs script for social media testing
```

**WHY:** The CHROMADON Desktop app IS the browser. It has built-in BrowserViews (Electron's embedded browser tabs) that the Brain API controls directly in DESKTOP mode.

| WRONG (chromadon MCP) | RIGHT (Desktop API) |
|-------------------------|----------------------|
| `chromadon - take_screenshot` | `curl http://127.0.0.1:3002/screenshot` |
| `chromadon - click` | `node test-sse.mjs "Click the button"` |
| `chromadon - navigate` | `node test-sse.mjs "Go to google.com"` |
| Uses external Chrome on port 9222 | Uses Desktop BrowserViews on port 3002 |

---

## HOW TO TEST BROWSER FUNCTIONALITY

### Test 1: Verify Brain API is in DESKTOP mode
```powershell
curl http://127.0.0.1:3001/health
# MUST show: "mode": "DESKTOP"
# If shows "CDP", restart services
```

### Test 2: Test AI Chat (controls Desktop BrowserViews)
```powershell
cd C:\Users\gary\chromadon-brain
node test-sse.mjs "What page am I on right now?"
```

### Test 3: Test Navigation in Desktop App
```powershell
cd C:\Users\gary\chromadon-brain
node test-sse.mjs "Open a new tab and go to google.com"
```

### Test 4: Test Social Media Overlord
```powershell
cd C:\Users\gary\chromadon-brain
node test-social.mjs single
```

### Test 5: Visual Verification via Desktop Control Server
```powershell
# Get Desktop app state including tabs
curl http://127.0.0.1:3002/state

# Get session info
curl http://127.0.0.1:3002/sessions
```

---

## DESKTOP CONTROL SERVER API (PORT 3002)

### Available Endpoints:
```
GET  /health          - Check if Desktop app is running
GET  /state           - Get current state (tabs, active tab, etc.)
GET  /sessions        - Get platform sessions (LinkedIn, Twitter, etc.)
GET  /queue           - Marketing queue state
POST /tabs/create     - Create new BrowserView tab
POST /tabs/navigate   - Navigate a tab to URL
POST /tabs/close      - Close a tab
GET  /screenshot      - Take screenshot of Desktop window
```

---

## CRITICAL: NEVER KILL NODE PROCESSES GLOBALLY

**ABSOLUTELY FORBIDDEN:**
```
taskkill /F /IM node.exe
taskkill /F /IM electron.exe
Stop-Process -Name 'node'
Stop-Process -Name 'electron'
```

These commands kill ALL Node/Electron processes on the system, destroying user sessions.

### CORRECT WAY TO RESTART THE APP

1. **Find the specific PID first:**
```powershell
netstat -ano | findstr :5173
netstat -ano | findstr :3002
```

2. **Kill only that specific PID:**
```powershell
taskkill /F /PID <pid>
```

3. **Or use the Control Server to restart:**
```bash
curl -X POST http://localhost:3002/restart
```

### IF APP WON'T START (port in use)
1. Find what's using the port: `netstat -ano | findstr :<port>`
2. Kill ONLY that PID: `taskkill /F /PID <pid>`
3. Then start the app

---

## STARTUP SEQUENCE

1. **Start Brain API first:**
   ```powershell
   cd C:\Users\gary\chromadon-brain; npm run start:api
   ```

2. **Start Desktop App second:**
   ```powershell
   cd C:\Users\gary\chromadon-desktop; npm run dev
   ```

3. **Verify DESKTOP mode:**
   ```powershell
   curl http://127.0.0.1:3001/health
   # MUST show "mode": "DESKTOP"
   ```

---

## Architecture

```
CHROMADON Desktop v1.0
├── Electron Main Process (electron/main.ts ~2500 lines)
│   ├── BrowserView Manager (session partitions)
│   ├── Express Control Server (:3002)
│   ├── 49 IPC Handlers (context-isolated)
│   ├── AES-256-GCM Encrypted Vault (PBKDF2 600K iterations)
│   └── Marketing Queue System
│
├── React Renderer (src/)
│   ├── App.tsx - Main UI with vault lock/unlock
│   ├── Zustand Store (chromadonStore.ts, 40+ state fields)
│   ├── useChromadonAPI Hook (Brain API integration)
│   ├── useStreamingChat Hook (SSE streaming for Orchestrator)
│   ├── ErrorBoundary (cyberpunk-styled crash recovery)
│   └── MarketingQueue Component
│
├── Preload Bridge (electron/preload.ts)
│   ├── 58 exposed methods via contextBridge
│   ├── ipcRenderer.invoke() for request/response
│   └── Cleanup functions on all event listeners
│
└── Brain API Connection (:3001)
    ├── All AI commands proxied through useChromadonAPI
    ├── Agentic Orchestrator (SSE streaming chat)
    └── Social Media Overlord (task processing)
```

### Platform Sessions

| Platform | Partition | Status |
|----------|-----------|--------|
| Google | persist:platform-google | Authenticated |
| Twitter | persist:platform-twitter | Authenticated |
| LinkedIn | persist:platform-linkedin | Authenticated |

---

## Production Audit (2026-02-06)

### Fixes Deployed (Commit `34e1ef1`)

| # | Fix | File |
|---|-----|------|
| 1 | React ErrorBoundary with cyberpunk error UI | `src/components/ErrorBoundary.tsx` |
| 2 | 5 preload listeners return cleanup functions | `electron/preload.ts` |
| 3 | Vault lock/unlock listener cleanup | `src/App.tsx` |
| 4 | Queue listener cleanup | `src/App.tsx`, `src/components/MarketingQueue.tsx` |
| 5 | IPC input validation on tab:execute | `electron/main.ts` |
| 6 | HTTP input validation on /tabs/execute | `electron/main.ts` |
| 7 | AbortController for in-flight API requests | `src/hooks/useChromadonAPI.ts` |
| 8 | brainApiWarned moved to useRef (stale closure fix) | `src/hooks/useChromadonAPI.ts` |
| 9 | Observation responses displayed in action log | `src/hooks/useChromadonAPI.ts` |
| 10 | useStreamingChat stale closure fix (isConnected) | `src/hooks/useStreamingChat.ts` |

### Security (7/10)

**Good:**
- `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`
- contextBridge scopes all 49 IPC channels
- `ipcRenderer.invoke()` (not `.send()`)
- Vault: AES-256-GCM + PBKDF2 600K iterations
- `tabExecute` validates against dangerous patterns (require, process.env, child_process)

**Concerns:**
- Anti-detection UA spoofing (`app.setName('Google Chrome')`)
- Control server on :3002 has no auth (localhost-only mitigates)

### Key Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | Electron main process, IPC handlers, control server |
| `electron/preload.ts` | Context bridge (58 methods) |
| `src/App.tsx` | Main React component |
| `src/store/chromadonStore.ts` | Zustand state (40+ fields) |
| `src/hooks/useChromadonAPI.ts` | Brain API integration hook |
| `src/hooks/useStreamingChat.ts` | SSE streaming for Orchestrator chat |
| `src/components/ErrorBoundary.tsx` | Crash recovery UI |
| `src/components/ChatPanel.tsx` | AI Chat panel UI |
| `src/components/MarketingQueue.tsx` | Marketing automation queue |

---

**Last Updated:** 2026-02-14
**Version:** 1.19.3 (Anthropic billing bounce-back to Gemini)
**Author:** Barrios A2I (Gary Barrios)

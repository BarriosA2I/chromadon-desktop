# CHROMADON Desktop - Claude Code Instructions

**Project:** Electron Desktop Shell for CHROMADON Browser Automation
**Author:** Barrios A2I (Gary Barrios)
**Stack:** Electron 28 + React 18 + TypeScript + Vite
**Status:** Production Ready | **Audit Score: 6.6/10 (B-) - 2026-02-06**

---

## Pre-Release Smoke Test (REQUIRED before every version bump)

Run these 5 checks in Desktop dev mode BEFORE building installer:

1. **Chat works** — Send "hello" in AI assistant → get a response (not "temporarily unavailable")
2. **Tools work** — Send "open linkedin" → browser navigates successfully
3. **Schedule works** — Send "schedule a facebook post for 2 min from now about AI" → task accepted
4. **Execution works** — Wait 2 min → check brain.log for task execution → confirm post content was generated AND typed into composer
5. **No regressions** — Check brain.log for errors, [PROVIDER] warnings, [TheScheduler] failures

If ANY check fails, DO NOT release. Fix and re-test.

---

## Recent Changes (v1.31.1 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.16.1 — AI Assistant reported wrong connected platforms. Onboarding system prompt no longer says "Connected platforms" (stale file data), now says "Platforms user mentioned" with pointer to live auth. `onboarding_get_state` tool now includes `liveAuth` array from Desktop `/sessions` endpoint | `resources/brain/dist/` |

## Changes (v1.31.0 — 2026-02-18)

| Change | File |
|--------|------|
| ARCHITECTURE: Brain v1.16.0 — 27-Agent System WIRED END-TO-END. Re-enabled `cortex_planning` route in CortexRouter. Compound browser tasks (2+ actions) now execute via TheCortex DAG planning → TheTemporalSequencer → EventBus RPC → ChromadonAgentSystem → CDP. Per-step monolithic fallback if agent step fails. SkillMemory injected into TheCortex for informed planning. TheLearningEngine persists to SkillMemory, closing the learning loop | `resources/brain/dist/` |

## Changes (v1.30.24 — 2026-02-18)

| Change | File |
|--------|------|
| Added: `container` parameter to `/tabs/click` and `/tabs/type` endpoints. When provided, all 4 click strategies (css_deep, text_deep, testid, partial_text) and type focus targeting are scoped to that container element via `container.querySelector()` instead of `document.querySelector()`. Eliminates feed noise: "Post" text matches only within composer dialog, textbox targeting only finds composer's textbox. Brain v1.15.24: scheduler passes `container=div[role="dialog"]` for all post-compose actions, polls for container instead of fixed delays, clicks media button before upload per platform | `electron/main.ts`, `resources/brain/dist/` |

## Changes (v1.30.23 — 2026-02-18)

| Change | File |
|--------|------|
| ARCHITECTURE: Brain v1.15.23 — Eliminated LLM from scheduled post browser automation. Scheduler now calls Desktop HTTP endpoints directly (`/tabs/platform`, `/tabs/click`, `/tabs/type`, `/tabs/upload`) — zero Gemini involvement for posting. Platform configs define text-based click targets + CSS fallbacks for Facebook, LinkedIn, Twitter. Falls back to LLM path if direct post fails. Fixes 8 consecutive failures (v1.15.15–v1.15.22) where Gemini misinterpreted English browser instructions | `resources/brain/dist/` |

## Changes (v1.30.22 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.22 — Gemini MALFORMED_FUNCTION_CALL: outputting Python code instead of proper function calls for scheduling. CortexRouter scheduling route now uses `forceToolCall: true` + `allowedToolNames` (7 scheduler tools only), preventing Gemini from emitting Python code. Improved `parseMalformedFunctionCall()` recovery for truncated messages. Fixed contradictory media upload instructions in system prompt (now text-first, no button clicking) | `resources/brain/dist/` |

## Changes (v1.30.21 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.21 — Removed ALL click-to-upload steps from scheduler. AI was clicking 7 elements (Photo/video, Add Photo/Video, input[type='file'], etc.) opening native file dialog. upload_file now runs with NO selector — finds file input via CDP directly. Explicit "Do NOT click any upload button" in instruction footer | `resources/brain/dist/` |

## Changes (v1.30.20 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: upload_file opened native Windows file dialog that blocked LinkedIn Post button. `/tabs/upload` handler now uses CDP `Page.setInterceptFileChooserDialog` to prevent native dialogs. Clicks upload button internally with interception, then sets files via `DOM.setFileInputFiles`. Dispatches change/input events for React sites | `electron/main.ts` |
| Fixed: Brain v1.15.20 — Merged separate click+upload_file steps in scheduler into single upload_file call with platform-specific CSS selector. No more native dialog from separate click | `resources/brain/dist/` |

## Changes (v1.30.19 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.19 — LinkedIn scheduled posts stuck in loop clicking non-existent "Add media" 13+ times. buildPostingInstruction now uses platform-specific media button text (LinkedIn="Add a photo", Facebook="Photo/video"). Added stuck-loop detection in scheduler (warns on 3+ identical tool calls). Updated SkillMemory LinkedIn rule to "Type text FIRST" | `resources/brain/dist/` |

## Changes (v1.30.18 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.18 — AI couldn't interact with arbitrary websites. CortexRouter now context-aware (checks current page URL before routing to API). System prompt allows page discovery for unfamiliar sites. New GENERAL BROWSER INTERACTION section teaches search/form patterns for any website | `resources/brain/dist/` |

## Changes (v1.30.17 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.17 — Scheduled posts had image and text in separate boxes. Reversed order: type text FIRST into clean composer, then upload image. Uploading first changed Facebook DOM | `resources/brain/dist/` |

## Changes (v1.30.16 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.16 — Scheduled posts STILL not typing text. Step 6 was too vague for FAST-tier Gemini ("Click and type" instead of "Call type_text with selector=... and text=..."). Now all posting steps explicitly name tools + params with inline content. Added tool call logging to scheduler for debugging | `resources/brain/dist/` |

## Changes (v1.30.15 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.15 — Scheduled posts missing text content. Tasks with pre-provided content got no step-by-step browser commands. Now all social_post tasks get explicit browser instruction builder at execution time (navigate → compose → upload → wait → type EXACT content → Post) | `resources/brain/dist/` |

## Changes (v1.30.14 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.14 — Scheduler zombie recovery (stuck `executing` tasks reset to `pending` on startup), 5-min execution timeout prevents hanging, task pruning cleans 236→50 accumulated tasks, heartbeat diagnostics every 60s | `resources/brain/dist/` |

## Changes (v1.30.13 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.13 — Tool-level Gemini calls (client_get_voice, preGenerateContent, all 27 agents) had zero retry protection. Added `withGeminiRetry` wrapper to all 5 helper functions (llm-helper.ts + gemini-llm.ts) protecting 15+ call sites with 429 backoff (5s, 10s) | `resources/brain/dist/` |

## Changes (v1.30.12 — 2026-02-18)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.12 — Gemini 429 still caused instant "temporarily unavailable" when Anthropic dead. Added exponential backoff retry for 429s (5s, 10s) + 2s minimum spacing between Gemini API calls to prevent burst rate limits | `resources/brain/dist/` |

## Changes (v1.30.11 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.11 — "I'm temporarily unavailable" after few messages: `anthropicDead` flag never reset after Anthropic billing error. Added 5-min cooldown + Gemini retry for non-429 errors. Scheduler falsely marked tasks COMPLETED on provider failure: now validates error events and empty results before marking complete. maxRetries increased to 3 | `resources/brain/dist/` |

## Changes (v1.30.10 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Panel overlay — added `showVaultModal` to BrowserView hide trigger (MasterPasswordModal wasn't hiding BrowserView). Removed `showProfileManager` from trigger (dropdown shouldn't collapse entire browser). Fixed DocumentVault/StrategyDashboard z-index from z-40 to z-50 for consistency | `src/App.tsx` |
| Fixed: Brain v1.15.10 — Scheduled LinkedIn posts stuck on image uploads. All instruction paths now explicitly say "Call wait with seconds=3" after upload_file instead of vague "Wait for preview". upload_file result message changed to directive | `resources/brain/dist/` |

## Changes (v1.30.9 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.9 — "could not access the specified channel or stream key" on Facebook Live. `configureStream()` dropped `server` param for `rtmp_common`, causing OBS to use wrong Facebook ingest server. Now passes server URL so OBS uses the correct endpoint matching the stream key | `resources/brain/dist/` |

## Changes (v1.30.8 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.8 — OBS Facebook Live streaming: `rtmp_custom` cannot do RTMPS (TLS fails silently). Now uses `rtmp_common` for Facebook Live only (OBS handles RTMPS internally), `rtmp_custom` for everything else. Confirmed working: Facebook Live Producer shows green checkmark on "Connect video source" | `resources/brain/dist/` |

## Changes (v1.30.7 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.7 — OBS "failed to connect to server" on Facebook Live. configureStream() hardcoded rtmp_custom — Facebook requires RTMPS. Now uses rtmp_common for known platforms (Facebook Live, YouTube, Twitch). Added Facebook preset stream config. Fixed YouTube RTMPS URL | `resources/brain/dist/` |

## Changes (v1.30.6 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.6 — AI set placeholder stream keys ("YOUR_STREAM_KEY_HERE"). Now navigates to platform stream key page and helps user find real key | `resources/brain/dist/` |

## Changes (v1.30.5 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.5 — `obs_stream_start` falsely reported success when OBS failed (missing stream key, encoder error). Now pre-checks stream key, waits 2.5s, verifies stream is actually active. Same pattern for `startRecording()` | `resources/brain/dist/` |

## Changes (v1.30.4 — 2026-02-17)

| Change | File |
|--------|------|
| Added: Brain v1.15.4 — `close_tab` and `close_all_tabs` browser tools. AI assistant can now close individual tabs by ID or all open tabs at once when clients ask | `resources/brain/dist/` |

## Changes (v1.30.3 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.3 — "selectedModel is not defined" crash when Gemini 429 triggers catch block before selectedModel was assigned. Variable hoisted out of try block scope | `resources/brain/dist/` |

## Changes (v1.30.2 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.2 — `obs_get_current_preset` FPS field mismatch: read `fpsNumerator` but `getSettings()` stores it as `fps`. Preset matching and custom preset saving now work correctly | `resources/brain/dist/` |

## Changes (v1.30.1 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: Brain v1.15.1 — `yt_studio_session_check` always reported "No Google session" even when signed in. Executor now correctly parses `/sessions` array response, uses `isAuthenticated` field, shows account name/email, and forces fresh cookie verification before checking | `resources/brain/dist/` |

## Changes (v1.30.0 — 2026-02-17)

| Change | File |
|--------|------|
| Updated: Brain dist v1.15.0 — YOUTUBE STUDIO AUTOMATION: 5 new Shadow DOM-piercing tools (yt_studio_navigate, yt_studio_video_list, yt_studio_copyright_check, yt_studio_erase_song, yt_studio_session_check). OBS STREAMING PRESETS: 4 new tools (obs_apply_preset, obs_list_presets, obs_get_current_preset, obs_create_custom_preset) with YouTube VP9 1440p hack, Twitch/Kick/Facebook presets. CortexRouter: YouTube Studio intent route at priority 78. Total tools: 114+ | `resources/brain/dist/` |

## Changes (v1.29.6 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: OBS Launch — OBS died immediately after spawn (ghost tray icon). Root causes: `--minimize-to-tray` conflicted with first-run wizard, no `cwd` set, no PID verification, Electron env vars leaked into OBS. Now: removed minimize-to-tray, added cwd to OBS bin dir, clean env (no ELECTRON_* vars), already-running check, 5s PID alive verification. Brain v1.14.6: WebSocket reconnect after launch | `electron/main.ts`, `resources/brain/` |

## Changes (v1.29.5 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain crashed on startup: `ReferenceError: Cannot access 'log' before initialization` in tier3-specialists. otplib ESM catch block used pino logger before it was defined (temporal dead zone). Changed to console.warn. Brain v1.14.5 | `resources/brain/` |

## Changes (v1.29.4 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain crashed on startup in packaged Electron. `pino-http@11` brought nested `pino@10.3.1` calling `diagChan.tracingChannel()` (Node 20+ only). Electron 28 runs Node 18.18.2. Downgraded `pino-http` from 11→10.5 in Brain dist. Brain now starts cleanly on Electron's Node 18 | `resources/brain/` |

## Changes (v1.29.3 — 2026-02-17)

| Change | File |
|--------|------|
| Updated: Brain dist v1.14.3 — Fixed Gemini 0-token responses for OBS tools: added `toolConfig.functionCallingConfig` with `mode: "ANY"` + `allowedFunctionNames` restricted to 19 OBS tools. OBS intent priority raised to 76 (above conversational). OBS tools now work on first API call | `resources/brain/dist/` |

## Changes (v1.29.2 — 2026-02-17)

| Change | File |
|--------|------|
| Added: POST /obs/launch endpoint — Spawns OBS Studio from known install paths (Program Files, AppData). Detached process, returns PID. Handles OBS-not-found and launch errors gracefully | `electron/main.ts` |
| Updated: Brain dist v1.14.2 — 10 new OBS configuration tools (stream setup, video settings, recording config, scene/source management, settings inspection, OBS launch). Total OBS tools: 19 | `resources/brain/dist/` |

## Changes (v1.29.1 — 2026-02-17)

| Change | File |
|--------|------|
| Updated: Brain dist v1.14.1 — System prompt completeness fix: corporate banned phrases, forbidden responses, smart CTAs, capability de-duplication, strengthened formatting enforcement (zero markdown/bold/emoji in chat) | `resources/brain/dist/` |

## Changes (v1.29.0 — 2026-02-17)

| Change | File |
|--------|------|
| Updated: Brain dist v1.14.0 — STRUCTURED LOGGING: All 544 console.log instances replaced with pino structured JSON logging (domain-scoped children, redaction, correlation IDs, pino-http middleware). URL sanitization for navigate tool. Compound instruction decomposition. Stronger onboarding greeting. Contextual personalization rules | `resources/brain/dist/` |

## Changes (v1.28.1 — 2026-02-17)

| Change | File |
|--------|------|
| Fixed: CRIT-1 — `brain-status` IPC event now wired through preload context bridge. Added `onBrainStatus(callback)` listener in preload.ts + type declaration. SettingsModal.tsx now receives real-time Brain lifecycle updates via event instead of polling only | `electron/preload.ts`, `src/components/SettingsModal.tsx` |
| Updated: Brain dist v1.13.1 — CRIT-2 fix: 28 Playwright-era endpoints guarded with `requirePlaywright` middleware, return 400 in DESKTOP mode instead of 500 | `resources/brain/dist/` |

## Changes (v1.28.0 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.13.0 — CLIENT EXPERIENCE ENGINE: Activity Log (3 tools, JSONL daily journal with 30-day retention + context guard), Guided Onboarding (3 tools, 5-step flow injected into system prompt), Mission Templates (4 tools, 10 pre-built templates with dynamic file-based loading), Proof of Work (2 tools, evidence packages with 30-day/1GB retention), Scheduler enhancements (busy lock, schedule_toggle, auto-disable after 3 failures, missed-run detection). 13 new tools, total 105 | `resources/brain/dist/` |

## Changes (v1.27.0 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.12.0 — AUTONOMY ENGINE: visual_verify tool (AI vision post-action verification), policy_check tool (regex risk gate SAFE/RISKY/FORBIDDEN), Skill Memory v2.1 (drift detection, per-task stats, versioning, rollback, compact summary), client_save_info tool (auto-persist business context), default client auto-creation, system prompt RULE #1B-#1E, skill diagnostics in /api/system/diagnostics | `resources/brain/dist/` |

## Changes (v1.26.8 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.11.7 — Added structured routing logs (route name, priority, timing), provider health getter, expanded diagnostics endpoint with active client, provider health, and last route decision | `resources/brain/dist/` |

## Changes (v1.26.7 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.11.6 — Fixed provider fallback dead-end: Gemini 429 now tries different model (different rate bucket) before failing over, Anthropic marked dead on billing/auth error to prevent bounce loops, all user-facing error messages sanitized (no more "Settings" or "API key" references) | `resources/brain/dist/` |

## Changes (v1.26.6 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: CRITICAL — better-sqlite3 NODE_MODULE_VERSION mismatch in packaged builds. Native module was compiled for Node 24 (ABI 137) but Electron 28 needs Node 18 (ABI 119). Added `@electron/rebuild` step (Step 3.5) to `build-brain.js` that rebuilds better-sqlite3 for Electron's Node ABI. Fixes Analytics DB, MissionRegistry, and BudgetMonitor failing on production installs | `scripts/build-brain.js` |
| Fixed: Native module self-test now uses Electron binary (`process.execPath`) in packaged mode instead of bare `node`, accurately detecting ABI mismatches before Brain startup | `electron/brain/brain-lifecycle-manager.ts` |
| Added: `@electron/rebuild` devDependency for native module rebuilding | `package.json` |

## Changes (v1.26.5 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: ROOT CAUSE — Brain v1.11.5 — Disabled `cortex_planning` catch-all route entirely (`match: () => false`). 27-agent system can't execute (EventBus not wired). Was wasting Gemini API call + latency on every unmatched message. All unmatched messages now go straight to monolithic orchestrator. Added default monolithic fallback in `chat()` for unmatched routes | `resources/brain/dist/` |

## Changes (v1.26.4 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain v1.11.4 — ALL chat commands returned "Completed 0 steps" — CortexRouter catch-all silently "succeeded" with empty DAGs, never falling back to working monolithic orchestrator. Now validates DAG nodes before execution + checks step count after — both trigger monolithic fallback on failure | `resources/brain/dist/` |

## Changes (v1.26.3 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.11.3 — CRITICAL fix: Browser navigation commands ("open my linkedin, facebook and twitter") no longer fall through to Cortex DAG planner. Added `isBrowserNavigation()` route (priority 65) + `resolveUrl()` noise word stripping. Multi-platform and alt-verb navigation now routes to monolithic orchestrator | `resources/brain/dist/` |

## Changes (v1.26.2 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.11.2 — CRITICAL fix: Scheduling messages no longer fall through to Cortex DAG planner. Added `isSchedulingIntent()` route (priority 55) in CortexRouter that sends schedule/cancel/list-tasks messages directly to monolithic orchestrator with `schedule_post` tool. Prevents "Completed 0 steps" and "Done." stubs on scheduling requests | `resources/brain/dist/` |

## Changes (v1.26.1 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.11.1 — CRITICAL fix: "draft a LinkedIn post" no longer auto-schedules. Added draft verb detection, RULE #0D confirmation gate, removed auto-post from custom actions. Also fixed BudgetMonitor `selectedModel` ReferenceError and CortexRouter "Done." stub responses | `resources/brain/dist/` |

## Changes (v1.26.0 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.11.0 — Mega sprint: MissionRegistry, BudgetMonitor, PulseBeacon, API Security, Request ID, SessionWarmup, Diagnostics, ErrorChannel, Content Approval, Analytics Export, Semantic Embeddings. 15 new files, 15+ new REST endpoints | `resources/brain/dist/` |

## Changes (v1.25.21 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.10.18 — Added `cancel_all_scheduled_tasks` bulk cancel tool. Atomic single-pass cancellation fixes race condition where one-by-one cancel raced against scheduler tick loop. Verified: 14/14 tasks cancelled in production test | `resources/brain/dist/` |

## Changes (v1.25.20 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: Console window flashing on startup — `windowsHide: true` added to Brain fork() and all execSync() calls (netstat, taskkill, native module test). Prevents visible command prompt windows on Windows | `electron/brain/brain-lifecycle-manager.ts` |

## Changes (v1.25.19 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain dist v1.10.17 — TheTemporalSequencer async generator crash fixed (`@traced` decorator removed) + DAG normalization for LLM output (nodes object→array, field name mapping). Sequencer now executes DAG steps successfully | `resources/brain/dist/` |

## Changes (v1.25.18 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.10.16 — Switched 27-Agent System from Anthropic to Gemini. All agents now use Gemini LLM (flash/2.5-flash/2.5-pro) with Anthropic fallback. Eliminates auth failures from empty Anthropic credits — Cortex planning now works end-to-end | `resources/brain/dist/` |

## Changes (v1.25.17 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.10.15 — CortexRouter routing fix: simple questions no longer misclassified as social media tasks. Added conversational classifier, word-boundary platform detection, requires explicit action verb | `resources/brain/dist/` |

## Changes (v1.25.16 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain crash-loop in packaged mode (`EPERM: mkdir` in Program Files) — multer upload dir and skills.json path used `process.cwd()` which is read-only. Now uses `CHROMADON_DATA_DIR` env var | `resources/brain/dist/` |
| Updated: Brain dist v1.10.14 — includes CortexRouter fix + EPERM fix | `resources/brain/dist/` |

## Changes (v1.25.15 — 2026-02-16)

| Change | File |
|--------|------|
| Updated: Brain dist v1.10.13 — CRITICAL fix: CortexRouter + 27-Agent System now actually initializes. `server.ts` was loading stale compiled agents via `require()` instead of TypeScript import. All chat requests now route through tiered agent system instead of monolithic orchestrator fallback | `resources/brain/dist/` |

## Changes (v1.25.14 — 2026-02-16)

| Change | File |
|--------|------|
| Refactored: Extracted BrainLifecycleManager from main.ts — 730 lines moved to dedicated class with EventEmitter pattern, typed events, injected dependencies | `electron/brain/brain-lifecycle-manager.ts` (NEW) |
| Refactored: Extracted ApiKeyManager from main.ts — DPAPI key storage, Anthropic + Gemini support, safeStorage injection | `electron/brain/api-key-manager.ts` (NEW) |
| Added: Shared Brain types — BrainStage, BrainStatusEvent, BrainConfig, DEFAULT_BRAIN_CONFIG | `electron/brain/types.ts` (NEW) |
| Added: Build script for Brain compilation, dist copy, ESM patches, model string updates, critical file verification | `scripts/build-brain.js` (NEW) |
| Added: `build:brain` npm script | `package.json` |

## Changes (v1.25.13 — 2026-02-16)

| Change | File |
|--------|------|
| Fixed: CRITICAL — Brain never started in dev mode (`npm run dev`) — `startBrainServer()` had early return when `!app.isPackaged`. Now forks Brain from source repo `chromadon-brain/dist/` and loads Brain's `.env` for API keys | `electron/main.ts` |
| Fixed: CRITICAL — 90s hard timeout on Brain startup with staged progress messages (Starting Brain → Connecting to AI → Initializing AI tools → Ready/Failed) sent via `brain-status` IPC | `electron/main.ts` |
| Fixed: CRITICAL — Health checks now run every 5s for first 2 minutes after Brain fork (was 30s) — catches init failures 6x faster, then relaxes to 30s | `electron/main.ts` |
| Added: Brain log file with rotation — `brain.log` + `brain.log.1` in userData, max 5MB, rotated on startup. Replaces `brain-debug.log` | `electron/main.ts` |
| Updated: Brain dist v1.10.12 — 5 orchestrator retries with full init, YouTube OAuth callback endpoint | `resources/brain/dist/` |

## Changes (v1.25.12 — 2026-02-15)

| Change | File |
|--------|------|
| Fixed: CRITICAL — `/screenshot` endpoint captured main window React background (always dark/black) instead of active BrowserView tab content — now correctly captures the active tab via `browserViewManager.getScreenshot()` | `electron/main.ts` |
| Added: `webgl: true` and `spellcheck: true` to BrowserView webPreferences — prevents WebGL-dependent pages from failing to render | `electron/browser-view-manager.ts` |
| Added: `render-process-gone` crash handler on BrowserViews — auto-reloads tab after 1s on GPU/renderer crash instead of showing black screen | `electron/browser-view-manager.ts` |
| Added: `did-fail-load` handler on BrowserViews — logs load failures for diagnostics | `electron/browser-view-manager.ts` |
| Updated: Brain dist v1.10.11 — multi-step task throttle, increased Gemini retry tolerance, generalized autonomous task system prompt | `resources/brain/dist/` |

## Changes (v1.25.11 — 2026-02-15)

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

> **Older changelog:** See `CHANGELOG.md` for versions v1.25.8 and earlier.

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
```

### Test 2: Test AI Chat
```powershell
cd C:\Users\gary\chromadon-brain
node test-sse.mjs "What page am I on right now?"
```

### Test 3: Test Navigation
```powershell
node test-sse.mjs "Open a new tab and go to google.com"
```

### Test 4: Test Social Media Overlord
```powershell
node test-social.mjs single
```

### Test 5: Desktop state
```powershell
curl http://127.0.0.1:3002/state
curl http://127.0.0.1:3002/sessions
```

---

## DESKTOP CONTROL SERVER API (PORT 3002)

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

### CORRECT WAY TO RESTART THE APP

1. Find the specific PID: `netstat -ano | findstr :5173` or `netstat -ano | findstr :3002`
2. Kill only that PID: `taskkill /F /PID <pid>`
3. Or use: `curl -X POST http://localhost:3002/restart`

---

## STARTUP SEQUENCE

1. Start Brain API first: `cd C:\Users\gary\chromadon-brain; npm run start:api`
2. Start Desktop App second: `cd C:\Users\gary\chromadon-desktop; npm run dev`
3. Verify DESKTOP mode: `curl http://127.0.0.1:3001/health`

---

## Architecture

```
CHROMADON Desktop v1.0
├── Electron Main Process (electron/main.ts ~4350 lines)
│   ├── BrowserView Manager (session partitions)
│   ├── Express Control Server (:3002)
│   ├── 49 IPC Handlers (context-isolated)
│   ├── AES-256-GCM Encrypted Vault (PBKDF2 600K iterations)
│   └── Marketing Queue System
├── Brain Process Management (electron/brain/)
│   ├── BrainLifecycleManager — fork, health checks, restart, crash recovery
│   ├── ApiKeyManager — DPAPI-encrypted Anthropic + Gemini key storage
│   └── Types — BrainConfig, BrainStatusEvent, BrainStage
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

### Security (7/10)

**Good:**
- `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`
- contextBridge scopes all 49 IPC channels
- Vault: AES-256-GCM + PBKDF2 600K iterations
- `tabExecute` validates against dangerous patterns

**Concerns:**
- Anti-detection UA spoofing (`app.setName('Google Chrome')`)
- Control server on :3002 has no auth (localhost-only mitigates)

### Key Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | Electron main process, IPC handlers, control server |
| `electron/brain/brain-lifecycle-manager.ts` | Brain process lifecycle (fork, health, restart) |
| `electron/brain/api-key-manager.ts` | Anthropic + Gemini key storage (DPAPI) |
| `electron/brain/types.ts` | Brain shared types and config defaults |
| `electron/preload.ts` | Context bridge (58 methods) |
| `electron/browser-view-manager.ts` | BrowserView tab management |
| `electron/session-backup.ts` | Encrypted session backup/restore |
| `src/App.tsx` | Main React component |
| `src/store/chromadonStore.ts` | Zustand state (40+ fields) |
| `src/hooks/useChromadonAPI.ts` | Brain API integration hook |
| `src/hooks/useStreamingChat.ts` | SSE streaming for Orchestrator chat |
| `src/components/ChatPanel.tsx` | AI Chat panel UI |
| `src/components/MarketingQueue.tsx` | Marketing automation queue |
| `src/components/SettingsModal.tsx` | API keys, monitoring, updates |

---

**Last Updated:** 2026-02-16
**Version:** 1.28.0
**Author:** Barrios A2I (Gary Barrios)

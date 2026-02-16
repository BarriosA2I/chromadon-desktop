# CHROMADON Desktop - Claude Code Instructions

**Project:** Electron Desktop Shell for CHROMADON Browser Automation
**Author:** Barrios A2I (Gary Barrios)
**Stack:** Electron 28 + React 18 + TypeScript + Vite
**Status:** Production Ready | **Audit Score: 6.6/10 (B-) - 2026-02-06**

---

## Recent Changes (v1.26.5 — 2026-02-16)

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
**Version:** 1.26.1
**Author:** Barrios A2I (Gary Barrios)

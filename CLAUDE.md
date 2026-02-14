# CHROMADON Desktop - Claude Code Instructions

**Project:** Electron Desktop Shell for CHROMADON Browser Automation
**Author:** Barrios A2I (Gary Barrios)
**Stack:** Electron 28 + React 18 + TypeScript + Vite
**Status:** Production Ready | **Audit Score: 6.6/10 (B-) - 2026-02-06**

---

## Recent Changes (v1.14.1 — 2026-02-13)

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

**Last Updated:** 2026-02-13
**Version:** 1.13.4 (Email crash alerts for client brain downtime)
**Author:** Barrios A2I (Gary Barrios)

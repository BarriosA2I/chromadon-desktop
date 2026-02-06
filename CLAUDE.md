# CHROMADON Desktop - Claude Code Instructions

**Project:** Electron Desktop Shell for CHROMADON Browser Automation
**Author:** Barrios A2I (Gary Barrios)
**Stack:** Electron 28 + React 18 + TypeScript + Vite
**Status:** Production Ready | **Audit Score: 6.6/10 (B-) - 2026-02-06**

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
│   ├── ErrorBoundary (cyberpunk-styled crash recovery)
│   └── MarketingQueue Component
│
├── Preload Bridge (electron/preload.ts)
│   ├── 58 exposed methods via contextBridge
│   ├── ipcRenderer.invoke() for request/response
│   └── Cleanup functions on all event listeners
│
└── Brain API Connection (:3001)
    └── All AI commands proxied through useChromadonAPI
```

### Platform Sessions

| Platform | Partition | Status |
|----------|-----------|--------|
| Google | persist:platform-google | Authenticated |
| Twitter | persist:platform-twitter | Authenticated |
| LinkedIn | persist:platform-linkedin | Authenticated |

### Control Server (:3002) Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Window ready state |
| GET | `/state` | CDP + circuit breaker + vault status |
| GET | `/sessions` | Authenticated platform sessions |
| GET | `/queue` | Marketing queue state |

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

The user may have multiple Node processes running for different projects. Killing them all destroys hours of work.

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

### Reliability (7/10, up from 5/10)

- All 5 preload listeners fixed (no more memory leaks)
- App.tsx + MarketingQueue.tsx listener cleanup
- AbortController cancels in-flight requests on unmount
- ErrorBoundary catches renderer crashes gracefully

### Known Issues

- No process supervisor for auto-restart
- `rendererState` in main.ts grows indefinitely (no pruning)
- Zustand store: 40+ fields in single flat store (re-render performance)
- No Content Security Policy headers

### Integration Tests: 19/19 PASS

See `PRODUCTION-READINESS-REPORT.md` for the full audit report.

---

## Development

```bash
# Start desktop app (requires Brain API on :3001)
npm run dev

# Build for production
npm run build

# Package
npm run package
```

### Key Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | Electron main process, IPC handlers, control server |
| `electron/preload.ts` | Context bridge (58 methods) |
| `src/App.tsx` | Main React component |
| `src/store/chromadonStore.ts` | Zustand state (40+ fields) |
| `src/hooks/useChromadonAPI.ts` | Brain API integration hook |
| `src/components/ErrorBoundary.tsx` | Crash recovery UI |
| `src/components/MarketingQueue.tsx` | Marketing automation queue |
| `src/vite-env.d.ts` | Type declarations for preload API |

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0 (Production Audited)
**Author:** Barrios A2I (Gary Barrios)

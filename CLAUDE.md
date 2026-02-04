# CHROMADON Desktop - Claude Code Instructions

## CRITICAL: NEVER KILL NODE PROCESSES GLOBALLY

**ABSOLUTELY FORBIDDEN:**
```
taskkill /F /IM node.exe
taskkill /F /IM electron.exe
Stop-Process -Name 'node'
Stop-Process -Name 'electron'
```

These commands kill ALL Node/Electron processes on the system, destroying user sessions.

## CORRECT WAY TO RESTART THE APP

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

## NEVER DO THIS
- Never run blanket taskkill on node.exe or electron.exe
- Never run Stop-Process on node or electron by name
- Never assume killing all Node processes is acceptable

## IF APP WON'T START (port in use)
1. Find what's using the port: `netstat -ano | findstr :<port>`
2. Kill ONLY that PID: `taskkill /F /PID <pid>`
3. Then start the app

## Context Preservation
The user may have multiple Node processes running for different projects. Killing them all destroys hours of work.

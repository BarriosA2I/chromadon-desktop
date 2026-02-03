/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    platform: string
  }
}

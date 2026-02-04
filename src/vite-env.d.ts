/// <reference types="vite/client" />

interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface Window {
  electronAPI: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    platform: string
    // Claude Code Control API
    onExternalCommand: (callback: (command: string) => void) => void
    sendStateUpdate: (state: any) => void
    // Embedded Tab API
    tabCreate: (url?: string) => Promise<{ success: boolean; id: number; tabs: TabInfo[] }>
    tabClose: (id: number) => Promise<{ success: boolean; tabs: TabInfo[] }>
    tabNavigate: (id: number, url: string) => Promise<{ success: boolean }>
    tabFocus: (id: number) => Promise<{ success: boolean }>
    tabBack: (id: number) => Promise<{ success: boolean }>
    tabForward: (id: number) => Promise<{ success: boolean }>
    tabReload: (id: number) => Promise<{ success: boolean }>
    tabList: () => Promise<{ success: boolean; tabs: TabInfo[] }>
    tabGetActive: () => Promise<{ success: boolean; activeTabId: number | null }>
    tabExecute: (id: number, script: string) => Promise<{ success: boolean; result?: any; error?: string }>
    tabScreenshot: (id: number) => Promise<{ success: boolean; screenshot?: string; error?: string }>
    onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => void
  }
}

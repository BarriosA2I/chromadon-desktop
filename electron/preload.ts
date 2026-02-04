import { contextBridge, ipcRenderer } from 'electron'

// Tab info type (matching browser-view-manager)
interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

// Expose protected methods for window controls
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Platform info
  platform: process.platform,

  // Claude Code Control API
  onExternalCommand: (callback: (command: string) => void) => {
    ipcRenderer.on('claude:executeCommand', (_event, command) => {
      callback(command)
    })
  },
  sendStateUpdate: (state: any) => {
    ipcRenderer.send('claude:stateUpdate', state)
  },

  // Embedded Tab API
  tabCreate: (url?: string) => ipcRenderer.invoke('tab:create', url),
  tabClose: (id: number) => ipcRenderer.invoke('tab:close', id),
  tabNavigate: (id: number, url: string) => ipcRenderer.invoke('tab:navigate', { id, url }),
  tabFocus: (id: number) => ipcRenderer.invoke('tab:focus', id),
  tabBack: (id: number) => ipcRenderer.invoke('tab:back', id),
  tabForward: (id: number) => ipcRenderer.invoke('tab:forward', id),
  tabReload: (id: number) => ipcRenderer.invoke('tab:reload', id),
  tabList: () => ipcRenderer.invoke('tab:list'),
  tabGetActive: () => ipcRenderer.invoke('tab:getActive'),
  tabExecute: (id: number, script: string) => ipcRenderer.invoke('tab:execute', { id, script }),
  tabScreenshot: (id: number) => ipcRenderer.invoke('tab:screenshot', id),

  // Tab update listener
  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => {
    ipcRenderer.on('tabs:updated', (_event, tabs) => {
      callback(tabs)
    })
  },
})

// Type definitions for the exposed API
declare global {
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
}

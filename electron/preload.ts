import { contextBridge, ipcRenderer } from 'electron'

// Explicit allowlist of every valid IPC channel in this application.
// Any invoke/on call with an unlisted channel is rejected immediately.
const ALLOWED_CHANNELS = [
  // Categories
  'categories:getAll',
  'categories:create',
  'categories:update',
  'categories:delete',
  // Items
  'items:getAll',
  'items:getFiltered',
  'items:searchAutocomplete',
  'items:getLocations',
  'items:getSimpleList',
  'items:getById',
  'items:create',
  'items:update',
  'items:adjustStock',
  'items:delete',
  // Transactions
  'transactions:getAll',
  'transactions:getFiltered',
  'transactions:getOperators',
  'transactions:getByItem',
  // Alerts
  'alerts:getActive',
  'alerts:getResolved',
  'alerts:acknowledge',
  'alerts:resolve',
  'alerts:updated',
  // BOM
  'bom:getAll',
  'bom:getDetails',
  'bom:create',
  'bom:update',
  'bom:delete',
  'bom:checkCoverage',
  // CSV
  'csv:export',
  // Settings
  'settings:getSchedulerInterval',
  'settings:setSchedulerInterval',
  'settings:runAlertScan',
  'settings:backupDB',
  'settings:resetData',
] as const

type AllowedChannel = typeof ALLOWED_CHANNELS[number]

function isAllowed(channel: string): channel is AllowedChannel {
  return ALLOWED_CHANNELS.includes(channel as AllowedChannel)
}

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, data?: any) => {
    if (!isAllowed(channel)) {
      throw new Error(`[Stockyard] Blocked IPC invoke on unknown channel: "${channel}"`)
    }
    return ipcRenderer.invoke(channel, data)
  },
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    if (!isAllowed(channel)) {
      throw new Error(`[Stockyard] Blocked IPC listener on unknown channel: "${channel}"`)
    }
    const subscription = (event: any, ...args: any[]) => callback(event, ...args)
    ipcRenderer.on(channel, subscription)

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  }
})

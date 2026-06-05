export interface ElectronAPI {
  invoke: (channel: string, data?: any) => Promise<any>
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export const ipc = {
  // Categories
  categories: {
    getAll: () => window.electron.invoke('categories:getAll'),
    create: (data: { id: string; name: string; agingDays: number; color: string }) => 
      window.electron.invoke('categories:create', data),
    update: (id: string, data: { name: string; agingDays: number; color: string }) => 
      window.electron.invoke('categories:update', { id, data }),
    delete: (id: string) => window.electron.invoke('categories:delete', id)
  },

  // Items (Components)
  items: {
    getAll: () => window.electron.invoke('items:getAll'),
    getById: (id: string) => window.electron.invoke('items:getById', id),
    create: (data: any, performedBy: string) => 
      window.electron.invoke('items:create', { data, performedBy }),
    update: (id: string, data: any) => 
      window.electron.invoke('items:update', { id, data }),
    adjustStock: (params: {
      itemId: string
      quantityChange: number
      type: 'IN' | 'OUT' | 'ADJUSTMENT'
      performedBy: string
      reference?: string
      notes?: string
    }) => window.electron.invoke('items:adjustStock', params),
    delete: (id: string) => window.electron.invoke('items:delete', id)
  },

  // Transactions
  transactions: {
    getAll: () => window.electron.invoke('transactions:getAll'),
    getByItem: (itemId: string) => window.electron.invoke('transactions:getByItem', itemId)
  },

  // Alerts
  alerts: {
    getActive: () => window.electron.invoke('alerts:getActive'),
    getResolved: () => window.electron.invoke('alerts:getResolved'),
    acknowledge: (id: string) => window.electron.invoke('alerts:acknowledge', id),
    resolve: (id: string) => window.electron.invoke('alerts:resolve', id)
  },

  // BOM Templates
  bom: {
    getAll: () => window.electron.invoke('bom:getAll'),
    getDetails: (bomId: string) => window.electron.invoke('bom:getDetails', bomId),
    create: (name: string, description: string, itemsList: { itemId: string; quantity: number }[]) => 
      window.electron.invoke('bom:create', { name, description, itemsList }),
    update: (bomId: string, name: string, description: string, itemsList: { itemId: string; quantity: number }[]) => 
      window.electron.invoke('bom:update', { bomId, name, description, itemsList }),
    delete: (bomId: string) => window.electron.invoke('bom:delete', bomId),
    checkCoverage: (bomId: string, buildCount: number) => 
      window.electron.invoke('bom:checkCoverage', { bomId, buildCount })
  },

  // CSV Export
  csv: {
    export: (defaultFilename: string, headers: string[], rows: any[][]) => 
      window.electron.invoke('csv:export', { defaultFilename, headers, rows })
  },

  // System Settings
  settings: {
    getSchedulerInterval: () => window.electron.invoke('settings:getSchedulerInterval'),
    setSchedulerInterval: (minutes: number) => window.electron.invoke('settings:setSchedulerInterval', minutes),
    runAlertScan: () => window.electron.invoke('settings:runAlertScan'),
    backupDB: () => window.electron.invoke('settings:backupDB'),
    resetData: (options: { transactions: boolean; alerts: boolean; inventory: boolean; boms: boolean }) => 
      window.electron.invoke('settings:resetData', options)
  }
}

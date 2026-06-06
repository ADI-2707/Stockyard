import { create } from 'zustand'
import { ipc } from '../lib/ipc'

interface AlertState {
  activeAlerts: any[]
  resolvedAlerts: any[]
  loadingAlerts: boolean
  
  fetchActiveAlerts: () => Promise<void>
  fetchResolvedAlerts: () => Promise<void>
  acknowledgeAlert: (id: string, performedBy?: string) => Promise<void>
  resolveAlert: (id: string, performedBy?: string) => Promise<void>
  subscribeToAlerts: () => () => void
}

export const useAlertStore = create<AlertState>((set, get) => ({
  activeAlerts: [],
  resolvedAlerts: [],
  loadingAlerts: false,

  fetchActiveAlerts: async () => {
    set({ loadingAlerts: true })
    try {
      const list = await ipc.alerts.getActive()
      set({ activeAlerts: list, loadingAlerts: false })
    } catch (error) {
      console.error('Failed to fetch active alerts:', error)
      set({ loadingAlerts: false })
    }
  },

  fetchResolvedAlerts: async () => {
    try {
      const list = await ipc.alerts.getResolved()
      set({ resolvedAlerts: list })
    } catch (error) {
      console.error('Failed to fetch resolved alert history:', error)
    }
  },

  acknowledgeAlert: async (id: string, performedBy?: string) => {
    try {
      await ipc.alerts.acknowledge(id, performedBy)
      await get().fetchActiveAlerts()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  },

  resolveAlert: async (id: string, performedBy?: string) => {
    try {
      await ipc.alerts.resolve(id, performedBy)
      await get().fetchActiveAlerts()
      await get().fetchResolvedAlerts()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  },

  subscribeToAlerts: () => {
    // Listen for push notifications from Electron Main Process
    const unsubscribe = window.electron.on('alerts:updated', () => {
      console.log('Main process pushed alert update. Refreshing client stores...')
      get().fetchActiveAlerts()
      get().fetchResolvedAlerts()
    })
    return unsubscribe
  }
}))

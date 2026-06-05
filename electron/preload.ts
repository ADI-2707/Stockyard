import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    const subscription = (event: any, ...args: any[]) => callback(event, ...args)
    ipcRenderer.on(channel, subscription)
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  }
})

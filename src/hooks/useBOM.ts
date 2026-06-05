import { useState, useCallback } from 'react'
import { ipc } from '../lib/ipc'

export function useBOM() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const list = await ipc.bom.getAll()
      setTemplates(list)
    } catch (error) {
      console.error('Failed to fetch BOM templates:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    templates,
    loading,
    fetchTemplates,
    getDetails: (bomId: string) => ipc.bom.getDetails(bomId),
    createTemplate: (name: string, description: string, itemsList: { itemId: string; quantity: number }[]) => 
      ipc.bom.create(name, description, itemsList),
    updateTemplate: (bomId: string, name: string, description: string, itemsList: { itemId: string; quantity: number }[]) => 
      ipc.bom.update(bomId, name, description, itemsList),
    deleteTemplate: (bomId: string) => ipc.bom.delete(bomId),
    checkCoverage: (bomId: string, buildCount: number) => ipc.bom.checkCoverage(bomId, buildCount)
  }
}

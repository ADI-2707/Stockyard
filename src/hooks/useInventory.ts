import { useEffect, useState } from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { ipc } from '../lib/ipc'

export function useInventory() {
  const {
    items,
    categories,
    transactions,
    locations,
    loadingItems,
    loadingCategories,
    loadingTransactions,
    fetchItems,
    fetchCategories,
    fetchTransactions,
    fetchLocations,
    subscribeToInventoryUpdates
  } = useInventoryStore()

  const [simpleItems, setSimpleItems] = useState<any[]>([])
  const [loadingSimple, setLoadingSimple] = useState(false)

  const fetchSimpleItems = async () => {
    setLoadingSimple(true)
    try {
      const list = await ipc.items.getSimpleList()
      setSimpleItems(list)
    } catch (error) {
      console.error('Failed to fetch simple items list:', error)
    } finally {
      setLoadingSimple(false)
    }
  }

  useEffect(() => {
    fetchItems()
    fetchCategories()
    fetchTransactions()
    fetchLocations()
    fetchSimpleItems()

    const unsubscribe = subscribeToInventoryUpdates()
    return () => {
      unsubscribe()
    }
  }, [])

  const refresh = () => {
    fetchItems()
    fetchCategories()
    fetchTransactions()
    fetchLocations()
    fetchSimpleItems()
  }

  return {
    items,
    allItems: simpleItems,
    categories,
    transactions,
    locations,
    loading: loadingItems || loadingCategories || loadingSimple,
    loadingTransactions,
    refresh
  }
}

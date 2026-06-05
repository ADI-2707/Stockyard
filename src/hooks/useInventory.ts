import { useEffect, useMemo } from 'react'
import { useInventoryStore } from '../store/inventoryStore'

export function useInventory() {
  const {
    items,
    categories,
    transactions,
    loadingItems,
    loadingCategories,
    loadingTransactions,
    fetchItems,
    fetchCategories,
    fetchTransactions,
    searchTerm,
    selectedCategoryFilter,
    selectedStatusFilter,
    selectedLocationFilter
  } = useInventoryStore()

  useEffect(() => {
    fetchItems()
    fetchCategories()
    fetchTransactions()
  }, [])

  // Process item alerts status on client side for layout badges
  const itemsWithStatus = useMemo(() => {
    return items.map((item) => {
      const isOut = item.quantity === 0
      const isLow = item.quantity > 0 && item.quantity <= item.threshold
      
      const refDate = item.lastMovedAt || item.addedAt
      const limit = item.categoryAgingDays !== undefined && item.categoryAgingDays !== null ? item.categoryAgingDays : 90
      
      let daysUnmoved = 0
      if (refDate) {
        const diff = Date.now() - new Date(refDate).getTime()
        daysUnmoved = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
      }
      
      const isAging = daysUnmoved >= limit && item.quantity > 0

      let status: 'OK' | 'LOW' | 'OUT' | 'AGING' = 'OK'
      if (isOut) status = 'OUT'
      else if (isLow) status = 'LOW'
      else if (isAging) status = 'AGING'

      return {
        ...item,
        status,
        daysUnmoved,
        agingDaysLimit: limit
      }
    })
  }, [items])

  // Reactive filtering logic
  const filteredItems = useMemo(() => {
    return itemsWithStatus.filter((item) => {
      // 1. Text keyword search (Name & SKU)
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const matchName = item.name?.toLowerCase().includes(query)
        const matchSku = item.sku?.toLowerCase().includes(query)
        if (!matchName && !matchSku) return false
      }

      // 2. Category selection
      if (selectedCategoryFilter && item.categoryId !== selectedCategoryFilter) {
        return false
      }

      // 3. Location selection
      if (selectedLocationFilter && item.location !== selectedLocationFilter) {
        return false
      }

      // 4. Alert status selection
      if (selectedStatusFilter && item.status !== selectedStatusFilter) {
        return false
      }

      return true
    })
  }, [itemsWithStatus, searchTerm, selectedCategoryFilter, selectedStatusFilter, selectedLocationFilter])

  // Aggregate list of unique storage locations for filtering
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      if (item.location && item.location.trim()) {
        set.add(item.location.trim())
      }
    })
    return Array.from(set).sort()
  }, [items])

  return {
    items: filteredItems,
    allItems: itemsWithStatus,
    categories,
    transactions,
    locations: uniqueLocations,
    loading: loadingItems || loadingCategories,
    loadingTransactions,
    refresh: () => {
      fetchItems()
      fetchCategories()
      fetchTransactions()
    }
  }
}

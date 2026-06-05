import { create } from 'zustand'
import { ipc } from '../lib/ipc'

interface InventoryState {
  items: any[]
  categories: any[]
  transactions: any[]
  loadingItems: boolean
  loadingCategories: boolean
  loadingTransactions: boolean
  
  fetchItems: () => Promise<void>
  fetchCategories: () => Promise<void>
  fetchTransactions: () => Promise<void>

  // Searching & Filtering Grid States
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedCategoryFilter: string
  setSelectedCategoryFilter: (categoryId: string) => void
  selectedStatusFilter: string
  setSelectedStatusFilter: (status: string) => void
  selectedLocationFilter: string
  setSelectedLocationFilter: (location: string) => void
  clearFilters: () => void
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  categories: [],
  transactions: [],
  loadingItems: false,
  loadingCategories: false,
  loadingTransactions: false,

  fetchItems: async () => {
    set({ loadingItems: true })
    try {
      const list = await ipc.items.getAll()
      set({ items: list, loadingItems: false })
    } catch (error) {
      console.error('Failed to fetch components:', error)
      set({ loadingItems: false })
    }
  },

  fetchCategories: async () => {
    set({ loadingCategories: true })
    try {
      const list = await ipc.categories.getAll()
      set({ categories: list, loadingCategories: false })
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      set({ loadingCategories: false })
    }
  },

  fetchTransactions: async () => {
    set({ loadingTransactions: true })
    try {
      const list = await ipc.transactions.getAll()
      set({ transactions: list, loadingTransactions: false })
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      set({ loadingTransactions: false })
    }
  },

  // Filters State management
  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),
  selectedCategoryFilter: '',
  setSelectedCategoryFilter: (categoryId) => set({ selectedCategoryFilter: categoryId }),
  selectedStatusFilter: '',
  setSelectedStatusFilter: (status) => set({ selectedStatusFilter: status }),
  selectedLocationFilter: '',
  setSelectedLocationFilter: (location) => set({ selectedLocationFilter: location }),
  clearFilters: () =>
    set({
      searchTerm: '',
      selectedCategoryFilter: '',
      selectedStatusFilter: '',
      selectedLocationFilter: ''
    })
}))

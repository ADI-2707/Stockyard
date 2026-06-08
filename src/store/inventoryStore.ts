import { create } from 'zustand'
import { ipc } from '../lib/ipc'

interface InventoryState {
  items: any[]
  categories: any[]
  transactions: any[]
  locations: string[]
  loadingItems: boolean
  loadingCategories: boolean
  loadingTransactions: boolean
  
  fetchItems: () => Promise<void>
  fetchCategories: () => Promise<void>
  fetchTransactions: () => Promise<void>
  fetchLocations: () => Promise<void>

  // Searching & Filtering Items Grid States
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedCategoryFilter: string
  setSelectedCategoryFilter: (categoryId: string) => void
  selectedStatusFilter: string
  setSelectedStatusFilter: (status: string) => void
  selectedLocationFilter: string
  setSelectedLocationFilter: (location: string) => void
  itemsPage: number
  setItemsPage: (page: number) => void
  itemsLimit: number
  totalItemsCount: number
  clearFilters: () => void

  // Searching & Filtering Transactions Grid States
  txSearchTerm: string
  setTxSearchTerm: (term: string) => void
  txTypeFilter: string
  setTxTypeFilter: (type: string) => void
  txOperatorFilter: string
  setTxOperatorFilter: (op: string) => void
  transactionsPage: number
  setTransactionsPage: (page: number) => void
  transactionsLimit: number
  totalTransactionsCount: number
  clearTxFilters: () => void
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  categories: [],
  transactions: [],
  locations: [],
  loadingItems: false,
  loadingCategories: false,
  loadingTransactions: false,

  fetchItems: async () => {
    set({ loadingItems: true })
    try {
      const {
        searchTerm,
        selectedCategoryFilter,
        selectedLocationFilter,
        selectedStatusFilter,
        itemsPage,
        itemsLimit
      } = get()
      const res = await ipc.items.getFiltered({
        search: searchTerm,
        categoryId: selectedCategoryFilter,
        location: selectedLocationFilter,
        status: selectedStatusFilter,
        limit: itemsLimit,
        offset: (itemsPage - 1) * itemsLimit
      })
      set({ items: res.items, totalItemsCount: res.totalCount, loadingItems: false })
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
      if (list.length > 0 && !get().selectedCategoryFilter) {
        set({ selectedCategoryFilter: list[0].id })
        get().fetchItems()
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      set({ loadingCategories: false })
    }
  },

  fetchTransactions: async () => {
    set({ loadingTransactions: true })
    try {
      const {
        txSearchTerm,
        txTypeFilter,
        txOperatorFilter,
        transactionsPage,
        transactionsLimit
      } = get()
      const res = await ipc.transactions.getFiltered({
        search: txSearchTerm,
        type: txTypeFilter,
        performedBy: txOperatorFilter,
        limit: transactionsLimit,
        offset: (transactionsPage - 1) * transactionsLimit
      })
      set({
        transactions: res.transactions,
        totalTransactionsCount: res.totalCount,
        loadingTransactions: false
      })
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      set({ loadingTransactions: false })
    }
  },

  fetchLocations: async () => {
    try {
      const list = await ipc.items.getLocations()
      set({ locations: list })
    } catch (error) {
      console.error('Failed to fetch locations:', error)
    }
  },

  // Items Filters State management
  searchTerm: '',
  setSearchTerm: (term) => {
    set({ searchTerm: term, itemsPage: 1 })
    get().fetchItems()
  },
  selectedCategoryFilter: '',
  setSelectedCategoryFilter: (categoryId) => {
    set({ selectedCategoryFilter: categoryId, itemsPage: 1 })
    get().fetchItems()
  },
  selectedStatusFilter: '',
  setSelectedStatusFilter: (status) => {
    set({ selectedStatusFilter: status, itemsPage: 1 })
    get().fetchItems()
  },
  selectedLocationFilter: '',
  setSelectedLocationFilter: (location) => {
    set({ selectedLocationFilter: location, itemsPage: 1 })
    get().fetchItems()
  },
  itemsPage: 1,
  setItemsPage: (page) => {
    set({ itemsPage: page })
    get().fetchItems()
  },
  itemsLimit: 100,
  totalItemsCount: 0,
  clearFilters: () => {
    const { categories } = get()
    set({
      searchTerm: '',
      selectedCategoryFilter: categories[0]?.id || '',
      selectedStatusFilter: '',
      selectedLocationFilter: '',
      itemsPage: 1
    })
    get().fetchItems()
  },

  // Transactions Filters State management
  txSearchTerm: '',
  setTxSearchTerm: (term) => {
    set({ txSearchTerm: term, transactionsPage: 1 })
    get().fetchTransactions()
  },
  txTypeFilter: '',
  setTxTypeFilter: (type) => {
    set({ txTypeFilter: type, transactionsPage: 1 })
    get().fetchTransactions()
  },
  txOperatorFilter: '',
  setTxOperatorFilter: (op) => {
    set({ txOperatorFilter: op, transactionsPage: 1 })
    get().fetchTransactions()
  },
  transactionsPage: 1,
  setTransactionsPage: (page) => {
    set({ transactionsPage: page })
    get().fetchTransactions()
  },
  transactionsLimit: 100,
  totalTransactionsCount: 0,
  clearTxFilters: () => {
    set({
      txSearchTerm: '',
      txTypeFilter: '',
      txOperatorFilter: '',
      transactionsPage: 1
    })
    get().fetchTransactions()
  }
}))

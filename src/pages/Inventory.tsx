import React, { useState, useEffect, useMemo } from 'react'
import { useInventory } from '../hooks/useInventory.ts'
import { useInventoryStore } from '../store/inventoryStore.ts'
import { ipc } from '../lib/ipc.ts'
import {
  Plus,
  Download,
  Upload,
  FilterX,
  Edit3,
  History,
  Trash2,
  X
} from 'lucide-react'
import styles from './Inventory.module.css'

export default function Inventory() {
  const {
    items,
    categories,
    locations,
    loading,
    refresh
  } = useInventory()

  const store = useInventoryStore()

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [itemHistory, setItemHistory] = useState<any[]>([])

  // Adjust Stock state
  const [adjustQty, setAdjustQty] = useState<number>(1)
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN')
  const [adjustRef, setAdjustRef] = useState('')
  const [adjustOperator, setAdjustOperator] = useState('Accounts')
  const [adjustNotes, setAdjustNotes] = useState('')

  // Add Item form state
  const [newItemData, setNewItemData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    quantity: 0,
    unit: 'pcs',
    costPerUnit: 0.0,
    threshold: 5,
    maxStock: '',
    location: '',
    supplier: '',
    notes: '',
    performedBy: 'Accounts'
  })

  // Edit Item form state
  const [editMode, setEditMode] = useState(false)
  const [editItemData, setEditItemData] = useState<any>(null)

  // CSV Import state
  const [importing, setImporting] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 100

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [store.searchTerm, store.selectedCategoryFilter, store.selectedLocationFilter, store.selectedStatusFilter])

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE)
  const paginatedItems = useMemo(() => {
    return items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  }, [items, currentPage])

  // ------------------------------------------------
  // CSV Import / Export Actions
  // ------------------------------------------------
  const handleExportCSV = async () => {
    const headers = ['SKU', 'Component Name', 'Category', 'Quantity', 'Unit', 'Cost per Unit', 'Threshold', 'Location', 'Supplier', 'Notes']
    const rows = items.map(item => [
      item.sku,
      item.name,
      item.categoryName || '',
      item.quantity,
      item.unit,
      item.costPerUnit,
      item.threshold,
      item.location || '',
      item.supplier || '',
      item.notes || ''
    ])

    try {
      const res = await ipc.csv.export('stockyard_inventory.csv', headers, rows)
      if (res.success) {
        alert(`Export completed: saved to ${res.path}`)
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) {
        setImporting(false)
        return
      }

      try {
        const lines = text.split(/\r?\n/)
        if (lines.length <= 1) {
          throw new Error('CSV is empty or missing header.')
        }

        // Header check
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
        const skuIdx = headers.indexOf('sku')
        const nameIdx = headers.indexOf('component name') !== -1 ? headers.indexOf('component name') : headers.indexOf('name')
        const catIdx = headers.indexOf('category')
        const qtyIdx = headers.indexOf('quantity') !== -1 ? headers.indexOf('quantity') : headers.indexOf('qty')
        const costIdx = headers.indexOf('cost per unit') !== -1 ? headers.indexOf('cost per unit') : headers.indexOf('cost')

        if (skuIdx === -1 || nameIdx === -1) {
          throw new Error('CSV must contain at least "SKU" and "Name" columns.')
        }

        let importedCount = 0
        // Find or fallback Category
        const defaultCat = categories[0]
        if (!defaultCat) {
          throw new Error('Please create at least one Category in Settings before importing items.')
        }

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          // Basic CSV quote parsing
          const values: string[] = []
          let currentVal = ''
          let insideQuotes = false
          for (let charIdx = 0; charIdx < line.length; charIdx++) {
            const char = line[charIdx]
            if (char === '"') {
              insideQuotes = !insideQuotes
            } else if (char === ',' && !insideQuotes) {
              values.push(currentVal.replace(/^"|"$/g, '').trim())
              currentVal = ''
            } else {
              currentVal += char
            }
          }
          values.push(currentVal.replace(/^"|"$/g, '').trim())

          if (values.length < 2) continue

          const sku = values[skuIdx]
          const name = values[nameIdx]
          if (!sku || !name) continue

          // Match category
          let categoryId = defaultCat.id
          if (catIdx !== -1 && values[catIdx]) {
            const matchedCat = categories.find(c => c.name.toLowerCase() === values[catIdx].toLowerCase())
            if (matchedCat) categoryId = matchedCat.id
          }

          const quantity = qtyIdx !== -1 ? parseInt(values[qtyIdx]) || 0 : 0
          const costPerUnit = costIdx !== -1 ? parseFloat(values[costIdx]) || 0.0 : 0.0

          const itemData = {
            sku,
            name,
            categoryId,
            quantity,
            unit: 'pcs',
            costPerUnit,
            threshold: 5,
            notes: 'Imported from CSV'
          }

          await ipc.items.create(itemData, 'CSV Import')
          importedCount++
        }

        alert(`Successfully imported ${importedCount} components.`)
        refresh()
      } catch (err: any) {
        alert(`Import failed: ${err.message}`)
      } finally {
        setImporting(false)
        // Reset file input
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  // ------------------------------------------------
  // Stock Adjustment Action
  // ------------------------------------------------
  const handleInlineAdjust = async (itemId: string, change: number) => {
    try {
      await ipc.items.adjustStock({
        itemId,
        quantityChange: change,
        type: change > 0 ? 'IN' : 'OUT',
        performedBy: 'Accounts',
        reference: 'Inline Adjust',
        notes: `Quick inline inventory correction of ${change} unit(s).`
      })
      refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDetailedAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    const change = adjustType === 'OUT' ? -Math.abs(adjustQty) : Math.abs(adjustQty)

    try {
      await ipc.items.adjustStock({
        itemId: selectedItem.id,
        quantityChange: change,
        type: adjustType,
        performedBy: adjustOperator,
        reference: adjustRef || undefined,
        notes: adjustNotes || undefined
      })

      // Reload history and item state
      const updated = await ipc.items.getById(selectedItem.id)
      const history = await ipc.transactions.getByItem(selectedItem.id)
      setSelectedItem(updated)
      setItemHistory(history)
      setAdjustQty(1)
      setAdjustRef('')
      setAdjustNotes('')
      refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // ------------------------------------------------
  // Detail Modal Launcher
  // ------------------------------------------------
  const openDetails = async (item: any) => {
    setSelectedItem(item)
    setShowDetailModal(true)
    setEditMode(false)
    try {
      const history = await ipc.transactions.getByItem(item.id)
      setItemHistory(history)
    } catch (err) {
      console.error(err)
    }
  }

  // ------------------------------------------------
  // Add / Edit Form Actions
  // ------------------------------------------------
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemData.categoryId) {
      alert('Please select a Category. Add one in Settings if the list is empty.')
      return
    }

    try {
      await ipc.items.create(
        {
          ...newItemData,
          maxStock: newItemData.maxStock ? parseInt(newItemData.maxStock) : null
        },
        newItemData.performedBy
      )
      setShowAddModal(false)
      // Reset form
      setNewItemData({
        sku: '',
        name: '',
        categoryId: categories[0]?.id || '',
        quantity: 0,
        unit: 'pcs',
        costPerUnit: 0.0,
        threshold: 5,
        maxStock: '',
        location: '',
        supplier: '',
        notes: '',
        performedBy: 'Accounts'
      })
      refresh()
    } catch (err: any) {
      alert(`Failed to create item: ${err.message}`)
    }
  }

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editItemData) return

    try {
      await ipc.items.update(
        editItemData.id,
        {
          ...editItemData,
          maxStock: editItemData.maxStock ? parseInt(editItemData.maxStock) : null
        },
        editItemData.performedBy || 'Accounts'
      )

      // Update selected item detail views
      const updated = await ipc.items.getById(editItemData.id)
      setSelectedItem(updated)
      setEditMode(false)
      refresh()
    } catch (err: any) {
      alert(`Failed to update item: ${err.message}`)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this component? This soft-deletes the item to preserve historical ledger records.')) return
    try {
      await ipc.items.delete(itemId)
      setShowDetailModal(false)
      refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val)
  }

  const formatSqlDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z')
      return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString()
    } catch { return 'Invalid Date' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 'var(--spacing-md)' }}>

      {/* Ribbon toolbar panel */}
      <div className={styles.headerControls}>
        {/* Filters */}
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Search SKU or Name..."
            value={store.searchTerm}
            onChange={(e) => store.setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={store.selectedCategoryFilter}
            onChange={(e) => store.setSelectedCategoryFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">[All Categories]</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={store.selectedLocationFilter}
            onChange={(e) => store.setSelectedLocationFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">[All Locations]</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select
            value={store.selectedStatusFilter}
            onChange={(e) => store.setSelectedStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">[All Alert Statuses]</option>
            <option value="OK">Healthy (OK)</option>
            <option value="LOW">Low Stock</option>
            <option value="OUT">Out of Stock</option>
            <option value="AGING">Aging Components</option>
          </select>

          <button
            onClick={store.clearFilters}
            className={styles.adjustBtn}
            style={{ width: '28px', height: '28px' }}
            title="Clear all filters"
          >
            <FilterX size={14} />
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={() => {
              setNewItemData(prev => ({ ...prev, categoryId: categories[0]?.id || '' }))
              setShowAddModal(true)
            }}
            className={styles.filterSelect}
            style={{ backgroundColor: 'var(--color-brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
          >
            <Plus size={14} /> New Component
          </button>

          <button
            onClick={handleExportCSV}
            className={styles.filterSelect}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Export CSV
          </button>

          <label
            className={styles.filterSelect}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, justifyContent: 'center' }}
          >
            <Upload size={14} /> {importing ? 'Importing...' : 'Import CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading component spreadsheet...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No components match your query. Click "New Component" to add items manually.
          </div>
        ) : (
          <table className={styles.gridTable}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>SKU</th>
                <th>Component Description</th>
                <th>Category</th>
                <th>Location</th>
                <th style={{ textAlign: 'right' }}>Cost per Unit</th>
                <th style={{ textAlign: 'right', width: '140px' }}>In Stock</th>
                <th style={{ textAlign: 'right' }}>Min Threshold</th>
                <th style={{ textAlign: 'right' }}>Max Stock</th>
                <th>Supplier</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                let rowClass = styles.rowNormal
                let badgeClass = styles.badgeOk
                let badgeText = 'OK'

                if (item.status === 'OUT') {
                  rowClass = styles.rowOutOfStock
                  badgeClass = styles.badgeOut
                  badgeText = 'OUT'
                } else if (item.status === 'LOW') {
                  rowClass = styles.rowLowStock
                  badgeClass = styles.badgeLow
                  badgeText = 'LOW'
                } else if (item.status === 'AGING') {
                  rowClass = styles.rowAging
                  badgeClass = styles.badgeAging
                  badgeText = `AGING (${item.daysUnmoved}d)`
                }

                return (
                  <tr key={item.id} className={rowClass}>
                    <td style={{ fontWeight: 'bold' }}>{item.sku}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{item.name}</span>
                        {item.status !== 'OK' && (
                          <span className={badgeClass} style={{ fontSize: '9px', padding: '1px 4px' }}>
                            {badgeText}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className={styles.colorDot}
                          style={{ backgroundColor: item.categoryColor || '#a19f9d', margin: 0 }}
                        />
                        {item.categoryName || 'Uncategorized'}
                      </span>
                    </td>
                    <td>{item.location || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.costPerUnit)}</td>

                    {/* Inline stock adjust */}
                    <td>
                      <div className={styles.inlineAdjust}>
                        <button
                          onClick={() => handleInlineAdjust(item.id, -1)}
                          className={styles.adjustBtn}
                          disabled={item.quantity <= 0}
                          title="Decrease stock by 1"
                        >
                          -
                        </button>
                        <span className={styles.qtyValue}>{item.quantity}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginRight: '6px' }}>{item.unit}</span>
                        <button
                          onClick={() => handleInlineAdjust(item.id, 1)}
                          className={styles.adjustBtn}
                          title="Increase stock by 1"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{item.threshold}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{item.maxStock || '-'}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{item.supplier || '-'}</td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => openDetails(item)}
                        className={styles.textButton}
                        style={{ fontSize: '11px' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        {items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px var(--spacing-md)', borderTop: '1px solid var(--color-border-grid)', backgroundColor: '#faf9f8' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, items.length)} of {items.length} items
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={styles.actionButton}
                style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={styles.actionButton}
                style={{ opacity: currentPage === totalPages || totalPages === 0 ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ */}
      {/* 1. Modal: Add Component Form */}
      {/* ------------------------------------------------ */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Create New Component SKU</h3>
              <button onClick={() => setShowAddModal(false)} className={styles.adjustBtn}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className={styles.modalBody}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>SKU / Part Code *</label>
                    <input
                      type="text"
                      required
                      value={newItemData.sku}
                      onChange={(e) => setNewItemData({ ...newItemData, sku: e.target.value })}
                      placeholder="e.g. REL-24V-01"
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Component Name *</label>
                    <input
                      type="text"
                      required
                      value={newItemData.name}
                      onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                      placeholder="e.g. Schneider Relays 24V"
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Category *</label>
                    <select
                      required
                      value={newItemData.categoryId}
                      onChange={(e) => setNewItemData({ ...newItemData, categoryId: e.target.value })}
                      className={styles.formInput}
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Storage Location</label>
                    <input
                      type="text"
                      value={newItemData.location}
                      onChange={(e) => setNewItemData({ ...newItemData, location: e.target.value })}
                      placeholder="Shelf A-1 / Row 2"
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Initial Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={newItemData.quantity}
                      onChange={(e) => setNewItemData({ ...newItemData, quantity: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Measurement Unit (pcs/meters)</label>
                    <input
                      type="text"
                      value={newItemData.unit}
                      onChange={(e) => setNewItemData({ ...newItemData, unit: e.target.value })}
                      placeholder="pcs"
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Cost per Unit (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newItemData.costPerUnit}
                      onChange={(e) => setNewItemData({ ...newItemData, costPerUnit: parseFloat(e.target.value) || 0.0 })}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Supplier Code / Name</label>
                    <input
                      type="text"
                      value={newItemData.supplier}
                      onChange={(e) => setNewItemData({ ...newItemData, supplier: e.target.value })}
                      placeholder="Mouser Electronics"
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Min Reorder Threshold *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newItemData.threshold}
                      onChange={(e) => setNewItemData({ ...newItemData, threshold: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Max Storage Ceiling (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={newItemData.maxStock}
                      onChange={(e) => setNewItemData({ ...newItemData, maxStock: e.target.value })}
                      placeholder="None"
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Operator Initials / Performed By *</label>
                  <input
                    type="text"
                    required
                    value={newItemData.performedBy}
                    onChange={(e) => setNewItemData({ ...newItemData, performedBy: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Specifications / Description Notes</label>
                  <textarea
                    value={newItemData.notes}
                    onChange={(e) => setNewItemData({ ...newItemData, notes: e.target.value })}
                    placeholder="Enter dimensional or pin spacing requirements..."
                    className={styles.formInput}
                    style={{ height: '60px', padding: '6px', resize: 'none' }}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setShowAddModal(false)} className={styles.actionButton}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionButton} ${styles.primaryActionButton}`}>
                  Confirm Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* 2. Modal: Inspect Component Detail & History */}
      {/* ------------------------------------------------ */}
      {showDetailModal && selectedItem && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ width: '600px' }}>
            <div className={styles.modalHeader}>
              <h3>Inspect: {selectedItem.sku}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!editMode && (
                  <button
                    onClick={() => {
                      setEditItemData({ ...selectedItem, performedBy: 'Accounts' })
                      setEditMode(true)
                    }}
                    className={styles.actionButton}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit3 size={14} /> Edit Item
                  </button>
                )}
                <button
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  className={styles.actionButton}
                  style={{ color: 'var(--color-error-text)', borderColor: 'var(--color-error-text)', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={14} /> Discontinue
                </button>
                <button onClick={() => setShowDetailModal(false)} className={styles.actionButton} style={{ padding: '0 8px' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {editMode ? (
              // Edit Form Mode
              <form onSubmit={handleEditItem}>
                <div className={styles.modalBody}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>SKU / Part Code</label>
                      <input
                        type="text"
                        required
                        value={editItemData.sku}
                        onChange={(e) => setEditItemData({ ...editItemData, sku: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Component Name</label>
                      <input
                        type="text"
                        required
                        value={editItemData.name}
                        onChange={(e) => setEditItemData({ ...editItemData, name: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Category</label>
                      <select
                        required
                        value={editItemData.categoryId || ''}
                        onChange={(e) => setEditItemData({ ...editItemData, categoryId: e.target.value })}
                        className={styles.formInput}
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Location</label>
                      <input
                        type="text"
                        value={editItemData.location || ''}
                        onChange={(e) => setEditItemData({ ...editItemData, location: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Cost per Unit (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editItemData.costPerUnit}
                        onChange={(e) => setEditItemData({ ...editItemData, costPerUnit: parseFloat(e.target.value) || 0.0 })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Supplier Code / Name</label>
                      <input
                        type="text"
                        value={editItemData.supplier || ''}
                        onChange={(e) => setEditItemData({ ...editItemData, supplier: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Min Reorder Threshold</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={editItemData.threshold}
                        onChange={(e) => setEditItemData({ ...editItemData, threshold: parseInt(e.target.value) || 0 })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Max Storage Ceiling (Optional)</label>
                      <input
                        type="number"
                        min="0"
                        value={editItemData.maxStock || ''}
                        onChange={(e) => setEditItemData({ ...editItemData, maxStock: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Measurement Unit (pcs/meters)</label>
                    <input
                      type="text"
                      value={editItemData.unit}
                      onChange={(e) => setEditItemData({ ...editItemData, unit: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Operator Initials / Performed By *</label>
                    <input
                      type="text"
                      required
                      value={editItemData.performedBy || ''}
                      onChange={(e) => setEditItemData({ ...editItemData, performedBy: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Notes</label>
                    <textarea
                      value={editItemData.notes || ''}
                      onChange={(e) => setEditItemData({ ...editItemData, notes: e.target.value })}
                      className={styles.formInput}
                      style={{ height: '60px', padding: '6px', resize: 'none' }}
                    />
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" onClick={() => setEditMode(false)} className={styles.actionButton}>
                    Back
                  </button>
                  <button type="submit" className={`${styles.actionButton} ${styles.primaryActionButton}`}>
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              // Detail View and Adjustment Form Mode
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className={styles.modalBody}>
                  {/* Item Specs Table */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid var(--color-border-grid)', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--font-size-sm)' }}>
                      <div><strong>SKU:</strong> {selectedItem.sku}</div>
                      <div><strong>Description:</strong> {selectedItem.name}</div>
                      <div><strong>Category:</strong> {selectedItem.categoryName || 'Uncategorized'}</div>
                      <div><strong>Location:</strong> {selectedItem.location || 'Not set'}</div>
                      <div><strong>Supplier:</strong> {selectedItem.supplier || 'Not set'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--font-size-sm)' }}>
                      <div><strong>In Stock:</strong> {selectedItem.quantity} {selectedItem.unit}</div>
                      <div><strong>Base Pricing:</strong> {formatCurrency(selectedItem.costPerUnit)}</div>
                      <div><strong>Reorder Threshold:</strong> {selectedItem.threshold} {selectedItem.unit}</div>
                      <div><strong>Max Stock:</strong> {selectedItem.maxStock || 'None'}</div>
                      <div><strong>Last Moved At:</strong> {formatSqlDate(selectedItem.lastMovedAt)}</div>
                    </div>
                  </div>

                  {/* Stock Adjustment Action Panel */}
                  <form onSubmit={handleDetailedAdjust} style={{ borderBottom: '1px solid var(--color-border-grid)', paddingBottom: '16px' }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'bold', marginBottom: '8px' }}>Log Inventory Movement / Adjustment</h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr', gap: '10px', marginBottom: '10px' }}>
                      <div className={styles.formGroup}>
                        <label>Movement Type</label>
                        <select
                          value={adjustType}
                          onChange={(e) => setAdjustType(e.target.value as any)}
                          className={styles.formInput}
                        >
                          <option value="IN">IN (Stock addition)</option>
                          <option value="OUT">OUT (Consumption)</option>
                          <option value="ADJUSTMENT">ADJUSTMENT (Auditing)</option>
                        </select>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={adjustQty}
                          onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                          className={styles.formInput}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Operator</label>
                        <input
                          type="text"
                          required
                          value={adjustOperator}
                          onChange={(e) => setAdjustOperator(e.target.value)}
                          className={styles.formInput}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Reference (e.g. PO/Job)</label>
                        <input
                          type="text"
                          value={adjustRef}
                          placeholder="PO-200"
                          onChange={(e) => setAdjustRef(e.target.value)}
                          className={styles.formInput}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div className={styles.formGroup} style={{ flex: 1 }}>
                        <input
                          type="text"
                          placeholder="Movement rationale / notes..."
                          value={adjustNotes}
                          onChange={(e) => setAdjustNotes(e.target.value)}
                          className={styles.formInput}
                        />
                      </div>
                      <button type="submit" className={`${styles.actionButton} ${styles.primaryActionButton}`}>
                        Post Ledger Move
                      </button>
                    </div>
                  </form>

                  {/* Audit Log for this Item */}
                  <div>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <History size={14} /> Item Transaction History
                    </h4>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border-grid)' }}>
                      <table className={styles.gridTable}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Action</th>
                            <th style={{ textAlign: 'right' }}>Before</th>
                            <th style={{ textAlign: 'right' }}>Delta</th>
                            <th>Operator</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemHistory.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '16px' }}>
                                No transactions recorded for this item.
                              </td>
                            </tr>
                          ) : (
                            itemHistory.map((tx) => (
                              <tr key={tx.id}>
                                <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  {formatSqlDate(tx.createdAt)}
                                </td>
                                <td>
                                  <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '2px', backgroundColor: tx.type === 'IN' || tx.type === 'INITIAL' ? '#e2f0d9' : tx.type === 'OUT' ? '#fbe5d6' : '#fff2cc', color: tx.type === 'IN' || tx.type === 'INITIAL' ? '#385723' : tx.type === 'OUT' ? '#c65911' : '#7f6000' }}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{tx.quantityBefore}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: tx.type === 'IN' || tx.type === 'INITIAL' ? 'var(--color-ok-text)' : tx.type === 'OUT' ? 'var(--color-error-text)' : 'inherit' }}>
                                  {tx.type === 'OUT' ? '-' : '+'}{tx.quantity}
                                </td>
                                <td>{tx.performedBy}</td>
                                <td style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                                  {tx.reference ? `[Ref: ${tx.reference}] ` : ''}{tx.notes || ''}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" onClick={() => setShowDetailModal(false)} className={styles.actionButton}>
                    Close View
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

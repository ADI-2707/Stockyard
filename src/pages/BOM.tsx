import { useState, useEffect, useMemo } from 'react'
import { useBOM } from '../hooks/useBOM.ts'
import { useInventory } from '../hooks/useInventory.ts'
import { ipc } from '../lib/ipc.ts'
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Calculator, 
  Download, 
  X, 
  AlertCircle
} from 'lucide-react'
import styles from './BOM.module.css'
import inventoryStyles from './Inventory.module.css'

export default function BOM() {
  const { 
    templates, 
    loading: loadingBoms, 
    fetchTemplates,
    getDetails,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    checkCoverage: checkBOMCoverage
  } = useBOM()

  const { allItems } = useInventory()

  // Selected template states
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null)
  const [selectedBom, setSelectedBom] = useState<any | null>(null)
  const [buildCount, setBuildCount] = useState<number>(1)
  const [coverageResults, setCoverageResults] = useState<any[]>([])
  const [loadingCoverage, setLoadingCoverage] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Add/Edit BOM Form states
  const [bomName, setBomName] = useState('')
  const [bomDescription, setBomDescription] = useState('')
  const [bomItemsList, setBomItemsList] = useState<{ itemId: string; quantity: number }[]>([])

  // Temporary selectors for add/edit modals
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('')
  const [qtyToAdd, setQtyToAdd] = useState(1)

  // Autocomplete state for item lookup
  const [searchQuery, setSearchQuery] = useState('')
  const [autocompleteResults, setAutocompleteResults] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Debounced search logic for autocomplete
  useEffect(() => {
    if (!searchQuery.trim()) {
      setAutocompleteResults([])
      return
    }
    const timer = setTimeout(() => {
      ipc.items.searchAutocomplete(searchQuery).then(setAutocompleteResults)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ------------------------------------------------
  // Initial Load & Selections
  // ------------------------------------------------
  useEffect(() => {
    fetchTemplates()
  }, [])

  // Auto-select first template on load
  useEffect(() => {
    if (templates.length > 0 && !selectedBomId) {
      handleSelectBom(templates[0].id)
    }
  }, [templates])

  const handleSelectBom = async (id: string) => {
    setSelectedBomId(id)
    setLoadingCoverage(true)
    try {
      const details = await getDetails(id)
      setSelectedBom(details)
      // Run initial coverage check for 1 build
      const results = await checkBOMCoverage(id, buildCount)
      setCoverageResults(results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCoverage(false)
    }
  }

  // Recalculate coverage when build count changes
  const handleCalculateCoverage = async () => {
    if (!selectedBomId) return
    setLoadingCoverage(true)
    try {
      const count = Math.max(1, buildCount)
      setBuildCount(count)
      const results = await checkBOMCoverage(selectedBomId, count)
      setCoverageResults(results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCoverage(false)
    }
  }

  // ------------------------------------------------
  // Add item helper in form
  // ------------------------------------------------
  const addComponentToBOMForm = () => {
    if (!selectedItemToAdd) return
    
    // Check if item already exists in the list
    const existing = bomItemsList.find(i => i.itemId === selectedItemToAdd)
    if (existing) {
      setBomItemsList(bomItemsList.map(i => 
        i.itemId === selectedItemToAdd ? { ...i, quantity: i.quantity + qtyToAdd } : i
      ))
    } else {
      setBomItemsList([...bomItemsList, { itemId: selectedItemToAdd, quantity: qtyToAdd }])
    }
    
    setQtyToAdd(1)
    setSearchQuery('')
    setSelectedItemToAdd('')
  }

  const removeComponentFromBOMForm = (itemId: string) => {
    setBomItemsList(bomItemsList.filter(i => i.itemId !== itemId))
  }

  // ------------------------------------------------
  // Add / Edit / Delete API Calls
  // ------------------------------------------------
  const handleCreateBOM = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bomItemsList.length === 0) {
      alert('Please add at least one component to the template configuration.')
      return
    }

    try {
      const id = await createTemplate(bomName, bomDescription, bomItemsList)
      setShowAddModal(false)
      // Reset form
      setBomName('')
      setBomDescription('')
      setBomItemsList([])
      // Reload boms and select the new template
      await fetchTemplates()
      handleSelectBom(id)
    } catch (err: any) {
      alert(`Failed to create BOM template: ${err.message}`)
    }
  }

  const openEditModal = () => {
    if (!selectedBom) return
    setBomName(selectedBom.name)
    setBomDescription(selectedBom.description || '')
    setBomItemsList(selectedBom.items.map((i: any) => ({ itemId: i.itemId, quantity: i.quantityRequired })))
    setSearchQuery('')
    setSelectedItemToAdd('')
    setShowEditModal(true)
  }

  const handleUpdateBOM = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBomId) return
    if (bomItemsList.length === 0) {
      alert('Please add at least one component to the template configuration.')
      return
    }

    try {
      await updateTemplate(selectedBomId, bomName, bomDescription, bomItemsList)
      setShowEditModal(false)
      // Reload templates and detail views
      await fetchTemplates()
      handleSelectBom(selectedBomId)
    } catch (err: any) {
      alert(`Failed to update BOM template: ${err.message}`)
    }
  }

  const handleDeleteBOM = async () => {
    if (!selectedBomId) return
    if (!confirm('Are you sure you want to delete this BOM template? This is an irreversible change.')) return

    try {
      await deleteTemplate(selectedBomId)
      setSelectedBomId(null)
      setSelectedBom(null)
      setCoverageResults([])
      await fetchTemplates()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // ------------------------------------------------
  // Shortage PO list CSV export
  // ------------------------------------------------
  const handleExportShortageCSV = async () => {
    if (!selectedBom || coverageResults.length === 0) return
    
    const shortItems = coverageResults.filter(r => r.status === 'SHORT')
    if (shortItems.length === 0) {
      alert('No shortages detected. Stock is fully covered for this build run.')
      return
    }

    const headers = ['SKU', 'Component Name', 'Required Quantity', 'Current Stock', 'Shortage Deficit', 'Unit Cost (₹)', 'Total Procurement Cost (₹)']
    const rows = shortItems.map(r => [
      r.sku,
      r.name,
      r.required,
      r.inStock,
      r.shortage,
      r.costPerUnit,
      (r.shortage * r.costPerUnit).toFixed(2)
    ])

    try {
      const filename = `shortage_po_${selectedBom.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${buildCount}x.csv`
      const res = await ipc.csv.export(filename, headers, rows)
      if (res.success) {
        alert(`Shortage restock list saved: ${res.path}`)
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  // ------------------------------------------------
  // Calculations
  // ------------------------------------------------
  const totalValuation = useMemo(() => {
    return coverageResults.reduce((sum, r) => sum + r.lineCost, 0)
  }, [coverageResults])

  const shortageCount = useMemo(() => {
    return coverageResults.filter(r => r.status === 'SHORT').length
  }, [coverageResults])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val)
  }

  const getItemSkuAndName = (itemId: string) => {
    const item = allItems.find(i => i.id === itemId)
    return item ? `${item.sku} - ${item.name}` : 'Unknown Item'
  }

  return (
    <div className={styles.container}>
      
      {/* 1. Sidebar list pane */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 style={{ fontSize: 'var(--font-size-base)' }}>BOM Templates</h3>
          <button 
            onClick={() => {
              setBomName('')
              setBomDescription('')
              setBomItemsList([])
              setSearchQuery('')
              setSelectedItemToAdd('')
              setShowAddModal(true)
            }}
            className={inventoryStyles.adjustBtn}
            title="Create new BOM recipe"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className={styles.templateList}>
          {loadingBoms ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
              No templates available.
            </div>
          ) : (
            templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectBom(t.id)}
                className={`${styles.templateItem} ${selectedBomId === t.id ? styles.activeTemplate : ''}`}
              >
                <div className={styles.templateName}>{t.name}</div>
                <div className={styles.templateDesc}>{t.description || 'No description'}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Main Selected BOM Details pane */}
      <div className={styles.detailsPane}>
        {selectedBom ? (
          <>
            {/* Header info */}
            <div className={styles.paneHeader}>
              <div className={styles.paneTitleBlock}>
                <h2>{selectedBom.name}</h2>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {selectedBom.description || 'No description provided.'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={openEditModal} className={inventoryStyles.actionButton}>
                  <Edit3 size={12} /> Edit Recipe
                </button>
                <button 
                  onClick={handleDeleteBOM} 
                  className={inventoryStyles.actionButton}
                  style={{ color: 'var(--color-error-text)', borderColor: 'var(--color-error-border)' }}
                >
                  <Trash2 size={12} /> Delete Template
                </button>
              </div>
            </div>

            {/* Calculations input pad */}
            <div className={styles.calcCard}>
              <span className={styles.calcLabel}>Target Production Runs:</span>
              <input 
                type="number" 
                min="1" 
                value={buildCount}
                onChange={(e) => setBuildCount(parseInt(e.target.value) || 1)}
                className={styles.calcInput}
              />
              <span className={styles.calcLabel}>Panel Builds</span>
              
              <button 
                onClick={handleCalculateCoverage}
                className={inventoryStyles.actionButton}
                style={{ backgroundColor: 'var(--color-brand-primary)', color: '#fff', border: 'none' }}
              >
                <Calculator size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Calculate Coverage
              </button>

              {shortageCount > 0 && (
                <button 
                  onClick={handleExportShortageCSV}
                  className={inventoryStyles.actionButton}
                  style={{ borderColor: 'var(--color-error-border)', color: 'var(--color-error-text)', marginLeft: 'auto' }}
                >
                  <Download size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Export Shortage PO List
                </button>
              )}
            </div>

            {/* Coverage results sheet table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingCoverage ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  Running coverage check queries...
                </div>
              ) : coverageResults.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  BOM configuration has no components.
                </div>
              ) : (
                <table className={inventoryStyles.gridTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>SKU</th>
                      <th>Component Description</th>
                      <th style={{ textAlign: 'right' }}>Qty Per Build</th>
                      <th style={{ textAlign: 'right' }}>Total Required</th>
                      <th style={{ textAlign: 'right' }}>Current Stock</th>
                      <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                      <th style={{ textAlign: 'right', width: '100px' }}>Deficit</th>
                      <th style={{ textAlign: 'right' }}>Line Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageResults.map((r, idx) => {
                      const isShort = r.status === 'SHORT'
                      return (
                        <tr key={idx} className={isShort ? inventoryStyles.rowOutOfStock : inventoryStyles.rowNormal}>
                          <td style={{ fontWeight: 'bold' }}>{r.sku}</td>
                          <td>{r.name}</td>
                          <td style={{ textAlign: 'right' }}>{r.quantityPerBuild} {r.unit}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{r.required} {r.unit}</td>
                          <td style={{ textAlign: 'right' }}>{r.inStock} {r.unit}</td>
                          
                          <td style={{ textAlign: 'center' }}>
                            <span className={`${inventoryStyles.statusBadge} ${isShort ? inventoryStyles.badgeOut : inventoryStyles.badgeOk}`}>
                              {r.status}
                            </span>
                          </td>
                          
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: isShort ? 'var(--color-error-text)' : 'inherit' }}>
                            {isShort ? `${r.shortage} ${r.unit}` : '-'}
                          </td>
                          
                          <td style={{ textAlign: 'right' }}>{formatCurrency(r.lineCost)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Cost Summary block */}
            <div className={styles.costSummary}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {shortageCount > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-error-text)', fontSize: 'var(--font-size-sm)' }}>
                    <AlertCircle size={14} /> Deficit detected on {shortageCount} component(s).
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-ok-text)', fontSize: 'var(--font-size-sm)' }}>
                    ✓ Stock fully covered. Ready for build run.
                  </span>
                )}
              </div>
              <div>
                <span>Est. Materials Cost: </span>
                <span className={styles.costValue}>{formatCurrency(totalValuation)}</span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            No BOM templates created. Click the "+" button in the sidebar to create one.
          </div>
        )}
      </div>

      {/* ------------------------------------------------ */}
      {/* 3. Modal: Add BOM Template Form */}
      {/* ------------------------------------------------ */}
      {showAddModal && (
        <div className={inventoryStyles.modalOverlay}>
          <div className={inventoryStyles.modalContent}>
            <div className={inventoryStyles.modalHeader}>
              <h3>Create Component BOM Template</h3>
              <button onClick={() => setShowAddModal(false)} className={inventoryStyles.adjustBtn}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateBOM}>
              <div className={inventoryStyles.modalBody}>
                <div className={inventoryStyles.formGroup}>
                  <label>BOM Template Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={bomName}
                    onChange={(e) => setBomName(e.target.value)}
                    placeholder="e.g. Standard 24V Control Panel"
                    className={inventoryStyles.formInput}
                  />
                </div>

                <div className={inventoryStyles.formGroup}>
                  <label>Template Description</label>
                  <input 
                    type="text" 
                    value={bomDescription}
                    onChange={(e) => setBomDescription(e.target.value)}
                    placeholder="Used in panel assemblies for factory clients."
                    className={inventoryStyles.formInput}
                  />
                </div>

                {/* Add component to sub-list */}
                <div style={{ border: '1px solid var(--color-border-light)', padding: '10px', borderRadius: 'var(--border-radius-sm)', backgroundColor: '#faf9f8' }}>
                  <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Configure Template Ingredients</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                    
                    {/* Autocomplete Input Search */}
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setShowSuggestions(true)
                          if (selectedItemToAdd) setSelectedItemToAdd('')
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Type to search SKU or Name..."
                        className={inventoryStyles.formInput}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                      {showSuggestions && autocompleteResults.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 1000,
                          backgroundColor: '#fff',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: 'var(--border-radius-sm)',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          marginTop: '2px'
                        }}>
                          {autocompleteResults.map(item => (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSelectedItemToAdd(item.id)
                                setSearchQuery(`${item.sku} - ${item.name}`)
                                setShowSuggestions(false)
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f2f2f2',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-primary)',
                                textAlign: 'left'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                            >
                              <span style={{ fontWeight: 'bold' }}>{item.sku}</span> - {item.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <input 
                      type="number" 
                      min="1" 
                      value={qtyToAdd}
                      onChange={(e) => setQtyToAdd(parseInt(e.target.value) || 1)}
                      className={inventoryStyles.formInput}
                      placeholder="Qty"
                    />

                    <button 
                      type="button" 
                      onClick={addComponentToBOMForm}
                      className={inventoryStyles.actionButton}
                      style={{ height: '28px', backgroundColor: 'var(--color-brand-primary)', color: '#fff', border: 'none' }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Added items list */}
                <div className={styles.itemListContainer}>
                  {bomItemsList.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      No components added to this recipe configuration.
                    </div>
                  ) : (
                    bomItemsList.map((bi) => (
                      <div key={bi.itemId} className={styles.itemSelectorRow}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getItemSkuAndName(bi.itemId)}
                        </span>
                        <span style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>
                          {bi.quantity} units
                        </span>
                        <button 
                          type="button" 
                          onClick={() => removeComponentFromBOMForm(bi.itemId)}
                          className={inventoryStyles.adjustBtn}
                          style={{ color: 'var(--color-error-text)', borderColor: 'var(--color-error-border)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className={inventoryStyles.modalFooter}>
                <button type="button" onClick={() => setShowAddModal(false)} className={inventoryStyles.actionButton}>
                  Cancel
                </button>
                <button type="submit" className={`${inventoryStyles.actionButton} ${inventoryStyles.primaryActionButton}`}>
                  Create Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* 4. Modal: Edit BOM Template Form */}
      {/* ------------------------------------------------ */}
      {showEditModal && (
        <div className={inventoryStyles.modalOverlay}>
          <div className={inventoryStyles.modalContent}>
            <div className={inventoryStyles.modalHeader}>
              <h3>Edit BOM Recipe Configuration</h3>
              <button onClick={() => setShowEditModal(false)} className={inventoryStyles.adjustBtn}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleUpdateBOM}>
              <div className={inventoryStyles.modalBody}>
                <div className={inventoryStyles.formGroup}>
                  <label>BOM Template Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={bomName}
                    onChange={(e) => setBomName(e.target.value)}
                    className={inventoryStyles.formInput}
                  />
                </div>

                <div className={inventoryStyles.formGroup}>
                  <label>Template Description</label>
                  <input 
                    type="text" 
                    value={bomDescription}
                    onChange={(e) => setBomDescription(e.target.value)}
                    className={inventoryStyles.formInput}
                  />
                </div>

                {/* Add component helper */}
                <div style={{ border: '1px solid var(--color-border-light)', padding: '10px', borderRadius: 'var(--border-radius-sm)', backgroundColor: '#faf9f8' }}>
                  <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Add Component SKU</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                    
                    {/* Autocomplete Input Search */}
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setShowSuggestions(true)
                          if (selectedItemToAdd) setSelectedItemToAdd('')
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Type to search SKU or Name..."
                        className={inventoryStyles.formInput}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                      {showSuggestions && autocompleteResults.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 1000,
                          backgroundColor: '#fff',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: 'var(--border-radius-sm)',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          marginTop: '2px'
                        }}>
                          {autocompleteResults.map(item => (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSelectedItemToAdd(item.id)
                                setSearchQuery(`${item.sku} - ${item.name}`)
                                setShowSuggestions(false)
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f2f2f2',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-primary)',
                                textAlign: 'left'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                            >
                              <span style={{ fontWeight: 'bold' }}>{item.sku}</span> - {item.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <input 
                      type="number" 
                      min="1" 
                      value={qtyToAdd}
                      onChange={(e) => setQtyToAdd(parseInt(e.target.value) || 1)}
                      className={inventoryStyles.formInput}
                    />

                    <button 
                      type="button" 
                      onClick={addComponentToBOMForm}
                      className={inventoryStyles.actionButton}
                      style={{ height: '28px', backgroundColor: 'var(--color-brand-primary)', color: '#fff', border: 'none' }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Added items list */}
                <div className={styles.itemListContainer}>
                  {bomItemsList.map((bi) => (
                    <div key={bi.itemId} className={styles.itemSelectorRow}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getItemSkuAndName(bi.itemId)}
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>
                        {bi.quantity} units
                      </span>
                      <button 
                        type="button" 
                        onClick={() => removeComponentFromBOMForm(bi.itemId)}
                        className={inventoryStyles.adjustBtn}
                        style={{ color: 'var(--color-error-text)', borderColor: 'var(--color-error-border)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className={inventoryStyles.modalFooter}>
                <button type="button" onClick={() => setShowEditModal(false)} className={inventoryStyles.actionButton}>
                  Cancel
                </button>
                <button type="submit" className={`${inventoryStyles.actionButton} ${inventoryStyles.primaryActionButton}`}>
                  Confirm Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

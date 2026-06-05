import { useState, useEffect } from 'react'
import { useInventory } from '../hooks/useInventory.ts'
import { ipc } from '../lib/ipc.ts'
import { 
  Plus, 
  Trash2, 
  Database, 
  Activity, 
  Edit2,
  X
} from 'lucide-react'
import styles from './Settings.module.css'
import inventoryStyles from './Inventory.module.css'

export default function Settings() {
  const { categories, refresh } = useInventory()

  // Category forms state
  const [catName, setCatName] = useState('')
  const [catAgingDays, setCatAgingDays] = useState(90)
  const [catColor, setCatColor] = useState('#005a9e')

  // Edit category state
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatAgingDays, setEditCatAgingDays] = useState(90)
  const [editCatColor, setEditCatColor] = useState('#005a9e')

  // System parameters
  const [schedulerInterval, setSchedulerInterval] = useState(10)
  const [scanning, setScanning] = useState(false)

  // Cascade delete double-check states
  const [resetConfirmType, setResetConfirmType] = useState<string | null>(null)

  // Fetch scheduler interval on load
  useEffect(() => {
    ipc.settings.getSchedulerInterval().then((min) => {
      setSchedulerInterval(min)
    }).catch(console.error)
  }, [])

  // ------------------------------------------------
  // Category CRUD
  // ------------------------------------------------
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catName.trim()) return

    try {
      const catId = crypto.randomUUID()
      await ipc.categories.create({
        id: catId,
        name: catName.trim(),
        agingDays: catAgingDays,
        color: catColor
      })
      setCatName('')
      setCatAgingDays(90)
      setCatColor('#005a9e')
      refresh()
    } catch (err: any) {
      alert(`Failed to create category: ${err.message}`)
    }
  }

  const startEditCategory = (cat: any) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatAgingDays(cat.agingDays)
    setEditCatColor(cat.color)
  }

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCatId || !editCatName.trim()) return

    try {
      await ipc.categories.update(editingCatId, {
        name: editCatName.trim(),
        agingDays: editCatAgingDays,
        color: editCatColor
      })
      setEditingCatId(null)
      refresh()
    } catch (err: any) {
      alert(`Failed to update category: ${err.message}`)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? It will fail if components are currently referencing it.')) return
    try {
      await ipc.categories.delete(id)
      refresh()
    } catch (err: any) {
      alert(err.message) // Shows the referential integrity check error we added!
    }
  }

  // ------------------------------------------------
  // System Configurations
  // ------------------------------------------------
  const handleSetSchedulerInterval = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const min = parseInt(e.target.value)
    setSchedulerInterval(min)
    try {
      await ipc.settings.setSchedulerInterval(min)
    } catch (err) {
      console.error(err)
    }
  }

  const handleRunManualScan = async () => {
    setScanning(true)
    try {
      await ipc.settings.runAlertScan()
      alert('Inventory alert scan completed. Unresolved warnings and aging stock states updated.')
    } catch (err: any) {
      alert(`Scan failed: ${err.message}`)
    } finally {
      setScanning(false)
    }
  }

  const handleBackupDB = async () => {
    try {
      const res = await ipc.settings.backupDB()
      if (res.success) {
        alert(`Database file successfully copied to: ${res.path}`)
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  // ------------------------------------------------
  // Cascade Resets
  // ------------------------------------------------
  const triggerReset = async (type: string) => {
    if (resetConfirmType !== type) {
      setResetConfirmType(type)
      return
    }

    // Prepare clear options
    const options = {
      alerts: type === 'alerts' || type === 'all',
      transactions: type === 'transactions' || type === 'all',
      boms: type === 'boms' || type === 'all',
      inventory: type === 'all'
    }

    try {
      await ipc.settings.resetData(options)
      alert('Database clearing operations posted successfully.')
      setResetConfirmType(null)
      refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className={styles.settingsGrid}>
      
      {/* Left side: Category Management */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span>Category Registry & Aging Thresholds</span>
        </div>
        <div className={styles.cardBody}>
          
          {/* Create Form */}
          {!editingCatId ? (
            <form onSubmit={handleCreateCategory} style={{ borderBottom: '1px solid var(--color-border-grid)', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>Register Category</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                <div className={inventoryStyles.formGroup}>
                  <label>Category Label</label>
                  <input 
                    type="text" 
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Breakers, Relays"
                    className={inventoryStyles.formInput}
                  />
                </div>

                <div className={inventoryStyles.formGroup}>
                  <label>Aging limit (days)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={catAgingDays}
                    onChange={(e) => setCatAgingDays(parseInt(e.target.value) || 90)}
                    className={inventoryStyles.formInput}
                  />
                </div>

                <div className={inventoryStyles.formGroup}>
                  <label>Tag Color</label>
                  <div className={styles.colorInputContainer}>
                    <input 
                      type="color" 
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      className={styles.colorPicker}
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className={`${inventoryStyles.actionButton} ${inventoryStyles.primaryActionButton}`} style={{ height: '28px', alignSelf: 'flex-end' }}>
                <Plus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Create Category
              </button>
            </form>
          ) : (
            // Edit Form
            <form onSubmit={handleUpdateCategory} style={{ borderBottom: '1px solid var(--color-border-grid)', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#faf9f8', padding: '10px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--color-brand-primary)' }}>Edit Category</h4>
                <button type="button" onClick={() => setEditingCatId(null)} className={inventoryStyles.adjustBtn}>
                  <X size={12} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                <div className={inventoryStyles.formGroup}>
                  <label>Category Label</label>
                  <input 
                    type="text" 
                    required
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    className={inventoryStyles.formInput}
                  />
                </div>

                <div className={inventoryStyles.formGroup}>
                  <label>Aging limit (days)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={editCatAgingDays}
                    onChange={(e) => setEditCatAgingDays(parseInt(e.target.value) || 90)}
                    className={inventoryStyles.formInput}
                  />
                </div>

                <div className={inventoryStyles.formGroup}>
                  <label>Tag Color</label>
                  <div className={styles.colorInputContainer}>
                    <input 
                      type="color" 
                      value={editCatColor}
                      onChange={(e) => setEditCatColor(e.target.value)}
                      className={styles.colorPicker}
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className={`${inventoryStyles.actionButton} ${inventoryStyles.primaryActionButton}`} style={{ height: '28px', alignSelf: 'flex-end' }}>
                Save Updates
              </button>
            </form>
          )}

          {/* Categories Spreadsheet Grid */}
          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', marginBottom: '8px' }}>Registered Categories</h4>
            {categories.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                No categories recorded yet. Use the form above to add one.
              </div>
            ) : (
              <table className={inventoryStyles.gridTable}>
                <thead>
                  <tr>
                    <th>Category Label Name</th>
                    <th style={{ textAlign: 'right' }}>Aging Days Threshold</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Tag Color</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Edit</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 'bold' }}>{cat.name}</td>
                      <td style={{ textAlign: 'right' }}>{cat.agingDays} days</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '4px', backgroundColor: cat.color, border: '1px solid var(--color-border-light)', verticalAlign: 'middle' }} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => startEditCategory(cat)} className={inventoryStyles.textButton}>
                          <Edit2 size={12} />
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)} 
                          className={inventoryStyles.textButton}
                          style={{ color: 'var(--color-error-text)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

      {/* Right side: Database Backup & Engine Config */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* System & DB Tools */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Database Backup & System Tasks</span>
          </div>
          <div className={styles.cardBody} style={{ gap: '16px' }}>
            
            {/* Scheduler */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-grid)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>Background Scan Interval</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>How often Stockyard audits stock aging thresholds.</div>
              </div>
              <select
                value={schedulerInterval}
                onChange={handleSetSchedulerInterval}
                className={inventoryStyles.filterSelect}
              >
                <option value="5">Every 5 Minutes</option>
                <option value="10">Every 10 Minutes</option>
                <option value="30">Every 30 Minutes</option>
                <option value="60">Every 60 Minutes</option>
              </select>
            </div>

            {/* Run Scan */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-grid)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>Run Audit Scan Manually</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Instantly recalculate low-stock warnings.</div>
              </div>
              <button 
                onClick={handleRunManualScan} 
                disabled={scanning}
                className={inventoryStyles.actionButton}
              >
                <Activity size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {scanning ? 'Scanning...' : 'Audit Scan'}
              </button>
            </div>

            {/* Backup DB */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>Database File Backup</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Copy local SQLite database binary ledger to files.</div>
              </div>
              <button 
                onClick={handleBackupDB} 
                className={inventoryStyles.actionButton}
                style={{ backgroundColor: 'var(--color-brand-primary)', color: '#fff', border: 'none' }}
              >
                <Database size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Backup database
              </button>
            </div>

          </div>
        </div>

        {/* Cascade Resets (Danger Zone) */}
        <div className={styles.card}>
          <div className={styles.cardHeader} style={{ color: 'var(--color-error-text)' }}>
            <span>Database Cascade Cleanups (Danger Zone)</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.dangerZone}>
              <div className={styles.dangerTitle}>CRITICAL DESTRUCTION ACTIONS</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                Erase system records recursively. Performing these operations resets raw tables inside SQLite. Always backup before running.
              </p>

              {/* Reset Alerts */}
              <div className={styles.dangerRow}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>Clear Alerts logs</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Clears active warnings and history archive.</span>
                </div>
                <button
                  onClick={() => triggerReset('alerts')}
                  className={`${styles.dangerActionBtn} ${resetConfirmType === 'alerts' ? styles.dangerActionBtnConfirm : ''}`}
                >
                  {resetConfirmType === 'alerts' ? 'Confirm Reset alerts' : 'Clear Alerts'}
                </button>
              </div>

              {/* Reset Transactions */}
              <div className={styles.dangerRow}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>Clear Stock Movement Ledger</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Erase immutable ledger movements logs.</span>
                </div>
                <button
                  onClick={() => triggerReset('transactions')}
                  className={`${styles.dangerActionBtn} ${resetConfirmType === 'transactions' ? styles.dangerActionBtnConfirm : ''}`}
                >
                  {resetConfirmType === 'transactions' ? 'Confirm Reset movements' : 'Clear Movements'}
                </button>
              </div>

              {/* Reset BOMs */}
              <div className={styles.dangerRow}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>Clear BOM Recipes</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Erase all panel templates and layout lists.</span>
                </div>
                <button
                  onClick={() => triggerReset('boms')}
                  className={`${styles.dangerActionBtn} ${resetConfirmType === 'boms' ? styles.dangerActionBtnConfirm : ''}`}
                >
                  {resetConfirmType === 'boms' ? 'Confirm Reset recipes' : 'Clear Recipes'}
                </button>
              </div>

              {/* Erase All */}
              <div className={styles.dangerRow} style={{ borderBottom: 'none', marginTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--color-error-text)' }}>CASCADE DB ERASE (RESET WHOLE DB)</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Erases categories, items, warnings, and logs. Empty start.</span>
                </div>
                <button
                  onClick={() => triggerReset('all')}
                  className={`${styles.dangerActionBtn} ${resetConfirmType === 'all' ? styles.dangerActionBtnConfirm : ''}`}
                  style={{ color: '#fff', backgroundColor: 'var(--color-error-text)', borderColor: 'var(--color-error-text)' }}
                >
                  {resetConfirmType === 'all' ? 'ARE YOU SURE? CLICK AGAIN TO ERASE DB' : 'Cascade Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

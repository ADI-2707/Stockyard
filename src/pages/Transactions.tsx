import { useState, useEffect } from 'react'
import { useInventory } from '../hooks/useInventory.ts'
import { useInventoryStore } from '../store/inventoryStore.ts'
import { ipc } from '../lib/ipc.ts'
import { 
  Download, 
  FilterX
} from 'lucide-react'
import styles from './Transactions.module.css'
import inventoryStyles from './Inventory.module.css'

export default function Transactions() {
  const { transactions, loadingTransactions } = useInventory()
  const store = useInventoryStore()

  // Local debounced search query state
  const [localSearch, setLocalSearch] = useState(store.txSearchTerm)

  useEffect(() => {
    setLocalSearch(store.txSearchTerm)
  }, [store.txSearchTerm])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== store.txSearchTerm) {
        store.setTxSearchTerm(localSearch)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [localSearch])

  // Pagination bounds from store metadata
  const totalPages = Math.ceil(store.totalTransactionsCount / store.transactionsLimit)
  const paginatedTransactions = transactions

  // Fetch unique operator names for filtering dropdown
  const [operatorsList, setOperatorsList] = useState<string[]>([])
  useEffect(() => {
    ipc.transactions.getOperators().then(setOperatorsList)
  }, [transactions])

  const formatDateTime = (dateStr: string) => {
    if (!dateStr || dateStr === 'CURRENT_TIMESTAMP') {
      return 'N/A'
    }
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z')
      return isNaN(d.getTime()) ? dateStr : d.toLocaleString()
    } catch {
      return dateStr || 'N/A'
    }
  }


  // ------------------------------------------------
  // Export Ledger to CSV
  // ------------------------------------------------
  const handleExportLedgerCSV = async () => {
    const headers = ['Date/Time', 'SKU Code', 'Component Description', 'Movement Type', 'Quantity Before', 'Quantity Changed', 'Quantity After', 'Operator Name', 'Reference PO/Job', 'Notes']
    
    try {
      // Fetch all matching records without paging limit for export
      const resData = await ipc.transactions.getFiltered({
        search: store.txSearchTerm,
        type: store.txTypeFilter,
        performedBy: store.txOperatorFilter
      })
      const allMatchingTransactions = resData.transactions

      const rows = allMatchingTransactions.map((tx: any) => {
        const isAdd = tx.type === 'IN' || tx.type === 'INITIAL'
        const afterQty = isAdd ? tx.quantityBefore + tx.quantity : tx.quantityBefore - tx.quantity
        
        return [
          formatDateTime(tx.createdAt),
          tx.itemSku || '',
          tx.itemName || '',
          tx.type,
          tx.quantityBefore,
          `${isAdd ? '+' : '-'}${tx.quantity}`,
          afterQty,
          tx.performedBy,
          tx.reference || '',
          tx.notes || ''
        ]
      })

      const res = await ipc.csv.export('stockyard_audit_ledger.csv', headers, rows)
      if (res.success) {
        alert(`Ledger audit list saved: ${res.path}`)
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  return (
    <div className={styles.container}>
      {/* Filters & CSV export control header */}
      <div className={styles.filters}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <input 
              type="text" 
              placeholder="Search SKU or Name..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className={inventoryStyles.searchInput}
            />
          </div>

          <select
            value={store.txTypeFilter}
            onChange={(e) => store.setTxTypeFilter(e.target.value)}
            className={inventoryStyles.filterSelect}
          >
            <option value="">[All Movements]</option>
            <option value="IN">IN (Stock Added)</option>
            <option value="OUT">OUT (Stock Consumed)</option>
            <option value="INITIAL">INITIAL (Creation Quantity)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Auditing)</option>
          </select>

          <select
            value={store.txOperatorFilter}
            onChange={(e) => store.setTxOperatorFilter(e.target.value)}
            className={inventoryStyles.filterSelect}
          >
            <option value="">[All Operators]</option>
            {operatorsList.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          {(store.txSearchTerm || store.txTypeFilter || store.txOperatorFilter) && (
            <button 
              onClick={() => {
                store.clearTxFilters()
              }}
              className={inventoryStyles.adjustBtn}
              style={{ width: '28px', height: '28px' }}
              title="Reset all filters"
            >
              <FilterX size={14} />
            </button>
          )}
        </div>

        <div>
          <button
            onClick={handleExportLedgerCSV}
            className={inventoryStyles.filterSelect}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Export Ledger CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Grid */}
      <div className={styles.tableContainer}>
        {loadingTransactions ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading ledger history...
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No stock movements match your query filters.
          </div>
        ) : (
          <table className={inventoryStyles.gridTable}>
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Ledger Timestamp</th>
                <th style={{ width: '110px' }}>SKU Code</th>
                <th>Component Description</th>
                <th style={{ width: '110px' }}>Action Type</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Stock Before</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Stock Changed</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Stock After</th>
                <th>Operator</th>
                <th>Reference PO/Job</th>
                <th>Transaction Rationale Notes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((tx) => {
                const isAdd = tx.type === 'IN' || tx.type === 'INITIAL'
                const afterQty = isAdd ? tx.quantityBefore + tx.quantity : tx.quantityBefore - tx.quantity
                
                let deltaColor = 'var(--color-text-primary)'
                let deltaSign = ''
                if (isAdd) {
                  deltaColor = 'var(--color-ok-text)'
                  deltaSign = '+'
                } else if (tx.type === 'OUT') {
                  deltaColor = 'var(--color-error-text)'
                  deltaSign = '-'
                }

                return (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{tx.itemSku}</td>
                    <td>{tx.itemName}</td>
                    <td>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '2px', backgroundColor: tx.type === 'IN' || tx.type === 'INITIAL' ? '#e2f0d9' : tx.type === 'OUT' ? '#fbe5d6' : '#fff2cc', color: tx.type === 'IN' || tx.type === 'INITIAL' ? '#385723' : tx.type === 'OUT' ? '#c65911' : '#7f6000', border: '1px solid currentColor' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{tx.quantityBefore}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: deltaColor }}>
                      {deltaSign}{tx.quantity}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{afterQty}</td>
                    <td>{tx.performedBy}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{tx.reference || '-'}</td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>{tx.notes || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        {store.totalTransactionsCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px var(--spacing-md)', borderTop: '1px solid var(--color-border-grid)', backgroundColor: '#faf9f8' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Showing {(store.transactionsPage - 1) * store.transactionsLimit + 1} to {Math.min(store.transactionsPage * store.transactionsLimit, store.totalTransactionsCount)} of {store.totalTransactionsCount} transactions
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => store.setTransactionsPage(Math.max(1, store.transactionsPage - 1))}
                disabled={store.transactionsPage === 1}
                className={inventoryStyles.actionButton}
                style={{ opacity: store.transactionsPage === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
                Page {store.transactionsPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => store.setTransactionsPage(Math.min(totalPages, store.transactionsPage + 1))}
                disabled={store.transactionsPage === totalPages || totalPages === 0}
                className={inventoryStyles.actionButton}
                style={{ opacity: store.transactionsPage === totalPages || totalPages === 0 ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useInventory } from '../hooks/useInventory.ts'
import { ipc } from '../lib/ipc.ts'
import { 
  Download, 
  FilterX
} from 'lucide-react'
import styles from './Transactions.module.css'
import inventoryStyles from './Inventory.module.css'

export default function Transactions() {
  const { transactions, loadingTransactions } = useInventory()

  // Filter states
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [operatorFilter, setOperatorFilter] = useState('')

  // 1. Reactive Filtering
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Search by SKU or Name
      if (search) {
        const query = search.toLowerCase()
        const matchSku = tx.itemSku?.toLowerCase().includes(query)
        const matchName = tx.itemName?.toLowerCase().includes(query)
        if (!matchSku && !matchName) return false
      }

      // Filter by Type
      if (typeFilter && tx.type !== typeFilter) {
        return false
      }

      // Filter by Operator
      if (operatorFilter && tx.performedBy !== operatorFilter) {
        return false
      }

      return true
    })
  }, [transactions, search, typeFilter, operatorFilter])

  // Extract unique operator names for filtering dropdown
  const operatorsList = useMemo(() => {
    const opsSet = new Set<string>()
    transactions.forEach(tx => {
      if (tx.performedBy) opsSet.add(tx.performedBy)
    })
    return Array.from(opsSet).sort()
  }, [transactions])

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val)
  }

  // ------------------------------------------------
  // Export Ledger to CSV
  // ------------------------------------------------
  const handleExportLedgerCSV = async () => {
    const headers = ['Date/Time', 'SKU Code', 'Component Description', 'Movement Type', 'Quantity Before', 'Quantity Changed', 'Quantity After', 'Operator Name', 'Reference PO/Job', 'Notes']
    const rows = filteredTransactions.map(tx => {
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

    try {
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inventoryStyles.searchInput}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={inventoryStyles.filterSelect}
          >
            <option value="">[All Movements]</option>
            <option value="IN">IN (Stock Added)</option>
            <option value="OUT">OUT (Stock Consumed)</option>
            <option value="INITIAL">INITIAL (Creation Quantity)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Auditing)</option>
          </select>

          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className={inventoryStyles.filterSelect}
          >
            <option value="">[All Operators]</option>
            {operatorsList.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          {(search || typeFilter || operatorFilter) && (
            <button 
              onClick={() => {
                setSearch('')
                setTypeFilter('')
                setOperatorFilter('')
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
        ) : filteredTransactions.length === 0 ? (
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
              {filteredTransactions.map((tx) => {
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
      </div>
    </div>
  )
}

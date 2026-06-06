import { useMemo } from 'react'
import { useInventory } from '../hooks/useInventory.ts'
import { useAlerts } from '../hooks/useAlerts.ts'
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { 
  Package, 
  TrendingDown, 
  IndianRupee, 
  Activity,
  Plus
} from 'lucide-react'
import styles from './Dashboard.module.css'

interface DashboardProps {
  setActiveTab: (tab: string) => void
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const { allItems, categories, transactions, loading: loadingInv } = useInventory()
  const { loading: loadingAlerts } = useAlerts()

  // 1. Calculate Valuation and Status Counts
  const stats = useMemo(() => {
    let valuation = 0
    let outOfStock = 0
    let lowStock = 0
    let aging = 0

    allItems.forEach((item) => {
      valuation += (item.quantity * item.costPerUnit)
      if (item.status === 'OUT') outOfStock++
      if (item.status === 'LOW') lowStock++
      if (item.status === 'AGING') aging++
    })

    return {
      valuation,
      outOfStock,
      lowStock,
      aging,
      totalSKUs: allItems.length
    }
  }, [allItems])

  // 2. Prepare Category distribution data for Donut Chart
  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; count: number; color: string }> = {}

    // Initialize with all categories
    categories.forEach(cat => {
      map[cat.id] = {
        name: cat.name,
        value: 0,
        count: 0,
        color: cat.color || '#005a9e'
      }
    })

    // Sum items in categories
    allItems.forEach(item => {
      const catId = item.categoryId || 'uncategorized'
      const itemValuation = item.quantity * item.costPerUnit
      
      if (!map[catId]) {
        map[catId] = {
          name: item.categoryName || 'Uncategorized',
          value: 0,
          count: 0,
          color: item.categoryColor || '#a19f9d'
        }
      }
      
      map[catId].value += itemValuation
      map[catId].count++
    })

    // Convert map to list and filter out empty categories for the chart
    return Object.values(map).filter(c => c.value > 0 || c.count > 0)
  }, [allItems, categories])

  // 3. Top 5 low-stock components
  const criticalItems = useMemo(() => {
    return allItems
      .filter((item) => item.status === 'LOW' || item.status === 'OUT')
      .sort((a, b) => {
        // Sort out of stock items first
        if (a.quantity === 0 && b.quantity > 0) return -1
        if (b.quantity === 0 && a.quantity > 0) return 1
        // Then sort by ratio of quantity to threshold (lowest first)
        const ratioA = a.quantity / (a.threshold || 1)
        const ratioB = b.quantity / (b.threshold || 1)
        return ratioA - ratioB
      })
      .slice(0, 5)
  }, [allItems])

  // 4. Last 5 recent transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5)
  }, [transactions])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val)
  }

  const isLoading = loadingInv || loadingAlerts

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Loading dashboard metrics...
      </div>
    )
  }

  // Database is empty placeholder
  if (allItems.length === 0 && categories.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--color-border-light)', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'var(--color-bg-card)', maxWidth: '600px', margin: '40px auto', boxShadow: 'var(--shadow-sm)' }}>
        <Package size={48} color="var(--color-brand-primary)" style={{ marginBottom: '16px' }} />
        <h2 style={{ marginBottom: '8px' }}>Welcome to Stockyard</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: 'var(--font-size-base)' }}>
          To get started, you will need to add a Category first (e.g. Relays, Breakers) inside Settings, then record your first inventory component.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button 
            onClick={() => setActiveTab('settings')}
            className={styles.actionButton}
            style={{ backgroundColor: 'var(--color-brand-primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={14} /> Add Category
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      {/* 1. Stat cards grid */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
          <span className={styles.statLabel}>Total SKUs</span>
          <span className={styles.statValue}>{stats.totalSKUs}</span>
          <span className={styles.statSubtext}>Component Catalog</span>
        </div>

        <div className={`${styles.statCard} ${styles.statCardError}`}>
          <span className={styles.statLabel}>Out of Stock</span>
          <span className={styles.statValue} style={{ color: 'var(--color-error-text)' }}>
            {stats.outOfStock}
          </span>
          <span className={styles.statSubtext}>Requires Immediate PO</span>
        </div>

        <div className={`${styles.statCard} ${styles.statCardWarning}`}>
          <span className={styles.statLabel}>Low Stock Warnings</span>
          <span className={styles.statValue} style={{ color: 'var(--color-warning-text)' }}>
            {stats.lowStock}
          </span>
          <span className={styles.statSubtext}>Below Threshold</span>
        </div>

        <div className={`${styles.statCard} ${styles.statCardAging}`}>
          <span className={styles.statLabel}>Aging Components</span>
          <span className={styles.statValue} style={{ color: 'var(--color-aging-text)' }}>
            {stats.aging}
          </span>
          <span className={styles.statSubtext}>No moves in {'>'} limit days</span>
        </div>

        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <span className={styles.statLabel}>Inventory Valuation</span>
          <span className={styles.statValue} style={{ color: 'var(--color-ok-text)' }}>
            {formatCurrency(stats.valuation)}
          </span>
          <span className={styles.statSubtext}>Asset Ledger Balance</span>
        </div>
      </div>

      {/* 2. Main content split */}
      <div className={styles.contentGrid}>
        {/* Left Side: Critical Items & Activity Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Critical Items Widget */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={16} color="var(--color-error-text)" />
                <span>Critical Stock Shortages</span>
              </div>
              <button 
                onClick={() => setActiveTab('inventory')}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'var(--font-weight-semibold)' }}
              >
                View full sheet
              </button>
            </div>
            <div className={styles.panelContent} style={{ padding: '0 var(--spacing-lg) var(--spacing-md)' }}>
              {criticalItems.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  All components have healthy stock levels.
                </div>
              ) : (
                <table className={styles.simpleTable}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Component Description</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th style={{ textAlign: 'right' }}>In Stock</th>
                      <th style={{ textAlign: 'right' }}>Min Lvl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{item.sku}</td>
                        <td>{item.name}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span 
                              className={styles.colorDot} 
                              style={{ backgroundColor: item.categoryColor || '#a19f9d', margin: 0 }} 
                            />
                            {item.categoryName}
                          </span>
                        </td>
                        <td>{item.location || '-'}</td>
                        <td 
                          style={{ textAlign: 'right', fontWeight: 'bold' }} 
                          className={item.status === 'OUT' ? styles.qtyOut : styles.qtyLow}
                        >
                          {item.quantity} {item.unit}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                          {item.threshold} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Ledger Transactions */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="var(--color-brand-primary)" />
                <span>Recent Stock Movements (Ledger Log)</span>
              </div>
              <button 
                onClick={() => setActiveTab('transactions')}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'var(--font-weight-semibold)' }}
              >
                View all transactions
              </button>
            </div>
            <div className={styles.panelContent} style={{ padding: '0 var(--spacing-lg) var(--spacing-md)' }}>
              {recentTransactions.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  No stock transactions logged yet. Add inventory count to see movements.
                </div>
              ) : (
                <table className={styles.simpleTable}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Component</th>
                      <th>Movement</th>
                      <th style={{ textAlign: 'right' }}>Qty Before</th>
                      <th style={{ textAlign: 'right' }}>Qty Delta</th>
                      <th>Performed By</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx) => {
                      const isAddition = tx.type === 'IN' || tx.type === 'INITIAL'
                      let deltaColor = 'var(--color-text-primary)'
                      let deltaSign = ''
                      
                      if (isAddition) {
                        deltaColor = 'var(--color-ok-text)'
                        deltaSign = '+'
                      } else if (tx.type === 'OUT') {
                        deltaColor = 'var(--color-error-text)'
                        deltaSign = '-'
                      }
                      
                      return (
                        <tr key={tx.id}>
                          <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td>
                            <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{tx.itemSku}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{tx.itemName}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '2px', backgroundColor: tx.type === 'IN' ? '#e2f0d9' : tx.type === 'OUT' ? '#fbe5d6' : '#fff2cc', color: tx.type === 'IN' ? '#385723' : tx.type === 'OUT' ? '#c65911' : '#7f6000', border: '1px solid currentColor' }}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{tx.quantityBefore}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: deltaColor }}>
                            {deltaSign}{tx.quantity}
                          </td>
                          <td>{tx.performedBy}</td>
                          <td style={{ color: 'var(--color-text-secondary)' }}>{tx.reference || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Category Asset Distribution Pie */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IndianRupee size={16} color="var(--color-brand-primary)" />
              <span>Asset Valuation Share</span>
            </div>
          </div>
          <div className={styles.panelContent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.chartContainer}>
              {categoryData.length === 0 ? (
                <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
                  No asset valuation logged.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Valuation Share']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* List breakdown of category totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '250px' }}>
              <div style={{ display: 'flex', justifyContent: 'between', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                <span style={{ flex: 1 }}>Category</span>
                <span style={{ width: '60px', textAlign: 'right' }}>SKUs</span>
                <span style={{ width: '100px', textAlign: 'right' }}>Asset Value</span>
              </div>
              {categoryData.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', fontSize: 'var(--font-size-sm)', padding: '4px 0' }}>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={styles.colorDot} style={{ backgroundColor: cat.color, margin: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      {cat.name}
                    </span>
                  </span>
                  <span style={{ width: '60px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                    {cat.count}
                  </span>
                  <span style={{ width: '100px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(cat.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

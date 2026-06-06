import { useState } from 'react'
import { useAlerts } from '../hooks/useAlerts.ts'
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Check, 
  BellOff, 
  CheckCircle,
  Archive
} from 'lucide-react'
import styles from './Alerts.module.css'
import inventoryStyles from './Inventory.module.css'

export default function Alerts() {
  const { activeAlerts, resolvedAlerts, loading, acknowledge, resolve } = useAlerts()
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'resolved'>('active')

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

  return (
    <div className={styles.alertPage}>
      {/* Tab Ribbon Header */}
      <div className={styles.subHeader}>
        <button
          onClick={() => setActiveSubTab('active')}
          className={`${styles.subTab} ${activeSubTab === 'active' ? styles.subTabActive : ''}`}
        >
          Active Warnings ({activeAlerts.length})
        </button>
        <button
          onClick={() => setActiveSubTab('resolved')}
          className={`${styles.subTab} ${activeSubTab === 'resolved' ? styles.subTabActive : ''}`}
        >
          Resolved Archive ({resolvedAlerts.length})
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading alert registers...
          </div>
        ) : activeSubTab === 'active' ? (
          // ACTIVE ALERTS LIST
          activeAlerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-light)' }}>
              <CheckCircle size={36} color="var(--color-ok-text)" style={{ marginBottom: '12px' }} />
              <p>No active alerts. All components have healthy stock counts and are within aging limits.</p>
            </div>
          ) : (
            <div className={styles.alertsGrid}>
              {activeAlerts.map((alert) => {
                let cardClass = styles.alertCard
                let Icon = Info
                let iconClass = styles.iconInfo

                if (alert.severity === 'CRITICAL') {
                  cardClass = `${styles.alertCard} ${styles.alertCritical}`
                  Icon = AlertOctagon
                  iconClass = styles.iconCritical
                } else if (alert.severity === 'WARNING') {
                  cardClass = `${styles.alertCard} ${styles.alertWarning}`
                  Icon = AlertTriangle
                  iconClass = styles.iconWarning
                } else if (alert.severity === 'INFO') {
                  cardClass = `${styles.alertCard} ${styles.alertInfo}`
                  Icon = Info
                  iconClass = styles.iconInfo
                }

                const isAck = !!alert.acknowledgedAt

                return (
                  <div key={alert.id} className={cardClass} style={{ opacity: isAck ? 0.75 : 1 }}>
                    <div className={styles.alertBody}>
                      <div className={styles.alertTitleRow}>
                        <Icon size={16} className={iconClass} />
                        <span style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>
                          {alert.itemSku} — {alert.itemName}
                        </span>
                        {isAck && (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-app)', padding: '1px 6px', borderRadius: '2px', border: '1px solid var(--color-border-light)' }}>
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <div className={styles.alertMsg}>{alert.message}</div>
                      <div className={styles.alertMeta}>
                        Triggered on {formatDateTime(alert.triggeredAt)}
                        {alert.categoryName ? ` | Category: ${alert.categoryName}` : ''}
                        {alert.acknowledgedAt ? ` | Acknowledged: ${formatDateTime(alert.acknowledgedAt)}` : ''}
                      </div>
                    </div>

                    <div className={styles.alertActions}>
                      {!isAck && (
                        <button
                          onClick={() => {
                            const performedBy = prompt('Enter operator initials / name to acknowledge alert:', 'Accounts')
                            if (performedBy !== null) {
                              acknowledge(alert.id, performedBy || 'Accounts')
                            }
                          }}
                          className={inventoryStyles.actionButton}
                          style={{ height: '24px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Acknowledge alert (snooze notification)"
                        >
                          <BellOff size={11} /> Acknowledge
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          const performedBy = prompt('Enter operator initials / name to resolve alert:', 'Accounts')
                          if (performedBy !== null) {
                            resolve(alert.id, performedBy || 'Accounts')
                          }
                        }}
                        className={inventoryStyles.actionButton}
                        style={{ height: '24px', fontSize: '11px', backgroundColor: 'var(--color-brand-primary-light)', color: 'var(--color-brand-primary)', borderColor: 'var(--color-brand-primary-light)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Mark alert resolved"
                      >
                        <Check size={11} /> Resolve
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          // RESOLVED ALERTS HISTORY
          resolvedAlerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-light)' }}>
              <Archive size={36} color="var(--color-text-disabled)" style={{ marginBottom: '12px' }} />
              <p>No resolved alerts in the history archive.</p>
            </div>
          ) : (
            <table className={inventoryStyles.gridTable}>
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Triggered At</th>
                  <th style={{ width: '120px' }}>Resolved At</th>
                  <th style={{ width: '120px' }}>Component</th>
                  <th>Alert Description Message</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Type</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {resolvedAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {formatDateTime(alert.triggeredAt)}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {alert.resolvedAt ? formatDateTime(alert.resolvedAt) : '-'}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{alert.itemSku}</td>
                    <td style={{ color: 'var(--color-text-primary)' }}>{alert.message}</td>
                    <td style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>{alert.type}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${inventoryStyles.statusBadge} ${alert.severity === 'CRITICAL' ? inventoryStyles.badgeOut : alert.severity === 'WARNING' ? inventoryStyles.badgeLow : inventoryStyles.badgeOk}`}>
                        {alert.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}

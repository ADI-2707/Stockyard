import React, { useEffect, useState } from 'react'
import { 
  LayoutDashboard, 
  Package, 
  AlertTriangle, 
  Receipt, 
  ClipboardList, 
  Settings as SettingsIcon,
  Clock,
  Database
} from 'lucide-react'
import { useAlertStore } from '../../store/alertStore'
import styles from './Layout.module.css'

interface LayoutProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  children: React.ReactNode
}

export default function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const { activeAlerts, fetchActiveAlerts, subscribeToAlerts } = useAlertStore()
  const [time, setTime] = useState(new Date())

  // Keep system clock updated (Excel/Access look)
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load and listen for active alerts
  useEffect(() => {
    fetchActiveAlerts()
    const unsubscribe = subscribeToAlerts()
    return () => unsubscribe()
  }, [])

  const activeAlertCount = activeAlerts.filter(a => a.isActive).length

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory Sheet', icon: Package },
    { id: 'bom', label: 'BOM Checker', icon: ClipboardList },
    { id: 'alerts', label: 'Alert Center', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'transactions', label: 'Ledger Audit', icon: Receipt },
    { id: 'settings', label: 'Settings & DB', icon: SettingsIcon }
  ]

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className={styles.layout}>
      {/* MS Office Top Titlebar */}
      <div className={styles.titleBar}>
        <div className={styles.titleText}>
          <Database size={14} className={styles.titleIcon} />
          <span>Stockyard Component Tracking (Accounts Mode)</span>
        </div>
        <div className={styles.systemClock}>
          <Clock size={12} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline' }} />
          <span>{formatDate(time)} - {formatTime(time)}</span>
        </div>
      </div>

      {/* Navigation Ribbon Tabs */}
      <div className={styles.ribbon}>
        <div className={styles.tabs}>
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tab} ${isActive ? styles.activeTab : ''}`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 ? (
                  <span className={styles.badge}>{tab.badge}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Grid Canvas area */}
      <div className={styles.workspace}>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

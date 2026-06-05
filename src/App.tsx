import { useState } from 'react'
import Layout from './components/layout/Layout.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Inventory from './pages/Inventory.tsx'
import BOM from './pages/BOM.tsx'
import Alerts from './pages/Alerts.tsx'
import Transactions from './pages/Transactions.tsx'
import Settings from './pages/Settings.tsx'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />
      case 'inventory':
        return <Inventory />
      case 'bom':
        return <BOM />
      case 'alerts':
        return <Alerts />
      case 'transactions':
        return <Transactions />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard setActiveTab={setActiveTab} />
    }
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  )
}

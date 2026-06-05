import { useEffect } from 'react'
import { useAlertStore } from '../store/alertStore'

export function useAlerts() {
  const {
    activeAlerts,
    resolvedAlerts,
    loadingAlerts,
    fetchActiveAlerts,
    fetchResolvedAlerts,
    acknowledgeAlert,
    resolveAlert,
    subscribeToAlerts
  } = useAlertStore()

  useEffect(() => {
    fetchActiveAlerts()
    fetchResolvedAlerts()

    // Establish live IPC update subscription
    const unsubscribe = subscribeToAlerts()
    return () => {
      unsubscribe()
    }
  }, [])

  return {
    activeAlerts,
    resolvedAlerts,
    loading: loadingAlerts,
    acknowledge: acknowledgeAlert,
    resolve: resolveAlert,
    refresh: () => {
      fetchActiveAlerts()
      fetchResolvedAlerts()
    }
  }
}

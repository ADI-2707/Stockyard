import { runAlertScan } from './alertEngine'

let schedulerInterval: NodeJS.Timeout | null = null
let intervalMinutesVal = 10

export function startAlertScheduler(minutes: number = 10) {
  stopAlertScheduler()
  
  intervalMinutesVal = minutes
  const intervalMs = minutes * 60 * 1000
  console.log(`Alert engine scheduled to run every ${minutes} minutes.`)

  // Execute scan immediately upon startup
  runAlertScan()

  schedulerInterval = setInterval(() => {
    runAlertScan()
  }, intervalMs)
}

export function stopAlertScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

export function getSchedulerInterval() {
  return intervalMinutesVal
}

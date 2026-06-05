import { dialog, BrowserWindow } from 'electron'
import fs from 'fs'

// Helper to escape values and build a valid CSV format
export function convertToCSV(headers: string[], rows: any[][]): string {
  const headerRow = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',')
  const dataRows = rows.map((row) =>
    row
      .map((val) => {
        if (val === null || val === undefined) return '""'
        // Escape quotes inside value strings
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(',')
  )
  return [headerRow, ...dataRows].join('\r\n')
}

export async function exportCSV(defaultFilename: string, headers: string[], rows: any[][]) {
  try {
    const windows = BrowserWindow.getAllWindows()
    const activeWindow = windows.find(w => !w.isDestroyed())
    if (!activeWindow) throw new Error('No active window found.')

    const savePath = dialog.showSaveDialogSync(activeWindow, {
      title: 'Save CSV Export',
      defaultPath: defaultFilename,
      filters: [{ name: 'CSV File (*.csv)', extensions: ['csv'] }]
    })

    if (!savePath) {
      return { success: false, cancelled: true }
    }

    const csvContent = convertToCSV(headers, rows)
    fs.writeFileSync(savePath, csvContent, 'utf-8')
    return { success: true, path: savePath }
  } catch (error: any) {
    console.error('Error during CSV export:', error)
    throw new Error(`Failed to export CSV: ${error.message}`)
  }
}

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { runMigrations, db } from './database/connection'
import { startAlertScheduler, stopAlertScheduler, getSchedulerInterval } from './services/scheduler'
import { runAlertScan } from './services/alertEngine'

// Import query functions
import { getAllCategories, createCategory, updateCategory, deleteCategory } from './database/queries/categories'
import { getAllItems, getFilteredItems, searchItemsAutocomplete, getUniqueLocations, getSimpleItemsList, getItemById, createItem, updateItem, adjustStock, softDeleteItem } from './database/queries/items'
import { getAllTransactions, getFilteredTransactions, getTransactionsByItemId, getUniqueOperators } from './database/queries/transactions'
import { getActiveAlerts, getResolvedAlerts, acknowledgeAlert, resolveAlert } from './database/queries/alerts'
import { getAllBOMTemplates, getBOMTemplateDetails, createBOMTemplate, updateBOMTemplate, deleteBOMTemplate, checkBOMCoverage } from './database/queries/bom'
import { exportCSV } from './services/csvExport'
import { items, transactions, alerts, bomTemplates, bomItems } from './database/schema'

let mainWindow: BrowserWindow | null = null

// Input sanitization: trim and cap operator names to 100 chars before storing in DB
function sanitizeOperator(name?: string): string {
  if (!name || typeof name !== 'string') return 'system'
  return name.trim().slice(0, 100) || 'system'
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    title: 'Stockyard - Inventory Component Tracker',
    // In dev: load icon from project root. In packaged: exe already has icon embedded.
    icon: app.isPackaged ? undefined : path.join(process.cwd(), 'build/stockyard_icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true // Enforce OS-level renderer isolation (safe: preload uses no Node APIs directly)
    }
  })

  // Disable native menu bar for clean Windows Application feel
  mainWindow.setMenuBarVisibility(false)

  // Vite Dev Server URL exists in dev mode, otherwise load static index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Uncomment below to open dev tools during development if needed
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(() => {
  // 1. Run database migrations at startup
  runMigrations()

  // 2. Open main window
  createWindow()

  // 3. Start background alert engine scheduler (runs once immediately, then every 10 min)
  startAlertScheduler(10)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopAlertScheduler()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ==========================================
// IPC Handler Registrations
// ==========================================

// --- Categories ---
ipcMain.handle('categories:getAll', async () => {
  return getAllCategories()
})
ipcMain.handle('categories:create', async (_, data) => {
  return createCategory(data)
})
ipcMain.handle('categories:update', async (_, { id, data }) => {
  return updateCategory(id, data)
})
ipcMain.handle('categories:delete', async (_, id) => {
  return deleteCategory(id)
})

// --- Items (Components) ---
ipcMain.handle('items:getAll', async () => {
  return getAllItems()
})
ipcMain.handle('items:getFiltered', async (_, params) => {
  return getFilteredItems(params)
})
ipcMain.handle('items:searchAutocomplete', async (_, search) => {
  return searchItemsAutocomplete(search)
})
ipcMain.handle('items:getLocations', async () => {
  return getUniqueLocations()
})
ipcMain.handle('items:getSimpleList', async () => {
  return getSimpleItemsList()
})
ipcMain.handle('items:getById', async (_, id) => {
  return getItemById(id)
})
ipcMain.handle('items:create', async (_, { data, performedBy }) => {
  const result = await createItem(data, sanitizeOperator(performedBy))
  // Run alert engine immediately to update status for new item
  await runAlertScan()
  return result
})
ipcMain.handle('items:update', async (_, { id, data, performedBy }) => {
  const result = await updateItem(id, data, sanitizeOperator(performedBy))
  // Run alert engine to reflect potential threshold or category threshold changes
  await runAlertScan()
  return result
})
ipcMain.handle('items:adjustStock', async (_, { itemId, quantityChange, type, performedBy, reference, notes }) => {
  const result = await adjustStock(itemId, quantityChange, type, sanitizeOperator(performedBy), reference, notes)
  // Run alert engine immediately to resolve/generate alerts after stock adjustment
  await runAlertScan()
  return result
})
ipcMain.handle('items:delete', async (_, id) => {
  const result = await softDeleteItem(id)
  await runAlertScan()
  return result
})

// --- Transactions (Audit Trail) ---
ipcMain.handle('transactions:getAll', async () => {
  return getAllTransactions()
})
ipcMain.handle('transactions:getFiltered', async (_, params) => {
  return getFilteredTransactions(params)
})
ipcMain.handle('transactions:getOperators', async () => {
  return getUniqueOperators()
})
ipcMain.handle('transactions:getByItem', async (_, itemId) => {
  return getTransactionsByItemId(itemId)
})

// --- Alerts ---
ipcMain.handle('alerts:getActive', async () => {
  return getActiveAlerts()
})
ipcMain.handle('alerts:getResolved', async () => {
  return getResolvedAlerts()
})
ipcMain.handle('alerts:acknowledge', async (_, { id, performedBy }) => {
  const result = await acknowledgeAlert(id, sanitizeOperator(performedBy))
  // Push update event to renderer so UI stores reload alert counts
  if (mainWindow) mainWindow.webContents.send('alerts:updated')
  return result
})
ipcMain.handle('alerts:resolve', async (_, { id, performedBy }) => {
  const result = await resolveAlert(id, sanitizeOperator(performedBy))
  if (mainWindow) mainWindow.webContents.send('alerts:updated')
  return result
})

// --- BOM Templates ---
ipcMain.handle('bom:getAll', async () => {
  return getAllBOMTemplates()
})
ipcMain.handle('bom:getDetails', async (_, bomId) => {
  return getBOMTemplateDetails(bomId)
})
ipcMain.handle('bom:create', async (_, { name, description, itemsList }) => {
  return createBOMTemplate(name, description, itemsList)
})
ipcMain.handle('bom:update', async (_, { bomId, name, description, itemsList }) => {
  return updateBOMTemplate(bomId, name, description, itemsList)
})
ipcMain.handle('bom:delete', async (_, bomId) => {
  return deleteBOMTemplate(bomId)
})
ipcMain.handle('bom:checkCoverage', async (_, { bomId, buildCount }) => {
  return checkBOMCoverage(bomId, buildCount)
})

// --- CSV Export ---
ipcMain.handle('csv:export', async (_, { defaultFilename, headers, rows }) => {
  return exportCSV(defaultFilename, headers, rows)
})

// --- System Settings ---
ipcMain.handle('settings:getSchedulerInterval', async () => {
  return getSchedulerInterval()
})
ipcMain.handle('settings:setSchedulerInterval', async (_, minutes) => {
  startAlertScheduler(minutes)
  return true
})
ipcMain.handle('settings:runAlertScan', async () => {
  await runAlertScan()
  return true
})
ipcMain.handle('settings:backupDB', async () => {
  try {
    if (!mainWindow) throw new Error('No active window found.')

    const defaultPath = path.join(
      app.getPath('downloads'),
      `stockyard_backup_${new Date().toISOString().slice(0, 10)}.db`
    )

    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Choose Backup Destination',
      defaultPath: defaultPath,
      filters: [{ name: 'SQLite DB (*.db)', extensions: ['db'] }]
    })

    if (!savePath) return { success: false, cancelled: true }

    const dbFilePath = path.join(app.getPath('userData'), 'inventory.db')
    if (fs.existsSync(dbFilePath)) {
      fs.copyFileSync(dbFilePath, savePath)
      return { success: true, path: savePath }
    } else {
      throw new Error('Active database file could not be found.')
    }
  } catch (error: any) {
    console.error('Database backup failed:', error)
    throw new Error(`Backup failed: ${error.message}`)
  }
})
ipcMain.handle('settings:resetData', async (_, options: { transactions: boolean; alerts: boolean; inventory: boolean; boms: boolean }) => {
  try {
    return db.transaction((tx) => {
      if (options.alerts) {
        tx.delete(alerts).run()
      }
      if (options.transactions) {
        tx.delete(transactions).run()
      }
      if (options.boms) {
        tx.delete(bomItems).run()
        tx.delete(bomTemplates).run()
      }
      if (options.inventory) {
        // Drop all records recursively due to references
        tx.delete(alerts).run()
        tx.delete(transactions).run()
        tx.delete(bomItems).run()
        tx.delete(items).run()
      }
      return { success: true }
    })
  } catch (error: any) {
    console.error('Data reset failed:', error)
    throw new Error(`Data reset failed: ${error.message}`)
  }
})

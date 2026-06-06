import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

let dbPath: string

try {
  // If running inside Electron main process
  const { app } = require('electron')
  const userDataPath = app.getPath('userData')
  
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }
  
  dbPath = path.join(userDataPath, 'inventory.db')
} catch (e) {
  // Fallback for CLI migrations, seeders, or node runs
  dbPath = path.resolve(process.cwd(), 'inventory.db')
}

console.log('SQLite database path:', dbPath)

const sqlite = new Database(dbPath)
export const db = drizzle(sqlite, { schema })

export function runMigrations() {
  try {
    let migrationsFolder: string
    
    try {
      const { app } = require('electron')
      if (app.isPackaged) {
        migrationsFolder = path.join(process.resourcesPath, 'drizzle')
      } else {
        migrationsFolder = path.join(process.cwd(), 'drizzle')
      }
    } catch {
      migrationsFolder = path.resolve(process.cwd(), 'drizzle')
    }
    
    console.log('Running SQLite migrations from:', migrationsFolder)
    migrate(db, { migrationsFolder })
    console.log('Migrations completed successfully.')

    // Clean up any legacy literal 'CURRENT_TIMESTAMP' values
    const timestamp = new Date().toISOString()
    sqlite.prepare("UPDATE items SET added_at = ? WHERE added_at = 'CURRENT_TIMESTAMP'").run(timestamp)
    sqlite.prepare("UPDATE transactions SET created_at = ? WHERE created_at = 'CURRENT_TIMESTAMP'").run(timestamp)
    sqlite.prepare("UPDATE alerts SET triggered_at = ? WHERE triggered_at = 'CURRENT_TIMESTAMP'").run(timestamp)
    sqlite.prepare("UPDATE bom_templates SET created_at = ? WHERE created_at = 'CURRENT_TIMESTAMP'").run(timestamp)
    console.log('Cleaned up legacy database timestamps.')
  } catch (error) {
    console.error('Failed to run database migrations:', error)
  }
}

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
  } catch (error) {
    console.error('Failed to run database migrations:', error)
  }
}

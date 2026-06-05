import { db } from '../database/connection.ts'
import { items, categories, alerts } from '../database/schema.ts'
import { createAlert } from '../database/queries/alerts.ts'
import { eq, and, isNull, sql } from 'drizzle-orm'
import sendNotification from './notifier.ts'

// Standard helper to calculate days elapsed since a date ISO string
function getDaysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  const date = new Date(dateStr)
  const diffTime = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
}

export async function runAlertScan() {
  console.log('Starting background alert engine scan...')
  try {
    const { BrowserWindow } = require('electron')

    // Fetch all active items and categories
    const allItems = db
      .select({
        id: items.id,
        name: items.name,
        sku: items.sku,
        quantity: items.quantity,
        unit: items.unit,
        threshold: items.threshold,
        lastMovedAt: items.lastMovedAt,
        addedAt: items.addedAt,
        categoryId: items.categoryId,
        categoryName: categories.name,
        categoryAgingDays: categories.agingDays
      })
      .from(items)
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .where(isNull(items.deletedAt))
      .all()

    // Keep track of whether we made changes to notify the UI
    let hasUpdated = false

    for (const item of allItems) {
      const { id: itemId, name, sku, quantity, threshold, lastMovedAt, addedAt, categoryAgingDays } = item

      // 1. Check Out of Stock (CRITICAL)
      if (quantity === 0) {
        // Create critical alert
        const msg = `${name} (${sku}) is completely out of stock!`
        const createdId = await createAlert(itemId, 'OUT_OF_STOCK', 'CRITICAL', msg)

        // If a new alert was actually generated, trigger OS notification
        if (createdId) {
          hasUpdated = true
          sendNotification('Stock Alert - Critical', msg)
        }

        // Since it's OUT_OF_STOCK, resolve any LOW_STOCK warning that was active
        const resolved = db.update(alerts)
          .set({ isActive: 0, resolvedAt: new Date().toISOString() })
          .where(and(eq(alerts.itemId, itemId), eq(alerts.type, 'LOW_STOCK'), eq(alerts.isActive, 1)))
          .run()
        if (resolved.changes > 0) hasUpdated = true
      }

      // 2. Check Low Stock (WARNING)
      else if (quantity <= threshold) {
        const msg = `${name} (${sku}) is low on stock (${quantity} ${item.unit} remaining, threshold: ${threshold}).`
        const createdId = await createAlert(itemId, 'LOW_STOCK', 'WARNING', msg)
        if (createdId) hasUpdated = true

        // Resolve any OUT_OF_STOCK alert
        const resolved = db.update(alerts)
          .set({ isActive: 0, resolvedAt: new Date().toISOString() })
          .where(and(eq(alerts.itemId, itemId), eq(alerts.type, 'OUT_OF_STOCK'), eq(alerts.isActive, 1)))
          .run()
        if (resolved.changes > 0) hasUpdated = true
      }

      // 3. Stock is healthy: Resolve both OUT_OF_STOCK and LOW_STOCK warnings
      else {
        const resolved = db.update(alerts)
          .set({ isActive: 0, resolvedAt: new Date().toISOString() })
          .where(
            and(
              eq(alerts.itemId, itemId),
              eq(alerts.isActive, 1),
              sql`type IN ('LOW_STOCK', 'OUT_OF_STOCK')`
            )
          )
          .run()
        if (resolved.changes > 0) hasUpdated = true
      }

      // 4. Check Aging Stock (INFO)
      const agingDaysLimit = categoryAgingDays !== null ? categoryAgingDays : 90
      const referenceDate = lastMovedAt || addedAt
      const daysUnmoved = getDaysSince(referenceDate)

      if (daysUnmoved >= agingDaysLimit && quantity > 0) {
        const msg = `${name} (${sku}) is aging. Unmoved for ${daysUnmoved} days (limit: ${agingDaysLimit} days).`
        const createdId = await createAlert(itemId, 'AGING', 'INFO', msg)
        if (createdId) hasUpdated = true
      } else {
        // Resolve aging alert if it was active
        const resolved = db.update(alerts)
          .set({ isActive: 0, resolvedAt: new Date().toISOString() })
          .where(and(eq(alerts.itemId, itemId), eq(alerts.type, 'AGING'), eq(alerts.isActive, 1)))
          .run()
        if (resolved.changes > 0) hasUpdated = true
      }
    }

    // If changes occurred, push an update signal to all open renderer windows
    if (hasUpdated) {
      console.log('Alert status changed, pushing update to renderer.')
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('alerts:updated')
        }
      }
    }
  } catch (err) {
    console.error('Error during alert engine run:', err)
  }
}

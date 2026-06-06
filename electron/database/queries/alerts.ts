import { db } from '../connection'
import { alerts, items, categories, transactions } from '../schema'
import { eq, and, desc, isNull } from 'drizzle-orm'

function generateId() {
  return crypto.randomUUID()
}

export async function getActiveAlerts() {
  return db
    .select({
      id: alerts.id,
      itemId: alerts.itemId,
      itemName: items.name,
      itemSku: items.sku,
      itemQuantity: items.quantity,
      itemThreshold: items.threshold,
      itemUnit: items.unit,
      categoryName: categories.name,
      categoryColor: categories.color,
      type: alerts.type,
      severity: alerts.severity,
      message: alerts.message,
      isActive: alerts.isActive,
      acknowledgedAt: alerts.acknowledgedAt,
      triggeredAt: alerts.triggeredAt
    })
    .from(alerts)
    .innerJoin(items, eq(alerts.itemId, items.id))
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(and(eq(alerts.isActive, 1), isNull(items.deletedAt)))
    .orderBy(desc(alerts.triggeredAt))
    .all()
}

export async function getResolvedAlerts() {
  return db
    .select({
      id: alerts.id,
      itemId: alerts.itemId,
      itemName: items.name,
      itemSku: items.sku,
      type: alerts.type,
      severity: alerts.severity,
      message: alerts.message,
      triggeredAt: alerts.triggeredAt,
      resolvedAt: alerts.resolvedAt
    })
    .from(alerts)
    .innerJoin(items, eq(alerts.itemId, items.id))
    .where(eq(alerts.isActive, 0))
    .orderBy(desc(alerts.resolvedAt))
    .all()
}

export async function acknowledgeAlert(id: string, performedBy?: string) {
  const timestamp = new Date().toISOString()
  return db.transaction((tx) => {
    const alert = tx.select().from(alerts).where(eq(alerts.id, id)).get()
    if (!alert) {
      throw new Error('Alert not found')
    }
    if (!alert.itemId) {
      throw new Error('Alert is not associated with any component')
    }

    const item = tx.select().from(items).where(eq(items.id, alert.itemId)).get()

    tx.update(alerts)
      .set({ acknowledgedAt: timestamp })
      .where(eq(alerts.id, id))
      .run()

    tx.insert(transactions)
      .values({
        id: generateId(),
        itemId: alert.itemId,
        type: 'ALERT_ACK',
        quantity: 0,
        quantityBefore: item?.quantity ?? 0,
        performedBy: performedBy || 'system',
        reference: `Alert ID: ${id.slice(0, 8)}`,
        notes: `Acknowledged active alert: [${alert.type}] ${alert.message}`,
        createdAt: timestamp
      })
      .run()
  })
}

export async function resolveAlert(id: string, performedBy?: string) {
  const timestamp = new Date().toISOString()
  return db.transaction((tx) => {
    const alert = tx.select().from(alerts).where(eq(alerts.id, id)).get()
    if (!alert) {
      throw new Error('Alert not found')
    }
    if (!alert.itemId) {
      throw new Error('Alert is not associated with any component')
    }

    const item = tx.select().from(items).where(eq(items.id, alert.itemId)).get()

    tx.update(alerts)
      .set({
        isActive: 0,
        resolvedAt: timestamp
      })
      .where(eq(alerts.id, id))
      .run()

    tx.insert(transactions)
      .values({
        id: generateId(),
        itemId: alert.itemId,
        type: 'ALERT_RESOLVE',
        quantity: 0,
        quantityBefore: item?.quantity ?? 0,
        performedBy: performedBy || 'system',
        reference: `Alert ID: ${id.slice(0, 8)}`,
        notes: `Resolved alert: [${alert.type}] ${alert.message}`,
        createdAt: timestamp
      })
      .run()
  })
}

export async function createAlert(itemId: string, type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'AGING', severity: 'INFO' | 'WARNING' | 'CRITICAL', message: string) {
  // Check if there is already an active alert of this exact type for this item
  const existing = db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.itemId, itemId),
        eq(alerts.type, type),
        eq(alerts.isActive, 1)
      )
    )
    .get()

  if (existing) {
    return null
  }

  const alertId = generateId()
  db.insert(alerts)
    .values({
      id: alertId,
      itemId,
      type,
      severity,
      message,
      isActive: 1
    })
    .run()

  return alertId
}

export async function resolveAlertsForItem(itemId: string, type?: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'AGING') {
  const timestamp = new Date().toISOString()
  if (type) {
    return db
      .update(alerts)
      .set({
        isActive: 0,
        resolvedAt: timestamp
      })
      .where(
        and(
          eq(alerts.itemId, itemId),
          eq(alerts.type, type),
          eq(alerts.isActive, 1)
        )
      )
      .run()
  } else {
    return db
      .update(alerts)
      .set({
        isActive: 0,
        resolvedAt: timestamp
      })
      .where(
        and(
          eq(alerts.itemId, itemId),
          eq(alerts.isActive, 1)
        )
      )
      .run()
  }
}

import { db } from '../connection'
import { items, categories, transactions } from '../schema'
import { eq, and, isNull, sql } from 'drizzle-orm'

// Standard UUID/ID generator for SQLite records
function generateId() {
  return crypto.randomUUID()
}

export async function getAllItems() {
  // Return items with their category name, excluding soft-deleted items
  return db
    .select({
      id: items.id,
      name: items.name,
      sku: items.sku,
      categoryId: items.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      quantity: items.quantity,
      unit: items.unit,
      threshold: items.threshold,
      maxStock: items.maxStock,
      location: items.location,
      costPerUnit: items.costPerUnit,
      supplier: items.supplier,
      lastMovedAt: items.lastMovedAt,
      addedAt: items.addedAt,
      notes: items.notes
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(isNull(items.deletedAt))
    .all()
}

export async function getItemById(id: string) {
  return db
    .select()
    .from(items)
    .where(and(eq(items.id, id), isNull(items.deletedAt)))
    .get()
}

export async function createItem(data: any, performedBy: string) {
  const itemId = data.id || generateId()
  const initialQty = data.quantity || 0
  const timestamp = new Date().toISOString()

  return db.transaction((tx) => {
    // 1. Insert Item
    tx.insert(items)
      .values({
        id: itemId,
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId,
        quantity: initialQty,
        unit: data.unit || 'pcs',
        threshold: data.threshold !== undefined ? data.threshold : 5,
        maxStock: data.maxStock,
        location: data.location,
        costPerUnit: data.costPerUnit || 0,
        supplier: data.supplier,
        lastMovedAt: initialQty > 0 ? timestamp : null,
        notes: data.notes
      })
      .run()

    // 2. Insert initial transaction if quantity > 0
    if (initialQty > 0) {
      tx.insert(transactions)
        .values({
          id: generateId(),
          itemId: itemId,
          type: 'INITIAL',
          quantity: initialQty,
          quantityBefore: 0,
          performedBy: performedBy || 'system',
          reference: 'Initial Setup',
          notes: 'Initial stock recorded upon creation.'
        })
        .run()
    }

    return itemId
  })
}

export async function updateItem(id: string, data: any) {
  return db
    .update(items)
    .set({
      name: data.name,
      sku: data.sku,
      categoryId: data.categoryId,
      unit: data.unit,
      threshold: data.threshold,
      maxStock: data.maxStock,
      location: data.location,
      costPerUnit: data.costPerUnit,
      supplier: data.supplier,
      notes: data.notes
    })
    .where(eq(items.id, id))
    .run()
}

export async function adjustStock(
  itemId: string,
  quantityChange: number, // Signed delta: e.g. +10, -5
  type: 'IN' | 'OUT' | 'ADJUSTMENT',
  performedBy: string,
  reference?: string,
  notes?: string
) {
  const timestamp = new Date().toISOString()

  return db.transaction((tx) => {
    // Get current item
    const item = tx.select().from(items).where(eq(items.id, itemId)).get()
    if (!item) {
      throw new Error('Component not found.')
    }

    const currentQty = item.quantity
    const newQty = currentQty + quantityChange

    if (newQty < 0) {
      throw new Error(`Insufficient stock. Cannot consume ${Math.abs(quantityChange)} ${item.unit}. Currently in stock: ${currentQty}.`)
    }

    // Update item stock
    tx.update(items)
      .set({
        quantity: newQty,
        lastMovedAt: timestamp
      })
      .where(eq(items.id, itemId))
      .run()

    // Log transaction (save absolute value for quantity column)
    tx.insert(transactions)
      .values({
        id: generateId(),
        itemId: itemId,
        type: type,
        quantity: Math.abs(quantityChange),
        quantityBefore: currentQty,
        performedBy: performedBy || 'system',
        reference: reference || null,
        notes: notes || null
      })
      .run()

    return newQty
  })
}

export async function softDeleteItem(id: string) {
  const timestamp = new Date().toISOString()
  return db
    .update(items)
    .set({ deletedAt: timestamp })
    .where(eq(items.id, id))
    .run()
}

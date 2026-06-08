import { db } from '../connection'
import { items, categories, transactions } from '../schema'
import { eq, and, isNull, or, sql } from 'drizzle-orm'

export async function getFilteredItems(params: {
  search?: string
  categoryId?: string
  location?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const { search, categoryId, location, status, limit = 100, offset = 0 } = params

  // 1. Base query with joins
  let baseQuery = db
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
      notes: items.notes,
      daysUnmoved: sql<number>`
        CASE 
          WHEN julianday('now') > julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) 
          THEN CAST(julianday('now') - julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) AS INTEGER)
          ELSE 0 
        END
      `,
      agingDaysLimit: sql<number>`COALESCE(${categories.agingDays}, 90)`,
      status: sql<string>`
        CASE 
          WHEN ${items.quantity} = 0 THEN 'OUT'
          WHEN ${items.quantity} <= ${items.threshold} THEN 'LOW'
          WHEN CASE 
            WHEN julianday('now') > julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) 
            THEN CAST(julianday('now') - julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) AS INTEGER)
            ELSE 0 
          END >= COALESCE(${categories.agingDays}, 90) THEN 'AGING'
          ELSE 'OK'
        END
      `
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .$dynamic()

  // 2. Build where conditions
  const conditions = [isNull(items.deletedAt)]

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`
    conditions.push(
      or(
        sql`lower(${items.sku}) LIKE ${searchPattern}`,
        sql`lower(${items.name}) LIKE ${searchPattern}`
      )!
    )
  }

  if (categoryId) {
    conditions.push(eq(items.categoryId, categoryId))
  }

  if (location) {
    conditions.push(eq(items.location, location))
  }

  let whereQuery = baseQuery.where(and(...conditions))

  // Filter by calculated status at database level
  if (status) {
    if (status === 'OUT') {
      whereQuery = whereQuery.where(eq(items.quantity, 0))
    } else if (status === 'LOW') {
      whereQuery = whereQuery.where(
        and(
          sql`${items.quantity} > 0`,
          sql`${items.quantity} <= ${items.threshold}`
        )
      )
    } else if (status === 'AGING') {
      whereQuery = whereQuery.where(
        and(
          sql`${items.quantity} > 0`,
          sql`CASE 
            WHEN julianday('now') > julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) 
            THEN CAST(julianday('now') - julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) AS INTEGER)
            ELSE 0 
          END >= COALESCE(${categories.agingDays}, 90)`
        )
      )
    } else if (status === 'OK') {
      whereQuery = whereQuery.where(
        and(
          sql`${items.quantity} > ${items.threshold}`,
          sql`CASE 
            WHEN julianday('now') > julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) 
            THEN CAST(julianday('now') - julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) AS INTEGER)
            ELSE 0 
          END < COALESCE(${categories.agingDays}, 90)`
        )
      )
    }
  }

  // Get total count for pagination controls
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(and(...conditions))
    .$dynamic()

  if (status) {
    if (status === 'OUT') {
      countQuery = countQuery.where(eq(items.quantity, 0))
    } else if (status === 'LOW') {
      countQuery = countQuery.where(
        and(
          sql`${items.quantity} > 0`,
          sql`${items.quantity} <= ${items.threshold}`
        )
      )
    } else if (status === 'AGING') {
      countQuery = countQuery.where(
        and(
          sql`${items.quantity} > 0`,
          sql`CASE 
            WHEN julianday('now') > julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) 
            THEN CAST(julianday('now') - julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) AS INTEGER)
            ELSE 0 
          END >= COALESCE(${categories.agingDays}, 90)`
        )
      )
    } else if (status === 'OK') {
      countQuery = countQuery.where(
        and(
          sql`${items.quantity} > ${items.threshold}`,
          sql`CASE 
            WHEN julianday('now') > julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) 
            THEN CAST(julianday('now') - julianday(COALESCE(${items.lastMovedAt}, ${items.addedAt})) AS INTEGER)
            ELSE 0 
          END < COALESCE(${categories.agingDays}, 90)`
        )
      )
    }
  }

  const [{ count }] = countQuery.all()
  const data = whereQuery.limit(limit).offset(offset).all()

  return {
    items: data,
    totalCount: count
  }
}

export async function searchItemsAutocomplete(search: string) {
  const searchPattern = `%${search.toLowerCase()}%`
  return db
    .select({
      id: items.id,
      sku: items.sku,
      name: items.name
    })
    .from(items)
    .where(
      and(
        isNull(items.deletedAt),
        or(
          sql`lower(${items.sku}) LIKE ${searchPattern}`,
          sql`lower(${items.name}) LIKE ${searchPattern}`
        )
      )
    )
    .limit(25)
    .all()
}

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
          notes: 'Initial stock recorded upon creation.',
          createdAt: timestamp
        })
        .run()
    }

    return itemId
  })
}

export async function updateItem(id: string, data: any, performedBy?: string) {
  const timestamp = new Date().toISOString()

  return db.transaction((tx) => {
    // Get current item for quantity snapshot
    const current = tx.select().from(items).where(eq(items.id, id)).get()

    tx.update(items)
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

    // Log an EDIT transaction so metadata changes appear in the ledger
    tx.insert(transactions)
      .values({
        id: generateId(),
        itemId: id,
        type: 'EDIT',
        quantity: 0,
        quantityBefore: current?.quantity ?? 0,
        performedBy: performedBy || 'system',
        reference: null,
        notes: `Component details updated (name, SKU, category, thresholds, etc.)`,
        createdAt: timestamp
      })
      .run()
  })
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
        notes: notes || null,
        createdAt: timestamp
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

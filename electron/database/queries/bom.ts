import { db } from '../connection'
import { bomTemplates, bomItems, items } from '../schema'
import { eq, sql } from 'drizzle-orm'

function generateId() {
  return crypto.randomUUID()
}

export async function getAllBOMTemplates() {
  return db
    .select({
      id: bomTemplates.id,
      name: bomTemplates.name,
      description: bomTemplates.description,
      createdAt: bomTemplates.createdAt
    })
    .from(bomTemplates)
    .all()
}

export async function getBOMTemplateDetails(bomId: string) {
  const template = db
    .select()
    .from(bomTemplates)
    .where(eq(bomTemplates.id, bomId))
    .get()

  if (!template) {
    throw new Error('BOM Template not found.')
  }

  // Get all items in this BOM template
  const templateItems = db
    .select({
      itemId: bomItems.itemId,
      name: items.name,
      sku: items.sku,
      unit: items.unit,
      inStock: items.quantity,
      costPerUnit: items.costPerUnit,
      quantityRequired: bomItems.quantity
    })
    .from(bomItems)
    .innerJoin(items, eq(bomItems.itemId, items.id))
    .where(eq(bomItems.bomId, bomId))
    .all()

  return {
    ...template,
    items: templateItems
  }
}

export async function createBOMTemplate(
  name: string,
  description: string,
  itemsList: { itemId: string; quantity: number }[]
) {
  const bomId = generateId()
  const timestamp = new Date().toISOString()

  return db.transaction((tx) => {
    // 1. Create the template record
    tx.insert(bomTemplates)
      .values({
        id: bomId,
        name,
        description,
        createdAt: timestamp
      })
      .run()

    // 2. Add items to the BOM
    for (const item of itemsList) {
      if (item.quantity <= 0) continue
      tx.insert(bomItems)
        .values({
          bomId,
          itemId: item.itemId,
          quantity: item.quantity
        })
        .run()
    }

    return bomId
  })
}

export async function updateBOMTemplate(
  bomId: string,
  name: string,
  description: string,
  itemsList: { itemId: string; quantity: number }[]
) {
  return db.transaction((tx) => {
    // 1. Update template basic info
    tx.update(bomTemplates)
      .set({ name, description })
      .where(eq(bomTemplates.id, bomId))
      .run()

    // 2. Clear existing items
    tx.delete(bomItems).where(eq(bomItems.bomId, bomId)).run()

    // 3. Insert new items
    for (const item of itemsList) {
      if (item.quantity <= 0) continue
      tx.insert(bomItems)
        .values({
          bomId,
          itemId: item.itemId,
          quantity: item.quantity
        })
        .run()
    }

    return bomId
  })
}

export async function deleteBOMTemplate(bomId: string) {
  return db.transaction((tx) => {
    // Delete items mapping first
    tx.delete(bomItems).where(eq(bomItems.bomId, bomId)).run()
    // Delete the template itself
    tx.delete(bomTemplates).where(eq(bomTemplates.id, bomId)).run()
  })
}

export async function checkBOMCoverage(bomId: string, buildCount: number) {
  // Execute a raw SQL query that calculates required count, shortage, and line costs
  // SQLite scalar CASE WHEN statement is used for calculating shortage to remain robust across all runtimes
  return db.all(sql`
    SELECT
      i.id as id,
      i.name as name,
      i.sku as sku,
      i.quantity as inStock,
      i.unit as unit,
      i.cost_per_unit as costPerUnit,
      b.quantity as quantityPerBuild,
      (b.quantity * ${buildCount}) as required,
      CASE WHEN i.quantity >= (b.quantity * ${buildCount}) THEN 'OK' ELSE 'SHORT' END as status,
      CASE WHEN (b.quantity * ${buildCount}) > i.quantity THEN (b.quantity * ${buildCount}) - i.quantity ELSE 0 END as shortage,
      (i.cost_per_unit * b.quantity * ${buildCount}) as lineCost
    FROM bom_items b
    JOIN items i ON i.id = b.item_id
    WHERE b.bom_id = ${bomId} AND i.deleted_at IS NULL
    ORDER BY status DESC, shortage DESC
  `) as unknown as Array<{
    id: string
    name: string
    sku: string
    inStock: number
    unit: string
    costPerUnit: number
    quantityPerBuild: number
    required: number
    status: 'OK' | 'SHORT'
    shortage: number
    lineCost: number
  }>
}

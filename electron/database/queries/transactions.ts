import { db } from '../connection'
import { transactions, items } from '../schema'
import { eq, desc, and, or, sql } from 'drizzle-orm'

export async function getFilteredTransactions(params: {
  search?: string
  type?: string
  performedBy?: string
  limit?: number
  offset?: number
}) {
  const { search, type, performedBy, limit, offset = 0 } = params

  let baseQuery = db
    .select({
      id: transactions.id,
      itemId: transactions.itemId,
      itemName: items.name,
      itemSku: items.sku,
      type: transactions.type,
      quantity: transactions.quantity,
      quantityBefore: transactions.quantityBefore,
      performedBy: transactions.performedBy,
      reference: transactions.reference,
      notes: transactions.notes,
      createdAt: transactions.createdAt
    })
    .from(transactions)
    .leftJoin(items, eq(transactions.itemId, items.id))
    .orderBy(desc(transactions.createdAt))
    .$dynamic()

  const conditions = []

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`
    conditions.push(
      or(
        sql`lower(${items.sku}) LIKE ${searchPattern}`,
        sql`lower(${items.name}) LIKE ${searchPattern}`
      )!
    )
  }

  if (type) {
    conditions.push(eq(transactions.type, type))
  }

  if (performedBy) {
    conditions.push(eq(transactions.performedBy, performedBy))
  }

  let whereQuery = baseQuery
  if (conditions.length > 0) {
    whereQuery = baseQuery.where(and(...conditions))
  }

  // Count query
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .leftJoin(items, eq(transactions.itemId, items.id))
    .$dynamic()

  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions))
  }

  const [{ count }] = countQuery.all()

  let pagedQuery = whereQuery
  if (limit !== undefined) {
    pagedQuery = pagedQuery.limit(limit).offset(offset)
  }

  const data = pagedQuery.all()

  return {
    transactions: data,
    totalCount: count
  }
}

export async function getAllTransactions() {
  return db
    .select({
      id: transactions.id,
      itemId: transactions.itemId,
      itemName: items.name,
      itemSku: items.sku,
      type: transactions.type,
      quantity: transactions.quantity,
      quantityBefore: transactions.quantityBefore,
      performedBy: transactions.performedBy,
      reference: transactions.reference,
      notes: transactions.notes,
      createdAt: transactions.createdAt
    })
    .from(transactions)
    .leftJoin(items, eq(transactions.itemId, items.id))
    .orderBy(desc(transactions.createdAt))
    .all()
}

export async function getTransactionsByItemId(itemId: string) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.itemId, itemId))
    .orderBy(desc(transactions.createdAt))
    .all()
}

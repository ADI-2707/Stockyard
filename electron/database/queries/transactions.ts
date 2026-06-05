import { db } from '../connection'
import { transactions, items } from '../schema'
import { eq, desc } from 'drizzle-orm'

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

import { db } from '../connection'
import { categories, items } from '../schema'
import { eq, sql } from 'drizzle-orm'

export async function getAllCategories() {
  return db.select().from(categories).all()
}

export async function createCategory(data: { id: string; name: string; agingDays: number; color: string }) {
  return db.insert(categories).values(data).run()
}

export async function updateCategory(id: string, data: { name: string; agingDays: number; color: string }) {
  return db.update(categories).set(data).where(eq(categories.id, id)).run()
}

export async function deleteCategory(id: string) {
  // Prevent deleting a category if active items are referencing it
  const activeItemsCount = db.select({ count: sql<number>`count(*)` })
    .from(items)
    .where(sql`${items.categoryId} = ${id} AND ${items.deletedAt} IS NULL`)
    .get()
    
  const count = activeItemsCount ? activeItemsCount.count : 0
  if (count > 0) {
    throw new Error('Cannot delete category: there are active components referencing it.')
  }
  
  return db.delete(categories).where(eq(categories.id, id)).run()
}

import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  agingDays: integer('aging_days').default(90).notNull(),
  color: text('color').notNull() // Hex color string for visual badges in the UI
})

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  categoryId: text('category_id').references(() => categories.id),
  quantity: integer('quantity').default(0).notNull(),
  unit: text('unit').default('pcs').notNull(),
  threshold: integer('threshold').default(5).notNull(), // Trigger LOW_STOCK warning
  maxStock: integer('max_stock'),
  location: text('location'),
  costPerUnit: real('cost_per_unit').default(0.0).notNull(),
  supplier: text('supplier'),
  lastMovedAt: text('last_moved_at'), // ISO string datetime of last transaction
  addedAt: text('added_at').default('CURRENT_TIMESTAMP'),
  notes: text('notes'),
  deletedAt: text('deleted_at') // ISO string timestamp for soft delete
}, (table) => ({
  nameIdx: index('items_name_idx').on(table.name),
  catIdx: index('items_category_idx').on(table.categoryId),
  locIdx: index('items_location_idx').on(table.location),
  delIdx: index('items_deleted_at_idx').on(table.deletedAt)
}))

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  itemId: text('item_id').references(() => items.id),
  type: text('type').notNull(), // 'IN' | 'OUT' | 'ADJUSTMENT' | 'INITIAL'
  quantity: integer('quantity').notNull(), // positive delta
  quantityBefore: integer('quantity_before').notNull(),
  performedBy: text('performed_by').notNull(), // username/operator
  reference: text('reference'), // PO # or build name reference
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
}, (table) => ({
  itemIdx: index('transactions_item_idx').on(table.itemId),
  createdIdx: index('transactions_created_at_idx').on(table.createdAt)
}))

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  itemId: text('item_id').references(() => items.id),
  type: text('type').notNull(), // 'LOW_STOCK' | 'OUT_OF_STOCK' | 'AGING'
  severity: text('severity').notNull(), // 'INFO' | 'WARNING' | 'CRITICAL'
  message: text('message').notNull(),
  isActive: integer('is_active').default(1).notNull(), // 0 for resolved/inactive, 1 for active
  acknowledgedAt: text('acknowledged_at'), // ISO string when snoozed
  resolvedAt: text('resolved_at'), // ISO string when fixed
  triggeredAt: text('triggered_at').default('CURRENT_TIMESTAMP')
})

export const bomTemplates = sqliteTable('bom_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
})

export const bomItems = sqliteTable('bom_items', {
  bomId: text('bom_id').notNull().references(() => bomTemplates.id),
  itemId: text('item_id').notNull().references(() => items.id),
  quantity: integer('quantity').notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.bomId, table.itemId] })
}))
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type Alert = typeof alerts.$inferSelect
export type NewAlert = typeof alerts.$inferInsert
export type BOMTemplate = typeof bomTemplates.$inferSelect
export type NewBOMTemplate = typeof bomTemplates.$inferInsert
export type BOMItem = typeof bomItems.$inferSelect
export type NewBOMItem = typeof bomItems.$inferInsert

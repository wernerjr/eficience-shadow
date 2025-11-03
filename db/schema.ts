import { pgTable, text, timestamp, uuid, index, uniqueIndex, varchar, bigint, foreignKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t: any) => ({
  emailIdx: index('users_email_idx').on(t.email),
  googleIdx: uniqueIndex('users_google_unique').on(t.googleId),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;


// People table
export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull().unique(),
  nameNormalized: varchar('name_normalized', { length: 160 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t: any) => ({
  nameIdx: index('people_name_idx').on(t.name),
  nameNormIdx: uniqueIndex('people_name_normalized_unique').on(t.nameNormalized),
}));

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;


// Work Item Types table
export const workItemTypes = pgTable('work_item_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  nameNormalized: varchar('name_normalized', { length: 120 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t: any) => ({
  nameIdx: index('work_item_types_name_idx').on(t.name),
  nameNormIdx: uniqueIndex('work_item_types_name_normalized_unique').on(t.nameNormalized),
}));

export type WorkItemType = typeof workItemTypes.$inferSelect;
export type NewWorkItemType = typeof workItemTypes.$inferInsert;


// Work Items table (atualizado para usar work_item_type_id)
export const workItems = pgTable('work_items', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  workItemTypeId: uuid('work_item_type_id').notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  createdDate: timestamp('created_date', { withTimezone: true }).notNull(),
  activatedDate: timestamp('activated_date', { withTimezone: true }),
  closedDate: timestamp('closed_date', { withTimezone: true }),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  assignedToId: uuid('assigned_to_id'),
  // define FK via foreignKey abaixo para evitar auto-referência na inicialização
  parentId: bigint('parent_id', { mode: 'number' }),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
}, (t: any) => ({
  titleIdx: index('idx_work_items_title').on(t.title),
  parentIdx: index('idx_work_items_parent_id').on(t.parentId),
  stateIdx: index('idx_work_items_state').on(t.state),
  assignedToIdx: index('idx_work_items_assigned_to_id').on(t.assignedToId),
  workItemTypeIdx: index('idx_work_items_work_item_type_id').on(t.workItemTypeId),
  parentFk: foreignKey({ columns: [t.parentId], foreignColumns: [t.id], name: 'work_items_parent_id_fkey' }),
  assignedToFk: foreignKey({ columns: [t.assignedToId], foreignColumns: [people.id], name: 'work_items_assigned_to_id_fkey' }),
  workItemTypeFk: foreignKey({ columns: [t.workItemTypeId], foreignColumns: [workItemTypes.id], name: 'work_items_work_item_type_id_fkey' }),
}));

export type WorkItem = typeof workItems.$inferSelect;
export type NewWorkItem = typeof workItems.$inferInsert;



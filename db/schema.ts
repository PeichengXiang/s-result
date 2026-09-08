import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const notes = sqliteTable('notes', {
  key: text('key').primaryKey(),
  text: text('text').notNull(),
  abnormal: integer('abnormal').notNull().default(0),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
  author: text('author').notNull(),
});
export const sessions = sqliteTable('sessions', {
  hash: text('hash').primaryKey(),
  expires: integer('expires').notNull(),
});
export const attempts = sqliteTable('auth_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});

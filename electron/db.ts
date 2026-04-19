import type BetterSqlite3 from 'better-sqlite3'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text, blob } from 'drizzle-orm/sqlite-core'

let db: BetterSqlite3.Database | null = null
let orm: ReturnType<typeof drizzle> | null = null
let dbPath: string | null = null

export const projectMeta = sqliteTable('project_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const folderAssets = sqliteTable('folder_assets', {
  folderId: text('folder_id').primaryKey(),
  imageBlob: blob('image_blob', { mode: 'buffer' }).notNull(),
  imageName: text('image_name').notNull(),
  imageMime: text('image_mime').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export function openDatabase(filePath: string): BetterSqlite3.Database {
  if (dbPath === filePath && db) return db
  closeDatabase()
  db = new Database(filePath)
  orm = drizzle(db)
  dbPath = filePath
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function closeDatabase(): void {
  if (!db) return
  db.close()
  db = null
  orm = null
  dbPath = null
}

export function getCurrentDbPath(): string | null {
  return dbPath
}

function migrate(database: BetterSqlite3.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS project_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS folder_assets (
      folder_id TEXT PRIMARY KEY,
      image_blob BLOB NOT NULL,
      image_name TEXT NOT NULL,
      image_mime TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders (parent_id, position, name);
  `)

  const now = Date.now()
  database
    .prepare(`INSERT OR IGNORE INTO project_meta (key, value) VALUES ('name', 'Untitled Catalog')`)
    .run()
  database
    .prepare(`INSERT OR IGNORE INTO project_meta (key, value) VALUES ('created_at', ?)`)
    .run(String(now))
  database.prepare(`INSERT OR IGNORE INTO project_meta (key, value) VALUES ('updated_at', ?)`).run(String(now))
}

export function getDb(): BetterSqlite3.Database {
  if (!db) throw new Error('Database not open')
  return db
}

export function getOrm(): ReturnType<typeof drizzle> {
  if (!orm) throw new Error('Database not open')
  return orm
}

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

export const folderPhotos = sqliteTable('folder_photos', {
  id: text('id').primaryKey(),
  folderId: text('folder_id').notNull(),
  /** Base64 payload (not including data URL prefix). */
  imageBase64: text('image_base64').notNull(),
  imageName: text('image_name').notNull(),
  imageMime: text('image_mime').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at').notNull(),
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

type SqliteColumn = { name: string }

function getTableColumnNames(database: BetterSqlite3.Database, table: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as SqliteColumn[]
  return new Set(rows.map((r) => r.name))
}

function bufferFromSqlitePayload(value: unknown): Buffer | null {
  if (value == null) return null
  if (Buffer.isBuffer(value)) return value
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  if (typeof value === 'string') return Buffer.from(value, 'utf8')
  return null
}

/** Older catalogs stored raw bytes in `image_blob`; we store the same data as base64 in `image_base64`. */
function migrateFolderPhotosBlobToBase64Text(database: BetterSqlite3.Database): void {
  if (!getTableColumnNames(database, 'folder_photos').size) return
  const names = getTableColumnNames(database, 'folder_photos')
  if (names.has('image_base64') && !names.has('image_blob')) return

  if (!names.has('image_base64')) {
    database.exec('ALTER TABLE folder_photos ADD COLUMN image_base64 TEXT')
  }

  const toFill = database
    .prepare(`SELECT id, image_blob, image_base64 FROM folder_photos`)
    .all() as { id: string; image_blob?: unknown; image_base64: string | null }[]
  const upd = database.prepare('UPDATE folder_photos SET image_base64 = ? WHERE id = ?')
  for (const row of toFill) {
    if (row.image_base64 != null && String(row.image_base64).length > 0) continue
    const buf = bufferFromSqlitePayload(row.image_blob)
    if (!buf || buf.length === 0) continue
    upd.run(buf.toString('base64'), row.id)
  }

  if (getTableColumnNames(database, 'folder_photos').has('image_blob')) {
    try {
      database.exec('ALTER TABLE folder_photos DROP COLUMN image_blob')
    } catch {
      /* SQLite <3.35 or locked — leave old column; runtime code uses only image_base64 */
    }
  }
}

/** One-time import from legacy `folder_assets` (BLOB) into `folder_photos` (base64 text). */
function backfillFolderAssetsIntoFolderPhotos(database: BetterSqlite3.Database): void {
  if (!getTableColumnNames(database, 'folder_assets').size) return
  if (!getTableColumnNames(database, 'folder_photos').has('image_base64')) return

  const assets = database
    .prepare(
      'SELECT folder_id, image_blob, image_name, image_mime, updated_at FROM folder_assets',
    )
    .all() as { folder_id: string; image_blob: unknown; image_name: string; image_mime: string; updated_at: number }[]

  const hasPhoto = database.prepare('SELECT 1 FROM folder_photos WHERE folder_id = ? LIMIT 1')
  const insert = database.prepare(`
    INSERT INTO folder_photos (id, folder_id, image_base64, image_name, image_mime, position, created_at, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 0, ?, ?)
  `)

  for (const fa of assets) {
    if (hasPhoto.get(fa.folder_id)) continue
    const buf = bufferFromSqlitePayload(fa.image_blob)
    if (!buf || buf.length === 0) continue
    insert.run(
      fa.folder_id,
      buf.toString('base64'),
      fa.image_name,
      fa.image_mime,
      fa.updated_at,
      fa.updated_at,
    )
  }
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

    CREATE TABLE IF NOT EXISTS folder_photos (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL,
      image_base64 TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_mime TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_folder_photos_folder ON folder_photos (folder_id, position, created_at);
  `)

  migrateFolderPhotosBlobToBase64Text(database)
  backfillFolderAssetsIntoFolderPhotos(database)

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

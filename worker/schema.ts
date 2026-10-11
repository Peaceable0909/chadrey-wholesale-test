import type { D1Database } from "./types";

/**
 * Every change ever made to the shop's database, in order.
 *
 * The Worker applies whatever is missing the first time it runs after a deploy, so there is no
 * separate "set up the database" step, and a branch preview with its own empty database just works.
 * Never edit an entry that has been released: add a new one at the end.
 */
export const MIGRATIONS: Array<{ id: number; name: string; statements: string[] }> = [
  {
    id: 1,
    name: "products and photos",
    statements: [
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        short_description TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Other',
        moq INTEGER NOT NULL DEFAULT 1 CHECK (moq > 0),
        colors TEXT NOT NULL DEFAULT '[]',
        sizes TEXT NOT NULL DEFAULT '[]',
        packaging_options TEXT NOT NULL DEFAULT '[]',
        customization_options TEXT NOT NULL DEFAULT '[]',
        option_groups TEXT NOT NULL DEFAULT '[]',
        price_currency TEXT NOT NULL DEFAULT 'NGN',
        price_unit TEXT NOT NULL DEFAULT 'pc',
        price_tiers TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      "CREATE INDEX IF NOT EXISTS products_live_newest ON products (is_active, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS products_category ON products (category)",
      `CREATE TABLE IF NOT EXISTS product_images (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
        storage_path TEXT NOT NULL,
        alt_text TEXT,
        label TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        content_type TEXT,
        size_bytes INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      // A product has at most one cover photo.
      "CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_cover ON product_images (product_id) WHERE is_primary = 1",
      "CREATE INDEX IF NOT EXISTS product_images_by_product ON product_images (product_id, sort_order)",
    ],
  },
];

const checked = new WeakMap<object, Promise<void>>();

/**
 * Makes sure the database has every migration. Cheap after the first call in a running Worker:
 * the answer is remembered, so only the first request after a deploy pays for the check.
 */
export function ensureSchema(db: D1Database): Promise<void> {
  let pending = checked.get(db);
  if (!pending) {
    pending = applyMigrations(db).catch(error => {
      checked.delete(db); // try again on the next request
      throw error;
    });
    checked.set(db, pending);
  }
  return pending;
}

async function applyMigrations(db: D1Database): Promise<void> {
  const [, applied] = await db.batch<{ id: number }>([
    db.prepare("CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))"),
    db.prepare("SELECT id FROM schema_migrations"),
  ]);
  const done = new Set(applied.results.map(row => Number(row.id)));
  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;
    // One all-or-nothing group, so a half-applied migration can never be recorded as done.
    await db.batch([...migration.statements.map(sql => db.prepare(sql)), db.prepare("INSERT OR IGNORE INTO schema_migrations (id, name) VALUES (?, ?)").bind(migration.id, migration.name)]);
  }
}

// Version 2 centralizes inventory and retires the historical third role.
// Table rebuilds use SQLite's foreign-key-safe replacement procedure: foreign
// keys are disabled before BEGIN, then every relationship is checked before
// COMMIT. Any failed copy or validation rolls the whole migration back.
export const DATABASE_VERSION = 2;

const usersTable = name => `CREATE TABLE ${name} (
  user_id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  demo_access INTEGER NOT NULL DEFAULT 0 CHECK(demo_access IN (0, 1)),
  role TEXT NOT NULL CHECK(role IN ('customer', 'admin'))
)`;

const equipmentTable = name => `CREATE TABLE ${name} (
  equipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  daily_rate REAL NOT NULL CHECK(daily_rate >= 0),
  total_quantity INTEGER NOT NULL CHECK(total_quantity >= 0),
  image_ref TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
)`;

async function createTables(db) {
  await db.execAsync(`
    ${usersTable('IF NOT EXISTS users')};
    ${equipmentTable('IF NOT EXISTS equipment')};
    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES users(user_id),
      customer_name_snapshot TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      booking_contact TEXT NOT NULL,
      event_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
      demo_payment_method TEXT,
      demo_payment_status TEXT NOT NULL DEFAULT 'not_recorded',
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reservation_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL REFERENCES reservations(reservation_id),
      equipment_id INTEGER NOT NULL REFERENCES equipment(equipment_id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      daily_rate_at_booking REAL NOT NULL,
      line_total REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_log (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      customer_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES equipment(equipment_id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      PRIMARY KEY (customer_id, equipment_id)
    );
    CREATE TABLE IF NOT EXISTS customer_credentials (
      user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reservation_dates ON reservations(start_date, end_date, status);
    CREATE INDEX IF NOT EXISTS idx_reservation_items_equipment ON reservation_items(equipment_id);
  `);
}

async function ensureAdministrator(db) {
  const existing = await db.getFirstAsync(`SELECT u.user_id FROM users u
    JOIN app_settings s ON s.key = 'fixed_administrator_id' AND u.user_id = CAST(s.value AS INTEGER)
    WHERE u.role = 'admin'`);
  if (existing) return existing.user_id;
  const result = await db.runAsync("INSERT INTO users (name, contact, role) VALUES ('EventGear Admin', '', 'admin')");
  await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('fixed_administrator_id', ?)", String(result.lastInsertRowId));
  return result.lastInsertRowId;
}

async function upgradeLegacyTables(db) {
  const userColumns = await db.getAllAsync('PRAGMA table_info(users)');
  if (!userColumns.some(column => column.name === 'demo_access'))
    await db.execAsync('ALTER TABLE users ADD COLUMN demo_access INTEGER NOT NULL DEFAULT 0 CHECK(demo_access IN (0, 1))');
  const reservationColumns = await db.getAllAsync('PRAGMA table_info(reservations)');
  if (!reservationColumns.some(column => column.name === 'customer_name_snapshot'))
    await db.execAsync('ALTER TABLE reservations ADD COLUMN customer_name_snapshot TEXT');

  const administratorId = await ensureAdministrator(db);
  // Preserve the original name on receipts before removing retired accounts.
  await db.runAsync(`UPDATE reservations SET
    customer_name_snapshot = COALESCE(customer_name_snapshot, (SELECT name FROM users WHERE user_id = reservations.customer_id)),
    customer_id = ? WHERE customer_id IN (SELECT user_id FROM users WHERE role = 'supplier')`, administratorId);
  const cartColumns = await db.getAllAsync('PRAGMA table_info(cart_items)');
  if (cartColumns.some(column => column.name === 'customer_id'))
    await db.execAsync("DELETE FROM cart_items WHERE customer_id IN (SELECT user_id FROM users WHERE role = 'supplier')");
  await db.execAsync("DELETE FROM customer_credentials WHERE user_id IN (SELECT user_id FROM users WHERE role = 'supplier')");

  // Copy inventory first: its IDs, photos, archived flags and prices survive,
  // while its obsolete ownership foreign key disappears.
  const columns = await db.getAllAsync('PRAGMA table_info(equipment)');
  if (columns.some(column => column.name === 'supplier_id')) {
    const sequence = await db.getFirstAsync("SELECT seq FROM sqlite_sequence WHERE name = 'equipment'");
    await db.execAsync(`${equipmentTable('equipment_v2')};
      INSERT INTO equipment_v2 (equipment_id, name, category, description, daily_rate, total_quantity, image_ref, is_active)
        SELECT equipment_id, name, category, description, daily_rate, total_quantity, image_ref, is_active FROM equipment;
      DROP TABLE equipment;
      ALTER TABLE equipment_v2 RENAME TO equipment;`);
    if (sequence) await db.runAsync("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'equipment'", sequence.seq);
  }
  await db.execAsync(`${usersTable('users_v2')};
    INSERT INTO users_v2 (user_id, name, contact, demo_access, role)
      SELECT user_id, name, contact, demo_access, role FROM users WHERE role <> 'supplier';
    DROP TABLE users;
    ALTER TABLE users_v2 RENAME TO users;
    DELETE FROM app_settings WHERE key = 'business_owner_id';`);

  // Older carts had a single implicit customer. Keep their items under the
  // original customer when present, otherwise the history-only admin identity.
  if (!cartColumns.some(column => column.name === 'customer_id')) {
    const original = await db.getFirstAsync("SELECT user_id FROM users WHERE user_id = 1 AND role = 'customer'");
    await db.execAsync(`CREATE TABLE cart_items_v2 (
      customer_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES equipment(equipment_id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK(quantity > 0), PRIMARY KEY (customer_id, equipment_id)
    )`);
    await db.runAsync('INSERT INTO cart_items_v2 SELECT ?, equipment_id, quantity FROM cart_items', original?.user_id ?? administratorId);
    await db.execAsync('DROP TABLE cart_items; ALTER TABLE cart_items_v2 RENAME TO cart_items;');
  }
}

export async function migrateDatabase(db) {
  const { user_version: version } = await db.getFirstAsync('PRAGMA user_version');
  if (version > DATABASE_VERSION) throw new Error('This database requires a newer version of EventGear.');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  if (version === DATABASE_VERSION) return;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      await createTables(db);
      await upgradeLegacyTables(db);
      const violations = await db.getAllAsync('PRAGMA foreign_key_check');
      if (violations.length) throw new Error('Database upgrade stopped: existing records have invalid relationships. No changes were saved.');
      await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

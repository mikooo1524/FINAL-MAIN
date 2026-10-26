import { dummyPasswordHash, hashPassword, needsPasswordMigration, verifyPassword } from '../services/passwords.js';
import { administratorPasswordHash, administratorUsername } from '../services/fixedAdministrator.js';

import { migrateDatabase } from './schemaMigration.js';

const visibleAdminCustomerPredicate = "u.role = 'customer' AND u.demo_access = 0";

// Only profiles returned by this connection's authentication flow can perform
// privileged actions. A customer ID or a forged role object is not sufficient.
const sessions = new WeakMap();
function rememberSession(db, profile) {
  if (!sessions.has(db)) sessions.set(db, new WeakSet());
  const session = Object.freeze(profile);
  sessions.get(db).add(session);
  return session;
}
export function revokeSession(db, profile) { sessions.get(db)?.delete(profile); }
async function requireSession(db, actor) {
  if (!actor || !sessions.get(db)?.has(actor)) throw new Error('Please sign in to continue.');
  const user = await db.getFirstAsync('SELECT role FROM users WHERE user_id = ?', actor.user_id);
  if (!user || user.role !== actor.role) throw new Error('This account no longer has access.');
  return actor;
}
async function requireAdmin(db, actor) {
  await requireSession(db, actor);
  if (actor.role !== 'admin') throw new Error('Administrator access is required.');
}
async function administratorId(db) {
  const row = await db.getFirstAsync("SELECT value FROM app_settings WHERE key = 'fixed_administrator_id'");
  return row ? Number(row.value) : null;
}

// Called inside the startup/setup transaction. Never refill a deliberately
// cleared catalog, or mix sample listings into an existing inventory.
async function seedStarterEquipment(db) {
  if (await db.getFirstAsync("SELECT value FROM app_settings WHERE key = 'starter_equipment_v1'")) return;
  const existing = await db.getFirstAsync('SELECT COUNT(*) AS count FROM equipment');
  if (!existing.count) {
    const items = [
      ['Premium Sound System', 'Audio', 'Sound system for parties, programs and event announcements.', 2500, 5],
      ['LED Party Lights', 'Lighting', 'LED stage lighting for parties and performances.', 850, 12],
      ['Folding Tables', 'Furniture', 'Folding tables for event dining, displays and registration.', 300, 30],
      ['Monobloc Chairs', 'Furniture', 'Lightweight chairs for indoor and outdoor event seating.', 35, 150],
      ['Pop-up Canopy Tent', 'Tents', 'Portable canopy for shaded outdoor event space.', 1200, 8],
      ['Portable Projector', 'Visual', 'Projector for presentations, slideshows and event videos.', 1800, 4],
    ];
    for (const item of items) {
      await db.runAsync(`INSERT INTO equipment
        (name, category, description, daily_rate, total_quantity)
        VALUES (?, ?, ?, ?, ?)`, ...item);
    }
  }
  await db.runAsync("INSERT INTO app_settings (key, value) VALUES ('starter_equipment_v1', '1')");
}

export async function createDatabaseSchema(db) { await migrateDatabase(db); }
export async function initializeDatabase(db) {
  await createDatabaseSchema(db);
  await transaction(db, () => seedStarterEquipment(db));
}

// Parameter binding keeps search text separate from executable SQL.
export async function getEquipment(db, search = '', category = 'All') {
  const term = `%${search.trim()}%`;
  const items = await db.getAllAsync(
    `SELECT * FROM equipment
     WHERE is_active = 1
       AND (? = 'All' OR category = ?)
       AND (name LIKE ? OR category LIKE ? OR description LIKE ?)
     ORDER BY name ASC`,
    category,
    category,
    term,
    term,
    term
  );
  return Promise.all(items.map(item => withInventory(db, item)));
}

export async function getEquipmentById(db, equipmentId) {
  const item = await db.getFirstAsync(
    'SELECT * FROM equipment WHERE equipment_id = ?',
    equipmentId
  );
  return item ? withInventory(db, item) : item;
}

// Inventory is derived from bookings so ordering and releasing stock cannot drift
// from reservation records. Total quantity remains the number of units owned.
async function withInventory(db, item) {
  const rows = await db.getAllAsync(
    `SELECT r.start_date, r.end_date, ri.quantity FROM reservation_items ri
     JOIN reservations r ON r.reservation_id = ri.reservation_id
     WHERE ri.equipment_id = ? AND r.status IN ('pending', 'confirmed')
       AND r.end_date >= ?`, item.equipment_id, localToday()
  );
  const reserved = peakQuantity(rows, localToday(), '9999-12-31');
  const available = Math.max(0, item.total_quantity - reserved);
  return { ...item, reserved_quantity: reserved, available_quantity: available,
    inventory_status: !item.is_active || item.total_quantity === 0 ? 'Out of stock'
      : available === 0 ? 'Fully reserved' : reserved > 0 ? 'Partly reserved' : 'In stock' };
}

function peakQuantity(rows, startDate, endDate) {
  const points = [startDate, ...rows.map(r => r.start_date).filter(d => d >= startDate && d <= endDate)];
  return Math.max(0, ...points.map(day => rows.reduce((sum, r) =>
    sum + (r.start_date <= day && r.end_date >= day ? r.quantity : 0), 0)));
}

// Dates are canonical calendar dates, calculated in UTC to avoid DST rounding.
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function rentalDays(startDate, endDate) {
  if (!validDate(startDate) || !validDate(endDate)) return NaN;
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
}

// Use peak concurrent bookings, rather than summing reservations on different days.
export async function getAvailableQuantity(db, equipmentId, startDate, endDate, excludeId = -1) {
  const item = await db.getFirstAsync('SELECT * FROM equipment WHERE equipment_id = ?', equipmentId);
  if (!item?.is_active) return 0;
  const rows = await db.getAllAsync(
    `SELECT r.start_date, r.end_date, ri.quantity FROM reservation_items ri
     JOIN reservations r ON r.reservation_id = ri.reservation_id
     WHERE ri.equipment_id = ? AND r.status IN ('pending', 'confirmed')
       AND r.start_date <= ? AND r.end_date >= ? AND r.reservation_id != ?`,
    equipmentId, endDate, startDate, excludeId
  );
  const peak = peakQuantity(rows, startDate, endDate);
  return Math.max(0, item.total_quantity - peak);
}

// All write workflows share a queue. Validation and writes run inside the same
// transaction so two fast submit taps cannot reserve the same remaining stock.
let writeQueue = Promise.resolve();
export function transaction(db, work) {
  const task = writeQueue.then(async () => {
    let result;
    await db.withTransactionAsync(async () => { result = await work(); });
    return result;
  });
  writeQueue = task.catch(() => {});
  return task;
}
async function audit(db, action, details) {
  await db.runAsync('INSERT INTO audit_log (action, details) VALUES (?, ?)', action, details);
}

export async function createReservation(db, booking, customerId = null) {
  return transaction(db, async () => {
    const customer = await db.getFirstAsync("SELECT user_id FROM users WHERE user_id = ? AND role = 'customer'", customerId);
    if (!customer) throw new Error('Please sign in to a customer account.');
    const days = rentalDays(booking.startDate, booking.endDate);
    if (!Number.isFinite(days) || days < 1 || booking.startDate < localToday())
      throw new Error('Choose valid rental dates starting today or later.');
    if (!booking.contact?.trim()) throw new Error('Contact information is required.');
    if (!booking.items?.length) throw new Error('Your cart is empty.');
    if (!['Cash on pickup', 'GCash demonstration', 'Bank transfer demonstration'].includes(booking.paymentMethod))
      throw new Error('Select a payment method.');
    const seen = new Set();
    const items = [];
    for (const row of booking.items) {
      if (seen.has(row.equipment_id)) throw new Error('Duplicate equipment in booking.');
      seen.add(row.equipment_id);
      if (!Number.isInteger(row.quantity) || row.quantity < 1) throw new Error('Quantity must be a positive whole number.');
      const current = await getEquipmentById(db, row.equipment_id);
      if (!current?.is_active) throw new Error('An item was removed. Please refresh your cart.');
      if (Number(row.daily_rate) !== current.daily_rate) throw new Error(`${current.name} has a new price. Remove it from your cart and add it again.`);
      const available = await getAvailableQuantity(db, row.equipment_id, booking.startDate, booking.endDate);
      if (row.quantity > available) throw new Error(`${current.name} only has ${available} available for those dates.`);
      items.push({ ...current, quantity: row.quantity });
    }
    const total = Math.round(items.reduce((sum, item) => sum + item.daily_rate * item.quantity * days, 0) * 100) / 100;
    const bookingCode = `EG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const result = await db.runAsync(
      `INSERT INTO reservations (booking_code, customer_id, start_date, end_date,
       booking_contact, event_note, status, demo_payment_method, demo_payment_status, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'not_recorded', ?)`,
      bookingCode, customerId, booking.startDate, booking.endDate, booking.contact.trim(), booking.note || '', booking.paymentMethod, total
    );
    for (const item of items) {
      await db.runAsync(`INSERT INTO reservation_items (reservation_id, equipment_id, quantity, daily_rate_at_booking, line_total)
        VALUES (?, ?, ?, ?, ?)`, result.lastInsertRowId, item.equipment_id, item.quantity, item.daily_rate,
        Math.round(item.daily_rate * item.quantity * days * 100) / 100);
    }
    await db.runAsync('DELETE FROM cart_items WHERE customer_id = ?', customerId);
    await audit(db, 'Reservation created', bookingCode);
    return { reservationId: result.lastInsertRowId, bookingCode, total };
  });
}

export async function getCustomerRentals(db, customerId = null) {
  return db.getAllAsync(
    `SELECT r.*,
      COUNT(ri.item_id) AS item_count,
      GROUP_CONCAT(e.name, ', ') AS item_names
     FROM reservations r
     JOIN reservation_items ri ON ri.reservation_id = r.reservation_id
     JOIN equipment e ON e.equipment_id = ri.equipment_id
     WHERE r.customer_id = ?
     GROUP BY r.reservation_id
     ORDER BY r.created_at DESC, r.reservation_id DESC`, customerId
  );
}

// Separate parent and line-item reads reconstruct the saved booking receipt.
export async function getRentalDetails(db, reservationId, actor) {
  await requireSession(db, actor);
  const customerId = actor.role === 'admin' ? null : actor.user_id;
  const reservation = await db.getFirstAsync(
    'SELECT * FROM reservations WHERE reservation_id = ? AND (? IS NULL OR customer_id = ?)',
    reservationId, customerId, customerId
  );
  if (!reservation) return { reservation, items: [] };
  const items = await db.getAllAsync(
    `SELECT ri.*, e.name, e.image_ref
     FROM reservation_items ri
     JOIN equipment e ON e.equipment_id = ri.equipment_id
     WHERE ri.reservation_id = ?`,
    reservationId
  );
  return { reservation, items };
}

// Terminal bookings cannot be reopened: released stock may already be booked.
export async function getAdminEquipmentFilters(db, actor) {
  await requireAdmin(db, actor);
  return db.getAllAsync(`SELECT equipment_id, name FROM equipment
    WHERE is_active = 1 OR equipment_id IN (SELECT equipment_id FROM reservation_items)
    ORDER BY name`);
}

export async function getAdminReservations(db, actor, status = 'All', equipmentId = null) {
  await requireAdmin(db, actor);
  return db.getAllAsync(
    `SELECT r.*, COALESCE(r.customer_name_snapshot, u.name) AS customer_name,
       GROUP_CONCAT(e.name || ' x' || ri.quantity, ', ') AS item_names
     FROM reservations r
     JOIN users u ON u.user_id = r.customer_id
     JOIN reservation_items ri ON ri.reservation_id = r.reservation_id
     JOIN equipment e ON e.equipment_id = ri.equipment_id
     WHERE (? = 'All' OR r.status = ?)
       AND (? IS NULL OR EXISTS (SELECT 1 FROM reservation_items matched
         WHERE matched.reservation_id = r.reservation_id AND matched.equipment_id = ?))
     GROUP BY r.reservation_id
     ORDER BY r.created_at DESC, r.reservation_id DESC`, status, status, equipmentId, equipmentId
  );
}

export function nextStatuses(status) {
  return { pending: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] }[status] || [];
}
export async function updateReservationStatus(db, reservationId, status, actor) {
  await requireSession(db, actor);
  const customerId = actor.role === 'admin' ? null : actor.user_id;
  return transaction(db, async () => {
    const r = await db.getFirstAsync('SELECT * FROM reservations WHERE reservation_id = ?', reservationId);
    if (customerId !== null && (!r || r.customer_id !== customerId || status !== 'cancelled'))
      throw new Error('You can only cancel your own booking.');
    if (!r || !nextStatuses(r.status).includes(status)) throw new Error('This status change is no longer allowed. Refresh the reservation.');
    if (status === 'completed' && r.end_date > localToday()) throw new Error('Complete the rental after its scheduled end date.');
    await db.runAsync('UPDATE reservations SET status = ? WHERE reservation_id = ?', status, reservationId);
    await audit(db, 'Reservation status', `${r.booking_code}: ${r.status} → ${status}`);
  });
}
export async function updateReservationContact(db, reservationId, contact, note, startDate, endDate, customerId = null) {
  if (!contact.trim()) throw new Error('Contact information is required.');
  return transaction(db, async () => {
    const r = await db.getFirstAsync('SELECT * FROM reservations WHERE reservation_id = ? AND customer_id = ?', reservationId, customerId);
    if (!r || r.status !== 'pending') throw new Error('Only pending bookings can be edited.');
    if (startDate !== undefined || endDate !== undefined) {
      const days = rentalDays(startDate, endDate);
      if (!Number.isFinite(days) || days < 1 || startDate < localToday())
        throw new Error('Choose valid rental dates starting today or later.');
      const items = await db.getAllAsync('SELECT * FROM reservation_items WHERE reservation_id = ?', reservationId);
      const totals = [];
      for (const item of items) {
        // Exclude this reservation so its own units remain available when editing.
        const available = await getAvailableQuantity(db, item.equipment_id, startDate, endDate, reservationId);
        if (item.quantity > available) {
          const equipment = await getEquipmentById(db, item.equipment_id);
          throw new Error(`${equipment?.name || 'Equipment'} only has ${available} available for those dates.`);
        }
        totals.push(Math.round(item.daily_rate_at_booking * item.quantity * days * 100) / 100);
      }
      for (let index = 0; index < items.length; index++)
        await db.runAsync('UPDATE reservation_items SET line_total = ? WHERE item_id = ?', totals[index], items[index].item_id);
      const total = Math.round(totals.reduce((sum, value) => sum + value, 0) * 100) / 100;
      await db.runAsync('UPDATE reservations SET start_date = ?, end_date = ?, total_amount = ? WHERE reservation_id = ?', startDate, endDate, total, reservationId);
    }
    await db.runAsync('UPDATE reservations SET booking_contact = ?, event_note = ? WHERE reservation_id = ?', contact.trim(), note.trim(), reservationId);
    await audit(db, 'Booking details edited', `${r.booking_code}${startDate !== undefined ? `: ${r.start_date} to ${r.end_date} → ${startDate} to ${endDate}` : ''}`);
  });
}

export async function saveEquipment(db, form, equipmentId, actor) {
  await requireAdmin(db, actor);
  const rate = Number(form.dailyRate), stock = Number(form.totalQuantity);
  if (!form.name.trim() || !form.category.trim() || !form.description.trim()) throw new Error('Complete all equipment details.');
  if (!form.dailyRate.trim() || !Number.isFinite(rate) || rate < 0) throw new Error('Enter a valid daily rate.');
  if (!form.totalQuantity.trim() || !Number.isInteger(stock) || stock < 0) throw new Error('Enter a nonnegative whole-number quantity.');
  return transaction(db, async () => {
    const values = [form.name.trim(), form.category.trim(), form.description.trim(), rate, stock, form.imageRef || '🎪'];
    if (equipmentId) {
      const old = await getEquipmentById(db, equipmentId);
      if (!old?.is_active) throw new Error('This listing no longer exists.');
      const available = await getAvailableQuantity(db, equipmentId, localToday(), '9999-12-31');
      if (stock < old.total_quantity - available) throw new Error('Quantity cannot be lower than stock committed to current or future bookings.');
      await db.runAsync(`UPDATE equipment SET name = ?, category = ?, description = ?, daily_rate = ?, total_quantity = ?, image_ref = ? WHERE equipment_id = ?`, ...values, equipmentId);
    } else {
      await db.runAsync(`INSERT INTO equipment (name, category, description, daily_rate, total_quantity, image_ref) VALUES (?, ?, ?, ?, ?, ?)`, ...values);
    }
    await audit(db, equipmentId ? 'Equipment updated' : 'Equipment created', form.name.trim());
  });
}

export async function updateEquipmentQuantity(db, equipmentId, quantity, actor) {
  await requireAdmin(db, actor);
  if (String(quantity).trim() === '' || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 0)
    throw new Error('Enter a nonnegative whole-number quantity.');
  const stock = Number(quantity);
  return transaction(db, async () => {
    const item = await getEquipmentById(db, equipmentId);
    if (!item?.is_active) throw new Error('This listing no longer exists.');
    if (stock < item.reserved_quantity)
      throw new Error(`At least ${item.reserved_quantity} units are committed to current or future bookings.`);
    await db.runAsync('UPDATE equipment SET total_quantity = ? WHERE equipment_id = ?', stock, equipmentId);
    await audit(db, 'Inventory updated', `${item.name}: ${item.total_quantity} to ${stock} units`);
  });
}

export async function deleteEquipment(db, equipmentId, actor) {
  await requireAdmin(db, actor);
  return transaction(db, async () => {
    const booked = await db.getFirstAsync(`SELECT COUNT(*) AS count FROM reservation_items ri
      JOIN reservations r ON r.reservation_id = ri.reservation_id WHERE ri.equipment_id = ?
      AND r.status IN ('pending', 'confirmed')`, equipmentId);
    if (booked.count) throw new Error('This equipment has an active booking and cannot be removed.');
    const history = await db.getFirstAsync('SELECT COUNT(*) AS count FROM reservation_items WHERE equipment_id = ?', equipmentId);
    // Archive historical listings to keep receipts and foreign keys intact;
    // unreferenced listings are physically deleted (the required DELETE operation).
    await db.runAsync(history.count ? 'UPDATE equipment SET is_active = 0 WHERE equipment_id = ?' : 'DELETE FROM equipment WHERE equipment_id = ?', equipmentId);
    await audit(db, history.count ? 'Equipment archived' : 'Equipment deleted', `Equipment #${equipmentId}`);
  });
}
export async function getAdminCustomers(db, actor) {
  await requireAdmin(db, actor);
  return db.getAllAsync(`SELECT u.*, c.email, c.created_at AS registered_at
    FROM users u LEFT JOIN customer_credentials c ON c.user_id = u.user_id
    WHERE ${visibleAdminCustomerPredicate} ORDER BY u.user_id`);
}

export async function registerCustomer(db, form, randomBytes, setupAdministrator = false) {
  if (setupAdministrator) throw new Error('Administrator setup is disabled. Sign in with the fixed administrator account.');
  const email = (form.email || '').trim().toLowerCase();
  const name = form.name?.trim();
  const contact = form.contact?.trim();
  if (!name || !contact) throw new Error('Name and contact number are required.');
  if (!/^[0-9]+$/.test(contact)) throw new Error('Contact number must contain digits only.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  if (typeof form.password !== 'string' || form.password.length < 8 || form.password.length > 128)
    throw new Error('Use a password between 8 and 128 characters.');
  if (!/^[A-Za-z0-9]+$/.test(form.password)) throw new Error('Password must contain letters and numbers only, without spaces or symbols.');
  if (await db.getFirstAsync('SELECT user_id FROM customer_credentials WHERE email = ?', email))
    throw new Error('This email is already registered. Please sign in.');
  const passwordHash = await hashPassword(form.password, randomBytes);
  return transaction(db, async () => {
    if (await db.getFirstAsync('SELECT user_id FROM customer_credentials WHERE email = ?', email))
      throw new Error('This email is already registered. Please sign in.');
    const result = await db.runAsync("INSERT INTO users (name, contact, role) VALUES (?, ?, 'customer')", name, contact);
    await db.runAsync('INSERT INTO customer_credentials (user_id, email, password_hash) VALUES (?, ?, ?)', result.lastInsertRowId, email, passwordHash);
    await audit(db, 'Customer registered', `Customer #${result.lastInsertRowId}`);
    return rememberSession(db, { user_id: result.lastInsertRowId, name, contact, role: 'customer', email });
  });
}

export async function signInCustomer(db, email, password, randomBytes) {
  if (typeof password !== 'string' || password.length > 128) throw new Error('Incorrect email, username or password.');
  if ((email || '').trim().toLowerCase() === administratorUsername.toLowerCase()) {
    if (!(await verifyPassword(password, administratorPasswordHash))) throw new Error('Incorrect email, username or password.');
    const adminId = await administratorId(db);
    if (adminId === null) throw new Error('Please reload EventGear to prepare the database.');
    return rememberSession(db, { user_id: adminId, name: administratorUsername, contact: '', role: 'admin', email: null });
  }
  const user = await db.getFirstAsync(`SELECT u.*, c.email, c.password_hash
    FROM users u JOIN customer_credentials c ON c.user_id = u.user_id
    WHERE c.email = ?`, (email || '').trim().toLowerCase());
  const matches = await verifyPassword(password, user?.password_hash || dummyPasswordHash);
  if (!user || !matches) throw new Error('Incorrect email, username or password.');
  if (needsPasswordMigration(user.password_hash)) {
    const nextHash = await hashPassword(password, randomBytes);
    await db.runAsync('UPDATE customer_credentials SET password_hash = ? WHERE user_id = ? AND password_hash = ?', nextHash, user.user_id, user.password_hash);
  }
  return rememberSession(db, { user_id: user.user_id, name: user.name, contact: user.contact, role: user.role, email: user.email });
}

async function protectLastAdministrator(db, id) {
 if (await administratorId(db) === Number(id)) throw new Error('The fixed administrator account cannot be removed.');
 const account = await db.getFirstAsync('SELECT role FROM users WHERE user_id = ?', id);
 if (account?.role === 'admin') {
  const others = await db.getFirstAsync("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND user_id <> ?", id);
  if (!others.count) throw new Error('The last administrator cannot be removed or assigned another role.');
 }
}
export async function deleteUser(db, id, actor) {
  await requireAdmin(db, actor);
  return transaction(db, async () => {
    await protectLastAdministrator(db, id);
    const refs = await db.getFirstAsync(`SELECT COUNT(*) AS count FROM reservations WHERE customer_id = ?`, id);
    if (refs.count) throw new Error('This user has linked records and cannot be deleted.');
    await db.runAsync('DELETE FROM users WHERE user_id = ?', id);
    await audit(db, 'User deleted', `User #${id}`);
  });
}
export async function getAdminOverview(db, actor, today = localToday()) {
  await requireAdmin(db, actor);
  if (!validDate(today)) throw new Error('Choose a valid overview date.');
  const stats = await db.getFirstAsync(`SELECT
    (SELECT COUNT(*) FROM users u WHERE ${visibleAdminCustomerPredicate}) AS users,
    (SELECT COUNT(*) FROM equipment WHERE is_active = 1) AS equipment,
    (SELECT COUNT(*) FROM reservations) AS reservations,
    (SELECT COALESCE(SUM(total_amount), 0) FROM reservations WHERE status IN ('confirmed','completed')) AS value`);
  const statuses = await db.getAllAsync('SELECT status, COUNT(*) AS count, SUM(total_amount) AS total FROM reservations GROUP BY status');
  const todayStats = await db.getFirstAsync(`SELECT
    (SELECT COUNT(*) FROM reservations WHERE DATE(created_at, 'localtime') = ?) AS bookings,
    (SELECT COUNT(*) FROM reservations WHERE status = 'pending') AS pending`, today);
  return { stats, statuses, todayStats };
}

export async function getAdminReportSummary(db, actor, period = 'Day', today = localToday()) {
  await requireAdmin(db, actor);
  if (!['Day', 'Month', 'Year'].includes(period) || !validDate(today))
    throw new Error('Choose a valid report period.');
  const start = period === 'Day' ? today : period === 'Month' ? `${today.slice(0, 7)}-01` : `${today.slice(0, 4)}-01-01`;
  const end = period === 'Day' ? today : period === 'Month' ? `${today.slice(0, 7)}-31` : `${today.slice(0, 4)}-12-31`;
  const totals = await db.getFirstAsync(`SELECT COUNT(*) AS bookings,
    COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_amount ELSE 0 END), 0) AS revenue
    FROM reservations WHERE DATE(created_at, 'localtime') BETWEEN ? AND ?`, start, end);
  const gear = await db.getAllAsync(`SELECT e.equipment_id, e.name, e.image_ref,
    COUNT(DISTINCT r.reservation_id) AS rentals, SUM(ri.quantity) AS units
    FROM reservation_items ri
    JOIN reservations r ON r.reservation_id = ri.reservation_id
    JOIN equipment e ON e.equipment_id = ri.equipment_id
    WHERE r.status IN ('confirmed', 'completed') AND DATE(r.created_at, 'localtime') BETWEEN ? AND ?
    GROUP BY e.equipment_id ORDER BY rentals DESC, units DESC, e.name ASC`, start, end);
  return { ...totals, gear };
}
export async function getCart(db, customerId = null) {
  return db.getAllAsync('SELECT e.*, c.quantity FROM cart_items c JOIN equipment e ON e.equipment_id = c.equipment_id WHERE e.is_active = 1 AND c.customer_id = ?', customerId);
}
export async function persistCart(db, items, customerId = null) {
  return transaction(db, async () => {
    await db.runAsync('DELETE FROM cart_items WHERE customer_id = ?', customerId);
    for (const item of items) await db.runAsync('INSERT INTO cart_items (customer_id, equipment_id, quantity) VALUES (?, ?, ?)', customerId, item.equipment_id, item.quantity);
  });
}

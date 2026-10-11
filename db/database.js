const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'barberia.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and enable Foreign Keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('cliente', 'barbero', 'personal', 'admin')),
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      bio TEXT,
      specialties TEXT,
      start_hour TEXT DEFAULT '09:00',
      end_hour TEXT DEFAULT '20:00',
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      duration_minutes INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      barber_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      price_at_booking REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'confirmada', 'en_proceso', 'completada', 'cancelada')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL UNIQUE,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
      status TEXT NOT NULL DEFAULT 'completado' CHECK(status IN ('pendiente', 'completado', 'reembolsado')),
      registered_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

initDb();

module.exports = db;

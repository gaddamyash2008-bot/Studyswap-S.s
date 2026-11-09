const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const dbFile = path.join(__dirname, '..', 'data', 'studyswap.db');
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const isPostgres = Boolean(process.env.DATABASE_URL);
const sqliteDb = new sqlite3.Database(dbFile);
const pgPool = isPostgres ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

function getDbType() {
  return isPostgres ? 'postgres' : 'sqlite';
}

function runSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function querySqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function queryOneSqlite(sql, params = []) {
  const rows = await querySqlite(sql, params);
  return rows[0] || null;
}

async function runPostgres(sql, params = []) {
  const res = await pgPool.query(sql, params);
  return res;
}

async function query(sql, params = []) {
  if (isPostgres) {
    const res = await runPostgres(sql, params);
    return res.rows;
  }
  return querySqlite(sql, params);
}

async function queryOne(sql, params = []) {
  if (isPostgres) {
    const res = await runPostgres(sql, params);
    return res.rows[0] || null;
  }
  return queryOneSqlite(sql, params);
}

async function run(sql, params = []) {
  if (isPostgres) {
    return runPostgres(sql, params);
  }
  return runSqlite(sql, params);
}

function makeCreateTableStatements() {
  return [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      city TEXT,
      state TEXT,
      area TEXT,
      pin_code TEXT,
      is_verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT,
      edition TEXT,
      publication_year INTEGER,
      original_price NUMERIC(10,2) NOT NULL,
      age_years INTEGER DEFAULT 0,
      condition TEXT NOT NULL,
      expected_selling_price NUMERIC(10,2),
      description TEXT,
      city TEXT,
      state TEXT,
      area TEXT,
      pin_code TEXT,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS book_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )`,
    `CREATE TABLE IF NOT EXISTS book_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      category TEXT,
      edition TEXT,
      max_budget NUMERIC(10,2),
      city TEXT,
      area TEXT,
      pin_code TEXT,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'pending',
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      sale_price NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      exchange_id INTEGER,
      rating INTEGER NOT NULL,
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pricing_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      annual_rate NUMERIC(6,4) DEFAULT 0.1500,
      condition_like_new NUMERIC(6,4) DEFAULT 1.00,
      condition_good NUMERIC(6,4) DEFAULT 0.90,
      condition_fair NUMERIC(6,4) DEFAULT 0.75,
      condition_poor NUMERIC(6,4) DEFAULT 0.55,
      min_market_matches INTEGER DEFAULT 2,
      market_weight NUMERIC(6,4) DEFAULT 0.60,
      math_weight NUMERIC(6,4) DEFAULT 0.40,
      recency_days INTEGER DEFAULT 365,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pricing_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      user_id INTEGER NOT NULL,
      original_price NUMERIC(10,2) NOT NULL,
      age_years INTEGER,
      condition TEXT,
      math_estimate NUMERIC(10,2),
      market_median NUMERIC(10,2),
      hybrid_estimate NUMERIC(10,2),
      evidence_count INTEGER DEFAULT 0,
      evidence_label TEXT,
      recommendation_text TEXT,
      config_version TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ];
}

async function initializeDatabase() {
  if (isPostgres) {
    for (const statement of makeCreateTableStatements()) {
      await runPostgres(statement, []);
    }
    const settingsCheck = await queryOne('SELECT id FROM pricing_settings LIMIT 1');
    if (!settingsCheck) {
      await runPostgres(`INSERT INTO pricing_settings (annual_rate, condition_like_new, condition_good, condition_fair, condition_poor, min_market_matches, market_weight, math_weight, recency_days) VALUES (0.1500, 1.00, 0.90, 0.75, 0.55, 2, 0.60, 0.40, 365)`, []);
    }
    return;
  }

  await new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      makeCreateTableStatements().forEach((statement) => {
        sqliteDb.run(statement, (err) => {
          if (err) {
            reject(err);
          }
        });
      });

      sqliteDb.get('SELECT id FROM pricing_settings LIMIT 1', (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          sqliteDb.run(`INSERT INTO pricing_settings (annual_rate, condition_like_new, condition_good, condition_fair, condition_poor, min_market_matches, market_weight, math_weight, recency_days) VALUES (0.1500, 1.00, 0.90, 0.75, 0.55, 2, 0.60, 0.40, 365)`);
        }

        resolve();
      });
    });
  });
}

module.exports = {
  initializeDatabase,
  query,
  queryOne,
  run,
  getDbType,
  sqliteDb,
  pgPool,
};

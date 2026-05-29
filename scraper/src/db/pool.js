// ============================================================
// PostgreSQL Connection Pool
// Provides a shared connection pool for all database operations.
// Reads DATABASE_URL from environment variables.
// ============================================================

const { Pool } = require('pg');
const localDb = require('./localDb');

// Build pool from DATABASE_URL (standard postgres connection string)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep a small pool — scrapers run sequentially, not in parallel
  max: 5,
  // Close idle connections after 30 seconds
  idleTimeoutMillis: 30000,
  // Fail fast to allow quick fallback to local DB!
  connectionTimeoutMillis: 1500,
});

let useLocalDb = false;

// Wrap query to automatically fall back to local JSON db if Postgres is offline
const originalQuery = pool.query.bind(pool);
pool.query = async function (text, params) {
  if (useLocalDb) {
    return localDb.query(text, params);
  }
  try {
    return await originalQuery(text, params);
  } catch (err) {
    console.warn(`\n⚠️  [DB Warning] PostgreSQL query failed (${err.message}). Falling back to Local File DB!`);
    useLocalDb = true;
    return localDb.query(text, params);
  }
};

// Log pool-level errors so they don't crash the process silently
pool.on('error', (err) => {
  if (!useLocalDb) {
    console.error('[DB] Unexpected pool error:', err.message);
  }
});

module.exports = pool;


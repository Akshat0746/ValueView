/**
 * PostgreSQL Connection Pool
 *
 * Creates and exports a shared pg Pool instance.
 * All database queries throughout the app should use this pool
 * to benefit from connection reuse and automatic cleanup.
 */

const { Pool } = require('pg');
const localDb = require('./localDb');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Cap the pool at 10 simultaneous connections
  max: 10,
  // Release idle clients back to the pool after 30 seconds
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
    console.error('[DB Pool] Unexpected error on idle client:', err.message);
  }
});

module.exports = pool;


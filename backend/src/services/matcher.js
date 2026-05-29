/**
 * Product Matching & Search Service
 *
 * Handles product search (full-text + ILIKE fallback) and
 * assembles per-platform pricing data for the API layer.
 */

const pool = require('../db/pool');

/* ---------- helpers ---------- */

/**
 * Normalize a search query: lowercase, strip non-alphanumeric chars
 * (except spaces), and collapse multiple spaces.
 */
function normalizeQuery(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Given an array of price rows (one per platform), build the
 * prices map and determine the lowest-priced platform.
 *
 * @param {Array} rows  – rows from the prices table
 * @returns {{ prices: Object, lowest: Object|null }}
 */
function buildPriceMap(rows) {
  const prices = {};
  let lowest = null;

  for (const row of rows) {
    const entry = {
      price: parseFloat(row.price),
      url: row.product_url,
      inStock: row.in_stock,
      title: row.title,
      imageUrl: row.image_url,
      scrapedAt: row.scraped_at,
    };

    prices[row.platform] = entry;

    // Only consider in-stock items for "lowest"
    if (row.in_stock && (lowest === null || entry.price < lowest.price)) {
      lowest = { platform: row.platform, price: entry.price };
    }
  }

  return { prices, lowest };
}

/* ---------- public API ---------- */

/**
 * Search products by query string.
 *
 * Strategy:
 *  1. Full-text search using to_tsvector / plainto_tsquery
 *  2. ILIKE fallback so partial matches still surface results
 *  3. Union + dedup so the same product never appears twice
 *
 * For every matched product we fetch the *latest* price row
 * from each platform using DISTINCT ON.
 */
async function searchProducts(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  // Build a LIKE pattern for the fallback leg
  const likePattern = `%${normalized}%`;

  // ------------------------------------------------------------------
  // Step 1 – Find matching product IDs (full-text ∪ ILIKE, deduped)
  // ------------------------------------------------------------------
  const productQuery = `
    SELECT DISTINCT p.*
    FROM products p
    WHERE
      to_tsvector('english', p.normalized_name) @@ plainto_tsquery('english', $1)
      OR p.normalized_name ILIKE $2
    ORDER BY p.name
    LIMIT 50
  `;

  const { rows } = await pool.query(productQuery, [normalized, likePattern]);

  const accessoryWords =
  /case|cover|tempered glass|screen protector|glass guard|screen guard|charger|cable|adapter|earphone|earbuds|headphone|skin|pouch|holder|stand/i;

  const products = rows.filter((product) => {
  const text = `${product.name || ''} ${product.normalized_name || ''}`;
  return !accessoryWords.test(text);
  });
  
  if (products.length === 0) return [];

  // ------------------------------------------------------------------
  // Step 2 – For each product, get the latest price per platform
  // ------------------------------------------------------------------
  const productIds = products.map((p) => p.id);

  const pricesQuery = `
    SELECT DISTINCT ON (pr.product_id, pr.platform)
      pr.product_id,
      pr.platform,
      pr.price,
      pr.product_url,
      pr.image_url,
      pr.title,
      pr.in_stock,
      pr.scraped_at
    FROM prices pr
    WHERE pr.product_id = ANY($1)
    ORDER BY pr.product_id, pr.platform, pr.scraped_at DESC
  `;

  const { rows: priceRows } = await pool.query(pricesQuery, [productIds]);

  // Group price rows by product_id for quick lookup
  const pricesByProduct = {};
  for (const row of priceRows) {
    if (!pricesByProduct[row.product_id]) {
      pricesByProduct[row.product_id] = [];
    }
    pricesByProduct[row.product_id].push(row);
  }

  // ------------------------------------------------------------------
  // Step 3 – Assemble the response objects
  // ------------------------------------------------------------------
  return products.map((product) => {
    const { prices, lowest } = buildPriceMap(pricesByProduct[product.id] || []);

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      model: product.model,
      image: product.image_url,
      prices,
      lowest,
    };
  });
}

/**
 * Get a single product by ID, including current prices and
 * a 30-day price history across all platforms.
 *
 * @param {number} id
 * @returns {Object|null}  null when the product doesn't exist
 */
async function getProduct(id) {
  // ------------------------------------------------------------------
  // Step 1 – Fetch the product row
  // ------------------------------------------------------------------
  const { rows: productRows } = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [id]
  );

  if (productRows.length === 0) return null;

  const product = productRows[0];

  // ------------------------------------------------------------------
  // Step 2 – Latest price per platform (same DISTINCT ON pattern)
  // ------------------------------------------------------------------
  const latestPricesQuery = `
    SELECT DISTINCT ON (platform)
      platform,
      price,
      product_url,
      image_url,
      title,
      in_stock,
      scraped_at
    FROM prices
    WHERE product_id = $1
    ORDER BY platform, scraped_at DESC
  `;

  const { rows: latestRows } = await pool.query(latestPricesQuery, [id]);
  const { prices, lowest } = buildPriceMap(latestRows);

  // ------------------------------------------------------------------
  // Step 3 – Price history (last 30 days, all platforms)
  // ------------------------------------------------------------------
  const historyQuery = `
    SELECT
      platform,
      price,
      in_stock,
      scraped_at
    FROM prices
    WHERE product_id = $1
      AND scraped_at >= NOW() - INTERVAL '30 days'
    ORDER BY scraped_at DESC
  `;

  const { rows: historyRows } = await pool.query(historyQuery, [id]);

  const history = historyRows.map((row) => ({
    platform: row.platform,
    price: parseFloat(row.price),
    inStock: row.in_stock,
    scrapedAt: row.scraped_at,
  }));

  // ------------------------------------------------------------------
  // Step 4 – Assemble the full response
  // ------------------------------------------------------------------
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    model: product.model,
    image: product.image_url,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    prices,
    lowest,
    history,
  };
}

module.exports = {
  searchProducts,
  getProduct,
};

// ============================================================
// Database Query Functions
// All DB operations the scraper needs, isolated for testability.
// Uses parameterised queries to prevent SQL injection.
// ============================================================

const pool = require('./pool');

/**
 * Upsert a product — insert if new, otherwise update the timestamp.
 * Conflict is resolved on the unique normalized_name column.
 *
 * @param {Object} product
 * @param {string} product.name           - Raw product name
 * @param {string} product.normalizedName - Cleaned/normalized name for dedup
 * @param {string} product.brand          - Extracted brand (nullable)
 * @param {string} product.model          - Extracted model (nullable)
 * @param {string} product.imageUrl       - Product image URL (nullable)
 * @returns {number} The product id (existing or newly created)
 */
async function upsertProduct(product) {
  const query = `
    INSERT INTO products (name, normalized_name, brand, model, image_url)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (normalized_name)
    DO UPDATE SET
      updated_at = NOW(),
      image_url  = COALESCE(EXCLUDED.image_url, products.image_url)
    RETURNING id;
  `;
  const values = [
    product.name,
    product.normalizedName,
    product.brand || null,
    product.model || null,
    product.imageUrl || null,
  ];
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

/**
 * Insert a price snapshot for a product on a specific platform.
 * Prices are append-only — every scrape adds a new row for history tracking.
 *
 * @param {Object} priceData
 * @param {number} priceData.productId  - FK to products.id
 * @param {string} priceData.platform   - 'amazon', 'flipkart', 'croma'
 * @param {number} priceData.price      - Price in INR
 * @param {string} priceData.productUrl - Direct link to the product page
 * @param {string} priceData.imageUrl   - Image URL (nullable)
 * @param {string} priceData.title      - Raw title from the platform
 * @param {boolean} priceData.inStock   - Whether the product is in stock
 */
async function insertPrice(priceData) {
  const query = `
    INSERT INTO prices (product_id, platform, price, product_url, image_url, title, in_stock)
    VALUES ($1, $2, $3, $4, $5, $6, $7);
  `;
  const values = [
    priceData.productId,
    priceData.platform,
    priceData.price,
    priceData.productUrl,
    priceData.imageUrl || null,
    priceData.title || null,
    priceData.inStock !== undefined ? priceData.inStock : true,
  ];
  await pool.query(query, values);
}

/**
 * Log the outcome of a scrape run for observability.
 *
 * @param {Object} logData
 * @param {string} logData.platform      - Platform name
 * @param {string} logData.query         - Search query used
 * @param {string} logData.status        - 'success' | 'partial' | 'failed'
 * @param {number} logData.productsFound - Count of products extracted
 * @param {string} logData.errorMessage  - Error details (nullable)
 * @param {number} logData.durationMs    - How long the scrape took
 */
async function logScrape(logData) {
  const query = `
    INSERT INTO scrape_logs (platform, query, status, products_found, error_message, duration_ms)
    VALUES ($1, $2, $3, $4, $5, $6);
  `;
  const values = [
    logData.platform,
    logData.query,
    logData.status,
    logData.productsFound || 0,
    logData.errorMessage || null,
    logData.durationMs || null,
  ];
  await pool.query(query, values);
}

/**
 * Look up a product by its normalized name.
 *
 * @param {string} normalizedName
 * @returns {Object|null} The product row or null
 */
async function findProductByNormalizedName(normalizedName) {
  const query = `
    SELECT * FROM products WHERE normalized_name = $1 LIMIT 1;
  `;
  const result = await pool.query(query, [normalizedName]);
  return result.rows[0] || null;
}

module.exports = {
  upsertProduct,
  insertPrice,
  logScrape,
  findProductByNormalizedName,
};

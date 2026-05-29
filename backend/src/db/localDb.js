/**
 * Local JSON Database Engine
 * Emulates the PostgreSQL queries needed for the Price Hunt project using a local JSON file.
 * This guarantees that both the Scraper and the Backend work perfectly without any database setup!
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database file and directory exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ products: [], prices: [], scrape_logs: [] }, null, 2),
      'utf8'
    );
  }
}

function readData() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[LocalDB] Error reading database file:', err.message);
    return { products: [], prices: [], scrape_logs: [] };
  }
}

function writeData(data) {
  initDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[LocalDB] Error writing to database file:', err.message);
  }
}

/**
 * Main query emulator.
 * Parses the SQL text and routes it to the corresponding emulated JavaScript function.
 */
async function query(text, params = []) {
  const data = readData();
  const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

  // 1. PRODUCTS UPSERT
  // INSERT INTO products (name, normalized_name, brand, model, image_url) ...
  if (sql.includes('insert into products') && sql.includes('on conflict (normalized_name)')) {
    const [name, normalized_name, brand, model, image_url] = params;
    
    let product = data.products.find((p) => p.normalized_name === normalized_name);
    
    if (product) {
      // ON CONFLICT DO UPDATE
      product.updated_at = new Date().toISOString();
      if (image_url) product.image_url = image_url;
      console.log(`[LocalDB] Upserted product (updated existing): "${name}" (ID: ${product.id})`);
    } else {
      // INSERT NEW
      const newId = data.products.length > 0 ? Math.max(...data.products.map(p => p.id)) + 1 : 1;
      product = {
        id: newId,
        name,
        normalized_name,
        brand,
        model,
        image_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      data.products.push(product);
      console.log(`[LocalDB] Upserted product (inserted new): "${name}" (ID: ${product.id})`);
    }
    
    writeData(data);
    return { rows: [{ id: product.id }] };
  }

  // 2. FIND PRODUCT BY NORMALIZED NAME
  // SELECT * FROM products WHERE normalized_name = $1 LIMIT 1
  if (sql.includes('select * from products where normalized_name =') || sql.includes('select * from products where normalized_name=$1')) {
    const normalizedName = params[0];
    const product = data.products.find((p) => p.normalized_name === normalizedName);
    return { rows: product ? [product] : [] };
  }

  // 3. INSERT PRICE
  // INSERT INTO prices (product_id, platform, price, product_url, image_url, title, in_stock) ...
  if (sql.includes('insert into prices')) {
    const [product_id, platform, price, product_url, image_url, title, in_stock] = params;
    const newId = data.prices.length > 0 ? Math.max(...data.prices.map(p => p.id)) + 1 : 1;
    
    const priceRecord = {
      id: newId,
      product_id: parseInt(product_id, 10),
      platform,
      price: parseFloat(price),
      product_url,
      image_url,
      title,
      in_stock: in_stock !== undefined ? in_stock : true,
      scraped_at: new Date().toISOString(),
    };
    
    data.prices.push(priceRecord);
    writeData(data);
    console.log(`[LocalDB] Inserted price record for Product ID ${product_id} on ${platform}: ₹${price}`);
    return { rows: [priceRecord] };
  }

  // 4. INSERT SCRAPE LOG
  // INSERT INTO scrape_logs ...
  if (sql.includes('insert into scrape_logs')) {
    const [platform, queryStr, status, products_found, error_message, duration_ms] = params;
    const newId = data.scrape_logs.length > 0 ? Math.max(...data.scrape_logs.map(l => l.id)) + 1 : 1;
    
    const logRecord = {
      id: newId,
      platform,
      query: queryStr,
      status,
      products_found: parseInt(products_found, 10),
      error_message,
      duration_ms: parseInt(duration_ms, 10),
      created_at: new Date().toISOString(),
    };
    
    data.scrape_logs.push(logRecord);
    writeData(data);
    console.log(`[LocalDB] Logged scrape run for ${platform}: status="${status}", products=${products_found}`);
    return { rows: [logRecord] };
  }

  // 5. SEARCH PRODUCTS (BACKEND MATCHING)
  // SELECT DISTINCT p.* FROM products p WHERE to_tsvector(...) @@ plainto_tsquery(...) OR p.normalized_name ILIKE $2
  if (sql.includes('select distinct p.* from products p')) {
    const searchPattern = params[1] ? params[1].replace(/%/g, '').toLowerCase() : '';
    
    // Fallback: match any product where query is substring
    const matchedProducts = data.products.filter((p) => {
      return p.normalized_name.includes(searchPattern);
    });

    // Sort by name (matching Postgres ORDER BY p.name)
    matchedProducts.sort((a, b) => a.name.localeCompare(b.name));
    
    // Limit to 50
    const sliced = matchedProducts.slice(0, 50);
    return { rows: sliced };
  }

  // 6. GET LATEST PRICE ROW PER PLATFORM FOR MULTIPLE PRODUCTS
  // SELECT DISTINCT ON (pr.product_id, pr.platform) ... WHERE pr.product_id = ANY($1)
  if (sql.includes('select distinct on (pr.product_id, pr.platform)')) {
    const productIds = params[0] || [];
    
    // Filter prices for the given product IDs
    const filteredPrices = data.prices.filter((pr) => productIds.includes(pr.product_id));
    
    // Sort prices by scraped_at DESC to ensure we get the latest when deduping
    filteredPrices.sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
    
    // Deduplicate on (product_id, platform)
    const uniqueMap = new Map();
    for (const pr of filteredPrices) {
      const key = `${pr.product_id}-${pr.platform}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, pr);
      }
    }
    
    const rows = Array.from(uniqueMap.values());
    return { rows };
  }

  // 7. GET SINGLE PRODUCT BY ID
  // SELECT * FROM products WHERE id = $1
  if (sql.includes('select * from products where id =') || sql.includes('select * from products where id=$1')) {
    const id = parseInt(params[0], 10);
    const product = data.products.find((p) => p.id === id);
    return { rows: product ? [product] : [] };
  }

  // 8. GET LATEST PRICES FOR SINGLE PRODUCT
  // SELECT DISTINCT ON (platform) ... WHERE product_id = $1 ORDER BY platform, scraped_at DESC
  if (sql.includes('select distinct on (platform)')) {
    const productId = parseInt(params[0], 10);
    const filtered = data.prices.filter((pr) => pr.product_id === productId);
    
    // Sort latest first
    filtered.sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
    
    const uniqueMap = new Map();
    for (const pr of filtered) {
      if (!uniqueMap.has(pr.platform)) {
        uniqueMap.set(pr.platform, pr);
      }
    }
    
    return { rows: Array.from(uniqueMap.values()) };
  }

  // 9. GET PRICE HISTORY FOR SINGLE PRODUCT (LAST 30 DAYS)
  // SELECT platform, price, in_stock, scraped_at FROM prices WHERE product_id = $1 AND scraped_at >= NOW() - INTERVAL '30 days'
  if (sql.includes('scraped_at >= now() - interval')) {
    const productId = parseInt(params[0], 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const history = data.prices.filter((pr) => {
      return pr.product_id === productId && new Date(pr.scraped_at) >= thirtyDaysAgo;
    });
    
    // Sort by scraped_at DESC
    history.sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
    
    // Format to match matcher.js expectation:
    // in_stock -> in_stock
    // scraped_at -> scraped_at
    const rows = history.map(h => ({
      platform: h.platform,
      price: h.price,
      in_stock: h.in_stock,
      scraped_at: h.scraped_at
    }));
    
    return { rows };
  }

  // 10. CLEANUP / EMPTY SELECT ALL / FALLBACK
  console.warn(`[LocalDB] Unhandled SQL query falling back to empty results:\n${text}`);
  return { rows: [] };
}

module.exports = {
  query,
};

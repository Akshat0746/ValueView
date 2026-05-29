-- ============================================================
-- Price Comparison Database Schema
-- ============================================================

-- Products: normalized product info (one row per unique product)
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500) NOT NULL UNIQUE,
    brand           VARCHAR(100),
    model           VARCHAR(200),
    image_url       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Prices: per-platform price snapshots (append-only for price history)
CREATE TABLE IF NOT EXISTS prices (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
    platform        VARCHAR(50) NOT NULL,       -- 'amazon', 'flipkart', 'croma'
    price           DECIMAL(12, 2),
    product_url     TEXT NOT NULL,
    image_url       TEXT,
    title           VARCHAR(500),               -- raw title from the platform
    in_stock        BOOLEAN DEFAULT true,
    scraped_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Scrape logs: track scraper health and debug failures
CREATE TABLE IF NOT EXISTS scrape_logs (
    id              SERIAL PRIMARY KEY,
    platform        VARCHAR(50) NOT NULL,
    query           VARCHAR(200),
    status          VARCHAR(20) NOT NULL,       -- 'success', 'partial', 'failed'
    products_found  INTEGER DEFAULT 0,
    error_message   TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

-- Fast lookup: prices by product + platform
CREATE INDEX IF NOT EXISTS idx_prices_product_platform
    ON prices(product_id, platform);

-- Fast lookup: most recent scrapes first
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at
    ON prices(scraped_at DESC);

-- Full-text search on normalized product names
CREATE INDEX IF NOT EXISTS idx_products_normalized_gin
    ON products USING gin(to_tsvector('english', normalized_name));

-- Brand + model lookup for product matching
CREATE INDEX IF NOT EXISTS idx_products_brand_model
    ON products(brand, model);

-- Scrape log lookups
CREATE INDEX IF NOT EXISTS idx_scrape_logs_platform_created
    ON scrape_logs(platform, created_at DESC);

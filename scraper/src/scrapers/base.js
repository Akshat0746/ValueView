// ============================================================
// BaseScraper — Abstract base class for all platform scrapers
// Handles the full scrape lifecycle:
//   1. Launch stealth browser
//   2. Navigate to search URL
//   3. Extract products (subclass-specific)
//   4. Normalize & save to DB
//   5. Log the run
//   6. Tear down browser
//
// Subclasses only need to implement:
//   - getSearchUrl(query)
//   - extractProducts(page)
// ============================================================

const path = require('path');
const fs = require('fs');
const { createBrowser, createContext, closeBrowser } = require('../utils/browser');
const { withRetry } = require('../utils/retry');
const { normalizeName, extractBrandModel } = require('../utils/normalizer');
const { upsertProduct, insertPrice, logScrape } = require('../db/queries');

class BaseScraper {
  /**
   * @param {string} platformName - e.g. 'amazon', 'flipkart', 'croma'
   */
  constructor(platformName) {
    this.platformName = platformName;
    this.tag = `[${platformName.toUpperCase()}]`;

    // Directory for failure screenshots (helps debug headless issues)
    this.screenshotDir = path.resolve(__dirname, '../../screenshots');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * Main entry point — scrapes a query with retry protection.
   * @param {string} query - Search term, e.g. "iPhone 15"
   * @returns {Promise<Object[]>} Array of saved products
   */
  async scrape(query) {
    console.log(`${this.tag} Starting scrape for "${query}"`);

    const result = await withRetry(
      () => this._executeScrape(query),
      {
        attempts: 2,         // 2 total attempts for the whole scrape
        baseDelay: 5000,
        multiplier: 2,
        label: `${this.platformName} scrape "${query}"`,
      }
    );

    if (result.success) {
      console.log(`${this.tag} Scrape completed — ${result.data.length} products found`);
      return result.data;
    } else {
      console.error(`${this.tag} Scrape failed after ${result.attempts} attempts: ${result.error?.message}`);
      return [];
    }
  }

  /**
   * The actual scrape logic — this is what gets retried.
   * @private
   */
  async _executeScrape(query) {
    const startTime = Date.now();
    let browser = null;
    let context = null;
    let page = null;
    let products = [];
    let status = 'failed';
    let errorMessage = null;

    try {
      // 1. Launch browser and create a fresh context
      browser = await createBrowser();
      context = await createContext(browser);
      page = await context.newPage();

      // Block unnecessary resource types to speed things up
      // (but keep images — we need their URLs)
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['font', 'media', 'websocket'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // 2. Navigate to the search URL
      const searchUrl = this.getSearchUrl(query);
      console.log(`${this.tag} Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Give the page a moment to settle (JS rendering, lazy load, etc.)
      await this.randomDelay(1000, 3000);

      // 3. Scroll down to trigger lazy-loaded content
      await this.humanScroll(page);

      // 4. Call the subclass extraction method
      console.log(`${this.tag} Extracting products…`);
      const rawProducts = await this.extractProducts(page);

      // 5. Validate and filter results
      const validProducts = rawProducts.filter((p) => {
        if (!p.title || p.title.trim().length === 0) return false;
        if (!p.price || isNaN(p.price) || p.price <= 0) return false;
        if (p.price > 10000000) return false; // sanity check: ₹1 crore max
        const accessoryWords =
    /case|cover|tempered glass|screen protector|glass guard|screen guard|charger|cable|adapter|earphone|earbuds|headphone|skin|pouch|holder|stand/i;

  if (accessoryWords.test(p.title)) return false;
        return true;
      });

      console.log(`${this.tag} ${rawProducts.length} raw → ${validProducts.length} valid products`);

      // 6. Save each product to the database
      for (const product of validProducts) {
        try {
          const saved = await this._saveProduct(product, query);
          products.push(saved);
        } catch (err) {
          console.error(`${this.tag} Failed to save product "${product.title?.slice(0, 50)}": ${err.message}`);
        }
      }

      // Determine status
      if (products.length === 0 && validProducts.length === 0) {
        status = 'failed';
        errorMessage = 'No products extracted';
        
        // Take a debug screenshot
        if (page) {
          try {
            const debugPath = path.join(this.screenshotDir, `empty_${this.platformName}_${Date.now()}.png`);
            await page.screenshot({ path: debugPath, fullPage: true });
            console.log(`${this.tag} No products found. Saved debug screenshot to: ${debugPath}`);
          } catch (ssErr) {
            console.error(`${this.tag} Could not save debug screenshot: ${ssErr.message}`);
          }
        }
      } else if (products.length < validProducts.length) {
        status = 'partial';
        errorMessage = `Saved ${products.length}/${validProducts.length} products (some DB saves failed)`;
      } else {
        status = 'success';
      }

    } catch (err) {
      status = 'failed';
      errorMessage = err.message;
      console.error(`${this.tag} Scrape error: ${err.message}`);

      // Take a screenshot for debugging
      if (page) {
        try {
          const screenshotPath = path.join(
            this.screenshotDir,
            `${this.platformName}_${Date.now()}.png`
          );
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`${this.tag} Failure screenshot saved: ${screenshotPath}`);
        } catch (ssErr) {
          console.error(`${this.tag} Could not save screenshot: ${ssErr.message}`);
        }
      }

      throw err; // re-throw so the retry wrapper can catch it

    } finally {
      // 7. Log the scrape run (even on failure)
      const durationMs = Date.now() - startTime;
      try {
        await logScrape({
          platform: this.platformName,
          query,
          status,
          productsFound: products.length,
          errorMessage,
          durationMs,
        });
      } catch (logErr) {
        console.error(`${this.tag} Failed to log scrape: ${logErr.message}`);
      }

      // 8. Clean up browser resources
      if (context) {
        try { await context.close(); } catch (e) { /* ignore */ }
      }
      await closeBrowser(browser);
    }

    return products;
  }

  /**
   * Normalize and persist a single product to the database.
   * @private
   */
  async _saveProduct(product, query) {
    const normalizedName = normalizeName(product.title);
    const { brand, model } = extractBrandModel(product.title);

    // Upsert the canonical product record
    const productId = await upsertProduct({
      name: product.title,
      normalizedName,
      brand,
      model,
      imageUrl: product.imageUrl,
    });

    // Insert a price snapshot for this platform
    await insertPrice({
      productId,
      platform: this.platformName,
      price: product.price,
      productUrl: product.productUrl || '',
      imageUrl: product.imageUrl,
      title: product.title,
      inStock: product.inStock !== undefined ? product.inStock : true,
    });

    return {
      productId,
      title: product.title,
      normalizedName,
      brand,
      model,
      price: product.price,
      platform: this.platformName,
    };
  }

  // ===================== Abstract Methods =====================
  // Subclasses MUST implement these — calling them on the base
  // class throws to catch integration mistakes early.

  /**
   * Build the search URL for this platform.
   * @param {string} query
   * @returns {string} Full URL
   */
  getSearchUrl(query) {
    throw new Error(`${this.tag} getSearchUrl() must be implemented by subclass`);
  }

  /**
   * Extract products from the loaded page.
   * @param {import('playwright').Page} page
   * @returns {Promise<Array<{title: string, price: number, productUrl: string, imageUrl: string}>>}
   */
  async extractProducts(page) {
    throw new Error(`${this.tag} extractProducts() must be implemented by subclass`);
  }

  // ===================== Helper Methods =====================

  /**
   * Wait a random amount of time to appear more human.
   * @param {number} min - Minimum ms
   * @param {number} max - Maximum ms
   */
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Scroll the page down in increments to trigger lazy-loaded content.
   * Mimics real user scrolling behaviour.
   * @param {import('playwright').Page} page
   */
  async humanScroll(page) {
    try {
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      let currentPosition = 0;

      // Scroll in 300-500px chunks with small random pauses
      while (currentPosition < scrollHeight * 0.7) {
        const scrollAmount = Math.floor(Math.random() * 200 + 300);
        currentPosition += scrollAmount;

        await page.evaluate((y) => window.scrollTo(0, y), currentPosition);
        await this.randomDelay(200, 600);
      }

      // Scroll back to top so product extraction starts from the beginning
      await page.evaluate(() => window.scrollTo(0, 0));
      await this.randomDelay(300, 700);
    } catch (err) {
      // Scrolling failure is non-fatal — we still try to extract what loaded
      console.warn(`${this.tag} humanScroll warning: ${err.message}`);
    }
  }
}

module.exports = BaseScraper;

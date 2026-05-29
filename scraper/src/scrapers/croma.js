// ============================================================
// Croma Scraper
// Croma is relatively bot-friendly — JSON-LD structured data
// is usually available, making extraction reliable.
// Fallback: DOM-based extraction from product card elements.
// ============================================================

const BaseScraper = require('./base');

class CromaScraper extends BaseScraper {
  constructor() {
    super('croma');
  }

  /**
   * Build Croma search URL.
   * Uses their /searchB endpoint with filter mode.
   */
  getSearchUrl(query) {
    return `https://www.croma.com/searchB?q=${encodeURIComponent(query)}&searchType=filter`;
  }

  /**
   * Extract products from Croma search results page.
   * Strategy 1: Parse JSON-LD structured data (most reliable).
   * Strategy 2: Fall back to DOM scraping of product cards.
   */
  async extractProducts(page) {
    // Wait for network to mostly settle — Croma is server-rendered + hydrated
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
      console.warn(`${this.tag} Network idle timeout — proceeding anyway`);
    }

    // Small delay — Croma has minimal anti-bot
    await this.randomDelay(1000, 2000);

    // ─── Strategy 1: JSON-LD extraction ───
    let products = await this._extractFromJsonLd(page);
    if (products.length > 0) {
      console.log(`${this.tag} JSON-LD extraction succeeded: ${products.length} products`);
      return products;
    }

    // ─── Strategy 2: DOM fallback ───
    console.log(`${this.tag} JSON-LD not found, falling back to DOM extraction`);
    products = await this._extractFromDom(page);
    return products;
  }

  /**
   * Parse JSON-LD <script> tags for ItemList or Product schema.
   * @private
   */
  async _extractFromJsonLd(page) {
    try {
      const jsonLdData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const results = [];

        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            results.push(data);
          } catch (e) {
            // Malformed JSON-LD — skip
          }
        }
        return results;
      });

      const products = [];

      for (const data of jsonLdData) {
        // Handle ItemList (array of products)
        if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
          for (const item of data.itemListElement) {
            const product = item.item || item;
            const extracted = this._parseJsonLdProduct(product);
            if (extracted) products.push(extracted);
          }
        }
        // Handle single Product
        else if (data['@type'] === 'Product') {
          const extracted = this._parseJsonLdProduct(data);
          if (extracted) products.push(extracted);
        }
        // Handle array at top level
        else if (Array.isArray(data)) {
          for (const entry of data) {
            if (entry['@type'] === 'Product') {
              const extracted = this._parseJsonLdProduct(entry);
              if (extracted) products.push(extracted);
            }
          }
        }
      }

      return products;
    } catch (err) {
      console.warn(`${this.tag} JSON-LD extraction error: ${err.message}`);
      return [];
    }
  }

  /**
   * Extract a product from a JSON-LD Product object.
   * @private
   */
  _parseJsonLdProduct(product) {
    if (!product || !product.name) return null;

    let price = null;
    if (product.offers) {
      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      price = parseFloat(offers.price || offers.lowPrice || 0);
    }

    const imageUrl = Array.isArray(product.image) ? product.image[0] : product.image || null;

    return {
      title: product.name,
      price: price || null,
      productUrl: product.url || product['@id'] || '',
      imageUrl,
    };
  }

  /**
   * DOM-based extraction — find product card containers and pull data.
   * @private
   */
  async _extractFromDom(page) {
    try {
      const products = await page.evaluate(() => {
        const results = [];

        // Croma uses various card class names — try multiple selectors
        const selectors = [
          '.product-item',
          '.product-card',
          '[class*="product-list"] li',
          '[class*="productCard"]',
          '[class*="ProductCard"]',
          '.search-result-item',
          'li[data-testid]',
        ];

        let cards = [];
        for (const sel of selectors) {
          cards = document.querySelectorAll(sel);
          if (cards.length > 0) break;
        }

        for (const card of cards) {
          try {
            // Title: look for heading or link text
            const titleEl =
              card.querySelector('h3') ||
              card.querySelector('h2') ||
              card.querySelector('[class*="product-title"]') ||
              card.querySelector('[class*="productName"]') ||
              card.querySelector('a[title]');

            const title = titleEl
              ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim()
              : '';

            // Price: look for elements containing ₹ or price classes
            const priceEl =
              card.querySelector('[class*="amount"]') ||
              card.querySelector('[class*="price"]') ||
              card.querySelector('[class*="Price"]');

            let price = null;
            if (priceEl) {
              const priceText = priceEl.textContent.replace(/[₹,\s]/g, '');
              price = parseFloat(priceText);
            }

            // Image
            const imgEl = card.querySelector('img');
            const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';

            // Product URL
            const linkEl = card.querySelector('a[href*="/p/"]') || card.querySelector('a');
            let productUrl = linkEl ? linkEl.getAttribute('href') : '';
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = 'https://www.croma.com' + productUrl;
            }

            if (title && price) {
              results.push({ title, price, productUrl, imageUrl });
            }
          } catch (e) {
            // Skip individual card errors
          }
        }

        return results;
      });

      return products;
    } catch (err) {
      console.error(`${this.tag} DOM extraction error: ${err.message}`);
      return [];
    }
  }
}

module.exports = CromaScraper;

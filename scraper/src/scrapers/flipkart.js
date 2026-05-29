// ============================================================
// Flipkart Scraper
// Flipkart has aggressive bot detection and uses obfuscated,
// auto-generated CSS classes. This scraper:
//   • Closes the intrusive login popups
//   • Extracts JSON-LD structured data (primary/most stable)
//   • Falls back to DOM-based extraction via structural traversal
//   • Implements slower, randomized delays to bypass blocks
// ============================================================

const BaseScraper = require('./base');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super('flipkart');
  }

  /**
   * Build Flipkart search URL.
   */
  getSearchUrl(query) {
    return `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  }

  /**
   * Extract products from Flipkart.
   */
  async extractProducts(page) {
    // 1. Slower start — Flipkart watches for rapid requests
    await this.randomDelay(3000, 6000);

    // 2. Attempt to dismiss login popup
    await this._dismissLoginPopup(page);

    // 3. Strategy 1: JSON-LD extraction (most reliable across layout variations)
    let products = await this._extractFromJsonLd(page);
    if (products.length > 0) {
      console.log(`${this.tag} JSON-LD extraction succeeded: ${products.length} products`);
      return products;
    }

    // 4. Strategy 2: DOM fallback
    console.log(`${this.tag} JSON-LD not found/empty, falling back to DOM extraction`);
    products = await this._extractFromDom(page);
    return products;
  }

  /**
   * Closes Flipkart's overlay login modal if it pops up.
   * @private
   */
  async _dismissLoginPopup(page) {
    try {
      // Look for common close buttons for Flipkart login modal
      const closeSelectors = [
        'button._2KpZ6l._2doB4z', // classic close button
        'span._30XB9F',           // newer login pop close button
        'button:has-text("✕")',
        'span:has-text("✕")',
        'div._2Mzyt0 + button',   // sibling button next to login header
      ];

      for (const sel of closeSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          console.log(`${this.tag} Dismissing login popup...`);
          await btn.click();
          await this.randomDelay(1000, 2000);
          return;
        }
      }
    } catch (err) {
      // Non-fatal if the popup wasn't there or didn't close
      console.log(`${this.tag} Login popup check finished (none found or dismiss skipped)`);
    }
  }

  /**
   * Parse JSON-LD structured data for products.
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
          } catch (e) {}
        }
        return results;
      });

      const products = [];
      for (const data of jsonLdData) {
        if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
          for (const item of data.itemListElement) {
            const product = item.item || item;
            if (product && product.name) {
              const parsed = this._parseJsonLdProduct(product);
              if (parsed) products.push(parsed);
            }
          }
        } else if (data['@type'] === 'Product') {
          const parsed = this._parseJsonLdProduct(data);
          if (parsed) products.push(parsed);
        }
      }
      return products;
    } catch (err) {
      console.warn(`${this.tag} JSON-LD extraction failed: ${err.message}`);
      return [];
    }
  }

  _parseJsonLdProduct(product) {
    let price = null;
    if (product.offers) {
      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      price = parseFloat(offers.price || offers.lowPrice || 0);
    }
    const imageUrl = Array.isArray(product.image) ? product.image[0] : product.image || null;
    return {
      title: product.name,
      price: price || null,
      productUrl: product.url || '',
      imageUrl,
    };
  }

  /**
   * DOM fallback extraction using robust relative queries.
   * @private
   */
  async _extractFromDom(page) {
    try {
      const products = await page.evaluate(() => {
        const results = [];

        // Flipkart has two main layouts: List view (row cards) and Grid view (column cards)
        // We find containers by data-id attribute or by matching product links
        const cards = document.querySelectorAll('[data-id], div._1AtVbE, div._cPHDOP');
        
        for (const card of cards) {
          try {
            // Find the primary anchor tag containing the product link
            const linkEl = card.querySelector('a[href*="/p/"]');
            if (!linkEl) continue;

            let productUrl = linkEl.getAttribute('href') || '';
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = 'https://www.flipkart.com' + productUrl;
            }

            // Clean tracking parameters from URL
            if (productUrl) {
              const qIdx = productUrl.indexOf('?');
              if (qIdx !== -1) {
                productUrl = productUrl.substring(0, qIdx);
              }
            }

             // ── Title ──
             // In newer Flipkart layout, title is div.RG5Slk or div._4rR01T or a.IR34t_
             let title = '';
             const titleEl = 
               card.querySelector('div.RG5Slk') ||
               card.querySelector('div._4rR01T') || 
               card.querySelector('a.IR34t_') || 
               card.querySelector('div.KzDCCF') ||
               card.querySelector('div.Y13Zqy') ||
               card.querySelector('[class*="title"]') ||
               linkEl.querySelector('img')?.getAttribute('alt');
 
             if (titleEl) {
               title = (titleEl.textContent || titleEl.getAttribute('alt') || '').trim();
             }
 
             // ── Price ──
             // Look for divs starting with '₹' or specific classes like hZ3P6w, Nx93dJ, _30jeq3
             let price = null;
             const priceSelectors = [
               'div.hZ3P6w', // newest price class
               'div.Nx93dJ', // newer price class
               'div._30jeq3', // classic price class
               'div._1vC4OI', // alternate price class
               '[class*="price"]',
               '[class*="Price"]'
             ];
 
             let priceEl = null;
             for (const sel of priceSelectors) {
               priceEl = card.querySelector(sel);
               if (priceEl) break;
             }
 
             // Fallback: search all divs containing ₹
             if (!priceEl) {
               const divs = card.querySelectorAll('div, span');
               for (const d of divs) {
                 if (d.textContent.startsWith('₹')) {
                   priceEl = d;
                   break;
                 }
               }
             }
 
             if (priceEl) {
               const priceText = priceEl.textContent.replace(/[₹,\s]/g, '');
               price = parseFloat(priceText);
             }
 
             // ── Image ──
             // Newer layout uses class UCc1lI for image
             const imgEl = card.querySelector('img.UCc1lI') || card.querySelector('img');
             const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
 
             // ── In Stock Status ──
             // Check if card contains "Currently unavailable"
             const inStock = !card.textContent.includes('Currently unavailable');
 
             if (title && price) {
               results.push({
                 title,
                 price,
                 productUrl,
                 imageUrl,
                 inStock
               });
             }
           } catch (e) {
             // Skip individual card failures
           }
         }
        
        // Remove duplicates by product URL
        const unique = [];
        const seen = new Set();
        for (const item of results) {
          if (!seen.has(item.productUrl)) {
            seen.add(item.productUrl);
            unique.push(item);
          }
        }

        return unique;
      });

      console.log(`${this.tag} Extracted ${products.length} products from Flipkart`);
      return products;
    } catch (err) {
      console.error(`${this.tag} Flipkart DOM extraction failed: ${err.message}`);
      return [];
    }
  }
}

module.exports = FlipkartScraper;

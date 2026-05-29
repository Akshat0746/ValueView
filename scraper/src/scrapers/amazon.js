// ============================================================
// Amazon India Scraper
// Amazon has aggressive bot detection — this scraper:
//   • Uses [data-asin] selectors (stable across redesigns)
//   • Detects CAPTCHA pages and bails gracefully
//   • Skips sponsored results to keep data clean
//   • Uses longer random delays to appear human
// ============================================================

const BaseScraper = require('./base');

class AmazonScraper extends BaseScraper {
  constructor() {
    super('amazon');
  }

  /**
   * Build Amazon India search URL.
   * Scoped to the "electronics" department for relevance.
   */
  getSearchUrl(query) {
    return `https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=electronics`;
  }

  /**
   * Extract products from Amazon search results.
   * Uses [data-asin] attribute — Amazon's internal product identifier.
   */
  async extractProducts(page) {
    // Random delay before extraction (2-5s) — Amazon watches for bot timing
    await this.randomDelay(2000, 5000);

    // ─── CAPTCHA Detection ───
    const hasCaptcha = await page.evaluate(() => {
      return !!document.querySelector('#captchacharacters');
    });

    if (hasCaptcha) {
      console.warn(`${this.tag} ⚠ CAPTCHA detected — cannot extract. Returning empty.`);
      return [];
    }

    // Wait for product cards to appear
    try {
      await page.waitForSelector('div[data-asin]', { timeout: 15000 });
    } catch (e) {
      console.warn(`${this.tag} Product cards did not appear within 15s`);
      // Check if page loaded at all
      const title = await page.title();
      console.log(`${this.tag} Page title: "${title}"`);
      return [];
    }

    // ─── Extract product data from each card ───
    const products = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll('div[data-asin]');

      for (const card of cards) {
        try {
          const asin = card.getAttribute('data-asin');

          // Skip empty ASINs (these are layout/container divs)
          if (!asin || asin.length < 5 || !/^[A-Z0-9]{10}$/i.test(asin)) {
            continue;
          }

          // Skip sponsored results — they pollute price comparison
          const sponsoredEl = card.querySelector('[class*="AdHolder"]') ||
                              card.querySelector('.puis-sponsored-label-text');
          const cardText = card.innerText || '';
          if (sponsoredEl || /^Sponsored$/m.test(cardText)) {
            continue;
          }

          // ── Title ──
          const titleEl =
            card.querySelector('h2 a span') ||
            card.querySelector('h2 span') ||
            card.querySelector('.a-text-normal') ||
            card.querySelector('[class*="a-size-medium"]');

          const title = titleEl ? titleEl.textContent.trim() : '';

          // ── Price ──
          const priceWholeEl = card.querySelector('.a-price-whole');
          let price = null;
          if (priceWholeEl) {
            const priceText = priceWholeEl.textContent.replace(/[,.\s]/g, '');
            price = parseInt(priceText, 10);
          }

          // ── Product URL ──
          const linkEl = card.querySelector('h2 a') || card.querySelector('a.a-link-normal[href*="/dp/"]');
          let productUrl = linkEl ? linkEl.getAttribute('href') : '';
          if (productUrl && !productUrl.startsWith('http')) {
            productUrl = 'https://www.amazon.in' + productUrl;
          }
          // Strip tracking params but keep the /dp/ASIN path
          if (productUrl) {
            try {
              const url = new URL(productUrl);
              const dpMatch = url.pathname.match(/(\/dp\/[A-Z0-9]{10})/i);
              if (dpMatch) {
                productUrl = 'https://www.amazon.in' + dpMatch[1];
              }
            } catch (e) {
              // Keep original URL if parsing fails
            }
          }

          // ── Image ──
          const imgEl = card.querySelector('img.s-image');
          const imageUrl = imgEl ? imgEl.getAttribute('src') : '';

          if (title && price) {
            results.push({
              title,
              price,
              productUrl,
              imageUrl,
              asin,
            });
          }
        } catch (e) {
          // Skip individual card errors silently
        }
      }

      return results;
    });

    console.log(`${this.tag} Extracted ${products.length} products from Amazon`);
    return products;
  }
}

module.exports = AmazonScraper;

// ============================================================
// Vijay Sales Scraper
// Works with BaseScraper lifecycle:
//   - getSearchUrl(query)
//   - extractProducts(page)
// ============================================================

const BaseScraper = require('./base');

class VijaySalesScraper extends BaseScraper {
  constructor() {
    super('vijaysales');
  }

  getSearchUrl(query) {
    return `https://www.vijaysales.com/search-listing.html?query=${encodeURIComponent(query)}`;
  }

  async extractProducts(page) {
    await this.randomDelay(3000, 6000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const products = await page.evaluate(() => {
      const results = [];

      const parsePrice = (text) => {
        if (!text) return null;
        const match = text.replace(/,/g, '').match(/₹\s*([\d.]+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const looksLikePhone = (title) => /iphone|samsung|galaxy|oneplus|mobile phone/i.test(title || '');

      const findCard = (start) => {
        let node = start;
        for (let i = 0; i < 8 && node; i++) {
          const text = node.innerText || '';
          if (text.includes('₹') && text.length > 40) return node;
          node = node.parentElement;
        }
        return start;
      };

      const candidates = Array.from(document.querySelectorAll('img[alt], a[href]'));

      for (const candidate of candidates) {
        try {
          const card = findCard(candidate);
          const text = card.innerText || '';
          if (!text.includes('₹')) continue;

          const price = parsePrice(text);

          const imgEl = candidate.tagName === 'IMG' ? candidate : card.querySelector('img[alt]');
          const title =
            imgEl?.getAttribute('alt') ||
            candidate.getAttribute('title') ||
            card.querySelector('[title]')?.getAttribute('title') ||
            text
              .split('\n')
              .map((line) => line.trim())
              .find((line) => looksLikePhone(line) && !line.includes('₹')) ||
            '';

          if (!looksLikePhone(title)) continue;

          const linkEl =
            candidate.closest('a[href]') ||
            card.querySelector('a[href*="/p/"]') ||
            card.querySelector('a[href]');

          let productUrl = linkEl ? linkEl.getAttribute('href') : '';

          if (productUrl && !productUrl.startsWith('http')) {
            productUrl = 'https://www.vijaysales.com' + productUrl;
          }

          const imageUrl =
            imgEl?.getAttribute('src') ||
            imgEl?.getAttribute('data-src') ||
            imgEl?.getAttribute('data-lazy') ||
            imgEl?.getAttribute('data-original') ||
            '';

          if (title && price && productUrl) {
            results.push({
              title: title.replace(/\s+/g, ' ').trim(),
              price,
              productUrl,
              imageUrl,
              inStock: !/out of stock|notify me/i.test(text),
            });
          }
        } catch (e) {
          // Skip bad card
        }
      }

      const unique = [];
      const seen = new Set();

      for (const item of results) {
        const key = item.productUrl || `${item.title}-${item.price}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }

      return unique.slice(0, 30);
    });

    console.log(`${this.tag} Extracted ${products.length} products from Vijay Sales`);
    return products;
  }
}

module.exports = VijaySalesScraper;

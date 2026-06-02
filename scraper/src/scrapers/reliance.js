// ============================================================
// Reliance Digital Scraper
// Works with BaseScraper lifecycle:
//   - getSearchUrl(query)
//   - extractProducts(page)
// ============================================================

const BaseScraper = require('./base');

class RelianceScraper extends BaseScraper {
  constructor() {
    super('reliance');
  }

  getSearchUrl(query) {
    const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
    const collectionUrls = {
      'iphone 15': 'https://www.reliancedigital.in/collection/iphone-15-250110',
      'iphone 16': 'https://www.reliancedigital.in/collection/iphone-16-250110',
      'samsung galaxy s24': 'https://www.reliancedigital.in/collection/samsung-galaxy-mobiles',
      'samsung galaxy s25': 'https://www.reliancedigital.in/collection/samsung-galaxy-s25',
      'oneplus 12': 'https://www.reliancedigital.in/collection/mobile-phones-above-40000',
    };

    return collectionUrls[normalized] || `https://www.reliancedigital.in/collection/${normalized.replace(/\s+/g, '-')}`;
  }

  async extractProducts(page) {
    await this.randomDelay(3000, 6000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const pageUrl = page.url();

    const products = await page.evaluate((currentUrl) => {
      const results = [];

      const parsePrice = (text) => {
        if (!text) return null;
        const match = text.replace(/,/g, '').match(/₹\s*([\d.]+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const cleanTitle = (text) => {
        return (text || '')
          .replace(/^LIMITED_TIME_OFFER\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const hasPhoneWords = (title) => /iphone|samsung|galaxy|oneplus|mobile phone/i.test(title || '');

      const addProduct = ({ title, price, productUrl, imageUrl, inStock }) => {
        title = cleanTitle(title);
        if (!title || !price || !hasPhoneWords(title)) return;

        if (productUrl && !productUrl.startsWith('http')) {
          productUrl = 'https://www.reliancedigital.in' + productUrl;
        }

        results.push({
          title,
          price,
          productUrl: productUrl || currentUrl,
          imageUrl: imageUrl || '',
          inStock,
        });
      };

      const linkCards = Array.from(document.querySelectorAll('a[href*="/product/"], a[href*="/p/"]'));
      for (const link of linkCards) {
        try {
          let card = link;
          for (let i = 0; i < 5 && card && !(card.innerText || '').includes('₹'); i++) {
            card = card.parentElement;
          }

          const text = card?.innerText || link.innerText || '';
          const price = parsePrice(text);
          const imgEl = card?.querySelector('img') || link.querySelector('img');
          const imageUrl =
            imgEl?.getAttribute('src') ||
            imgEl?.getAttribute('data-src') ||
            imgEl?.getAttribute('data-original') ||
            '';

          const title =
            imgEl?.getAttribute('alt') ||
            link.getAttribute('title') ||
            text.split('\n').map((line) => line.trim()).find((line) => hasPhoneWords(line)) ||
            '';

          addProduct({
            title,
            price,
            productUrl: link.getAttribute('href'),
            imageUrl,
            inStock: !/currently unavailable|out of stock/i.test(text),
          });
        } catch (e) {
          // Skip bad card
        }
      }

      const lines = (document.body.innerText || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      for (let i = 0; i < lines.length - 2; i++) {
        const maybeIndex = lines[i];
        const maybeTitle = cleanTitle(lines[i + 1]);
        const maybePrice = lines[i + 2];

        if (!/^\d+$/.test(maybeIndex)) continue;
        if (!hasPhoneWords(maybeTitle)) continue;

        addProduct({
          title: maybeTitle,
          price: parsePrice(maybePrice),
          productUrl: currentUrl,
          imageUrl: '',
          inStock: true,
        });
      }

      const unique = [];
      const seen = new Set();

      for (const item of results) {
        const key = `${item.title}-${item.price}-${item.productUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }

      return unique.slice(0, 20);
    }, pageUrl);

    console.log(`${this.tag} Extracted ${products.length} products from Reliance Digital`);
    return products;
  }
}

module.exports = RelianceScraper;

// ============================================================
// Browser Manager — Stealth Chromium via Playwright-Extra
// Creates browser instances with anti-detection measures:
//   • Stealth plugin to evade bot fingerprinting
//   • Randomized viewport from common screen resolutions
//   • Rotating real Chrome user-agent strings
//   • India-specific locale and timezone
// ============================================================

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply stealth plugin — patches navigator.webdriver, chrome.runtime, etc.
chromium.use(StealthPlugin());

// Pool of common desktop resolutions (width × height)
const VIEWPORT_POOL = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1280, height: 800 },
  { width: 1680, height: 1050 },
  { width: 1360, height: 768 },
  { width: 1280, height: 1024 },
];

// Recent real Chrome user-agent strings (Chrome 120–127 on Windows/Mac)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/** Pick a random item from an array */
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Launch a headless Chromium browser with stealth patches.
 * @returns {Promise<import('playwright').Browser>}
 */
async function createBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled', // hide webdriver flag
      '--disable-dev-shm-usage',                       // prevent /dev/shm issues in containers
      '--no-sandbox',                                   // required in some CI environments
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1920,1080',
    ],
  });

  console.log('[BROWSER] Launched stealth Chromium');
  return browser;
}

/**
 * Create a new browser context with randomized fingerprint.
 * Each context gets its own UA, viewport, cookies, and storage —
 * so every scrape looks like a fresh user session.
 *
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function createContext(browser) {
  const userAgent = randomFrom(USER_AGENTS);
  const viewport = randomFrom(VIEWPORT_POOL);

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    // Accept common web permissions to look more human
    permissions: [],
    // Don't download images for speed? No — we need image URLs, and
    // blocking images can trigger anti-bot on some sites.
    bypassCSP: true,
    javaScriptEnabled: true,
  });

  console.log(`[BROWSER] New context — UA: ...${userAgent.slice(-30)} | Viewport: ${viewport.width}×${viewport.height}`);
  return context;
}

/**
 * Gracefully close a browser instance.
 * @param {import('playwright').Browser} browser
 */
async function closeBrowser(browser) {
  if (browser) {
    try {
      await browser.close();
      console.log('[BROWSER] Closed browser');
    } catch (err) {
      console.error('[BROWSER] Error closing browser:', err.message);
    }
  }
}

module.exports = { createBrowser, createContext, closeBrowser };

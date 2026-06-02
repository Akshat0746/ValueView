// ============================================================
// Scraper Service Entry Point & Scheduler
// Handles CLI run-now commands and cron jobs for all scrapers.
// ============================================================

require('dotenv').config();
const cron = require('node-cron');

const AmazonScraper = require('./scrapers/amazon');
const FlipkartScraper = require('./scrapers/flipkart');
const RelianceScraper = require('./scrapers/reliance');
const VijaySalesScraper = require('./scrapers/vijaysales');

const amazon = new AmazonScraper();
const flipkart = new FlipkartScraper();
const reliance = new RelianceScraper();
const vijaysales = new VijaySalesScraper();

// Default queries to refresh periodically
const DEFAULT_QUERIES = [
  'iPhone 15',
  'iPhone 16',
  'Samsung Galaxy S24',
  'Samsung Galaxy S25',
  'OnePlus 12'
];

/**
 * Helper to delay execution.
 * @param {number} ms 
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a query through a specific platform.
 * @param {string} platform - 'croma'|'amazon'|'flipkart'
 * @param {string} query 
 */
async function runSingleScraper(platform, query) {
  console.log(`[SYSTEM] Starting scraper for [${platform.toUpperCase()}] with query "${query}"`);
  try {
    switch (platform.toLowerCase()) {
      case 'amazon':
        await amazon.scrape(query);
        break;
      case 'flipkart':
        await flipkart.scrape(query);
        break;
      case 'reliance':
        await reliance.scrape(query);
        break;
      case 'vijaysales':
        await vijaysales.scrape(query);
         break;
      default:
        console.error(`[SYSTEM] Unknown platform: ${platform}`);
    }
  } catch (err) {
    console.error(`[SYSTEM] Scraper failed for [${platform.toUpperCase()}]: ${err.message}`);
  }
}

/**
 * Orchestrates sequential execution across multiple platforms for a query.
 * Delays between platforms prevent overlapping network requests and block detection.
 * @param {string} query 
 * @param {string} targetPlatform - 'all'|'croma'|'amazon'|'flipkart'
 */
async function scrapeQuery(query, targetPlatform = 'all') {
  console.log(`\n============================================================`);
  console.log(`[SYSTEM] Starting Scrape Session for "${query}"`);
  console.log(`============================================================`);
  
  const platforms = targetPlatform === 'all' 
    ? [ 'amazon', 'flipkart','reliance','vijaysales'] 
    : [targetPlatform];

  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    await runSingleScraper(platform, query);
    
    // Gap of 5 seconds between platforms to cool down IP footprint
    if (i < platforms.length - 1) {
      console.log(`[SYSTEM] Waiting 5 seconds before next platform...`);
      await delay(5000);
    }
  }
  console.log(`[SYSTEM] Scrape Session Finished for "${query}"\n`);
}

/**
 * Scrapes all default queries.
 */
async function scrapeAllDefaults(targetPlatform = 'all') {
  console.log(`[SYSTEM] Starting full batch scrape of all default queries...`);
  for (const query of DEFAULT_QUERIES) {
    await scrapeQuery(query, targetPlatform);
    // Cool down between different smartphone queries
    await delay(3000);
  }
  console.log(`[SYSTEM] Full batch scrape complete.`);
}

/**
 * Main execution handler.
 */
async function main() {
  const args = process.argv.slice(2);
  
  const runNow = args.includes('--run-now');
  
  // Parse query argument: --query="iPhone 15"
  const queryArg = args.find(arg => arg.startsWith('--query='));
  const query = queryArg ? queryArg.split('=')[1] : null;
  
  // Parse platform argument: --platform=croma
  const platformArg = args.find(arg => arg.startsWith('--platform='));
  const platform = platformArg ? platformArg.split('=')[1] : 'all';

  if (runNow) {
    console.log('[SYSTEM] Manual immediate trigger detected (--run-now)');
    if (query) {
      await scrapeQuery(query, platform);
    } else {
      await scrapeAllDefaults(platform);
    }
    process.exit(0);
  } else {
    // Cron mode: run every 4 hours ('0 */4 * * *')
    console.log('[SYSTEM] Scraper Service started in scheduler mode.');
    console.log('[SYSTEM] Next-run scheduled for: every 4 hours.');
    
    // Smoke run on start (optional, but good for confirmation)
    console.log('[SYSTEM] Performing initial startup check...');
    
    cron.schedule('0 */4 * * *', async () => {
      console.log(`[SCHEDULER] Cron job triggered at: ${new Date().toISOString()}`);
      try {
        await scrapeAllDefaults('all');
      } catch (err) {
        console.error(`[SCHEDULER] Cron job error: ${err.message}`);
      }
    });
  }
}

// Global unhandled exception catching to prevent scheduler from crashing
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception thrown:', err);
});

main();

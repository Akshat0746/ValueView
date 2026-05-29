// ============================================================
// Product Name Normalizer & Brand/Model Extractor
// Turns raw scraped titles into clean, comparable strings
// so we can deduplicate across platforms.
// ============================================================

// Filler words/phrases that e-commerce sites pad into product titles
const FILLER_PATTERNS = [
  /\bbuy\b/gi,
  /\bonline\b/gi,
  /\b(?:at\s+)?best\s+price\b/gi,
  /\bin\s+india\b/gi,
  /\(latest\)/gi,
  /\(new\)/gi,
  /\(renewed\)/gi,
  /\(refurbished\)/gi,
  /\bwith\s+exchange\s+offer\b/gi,
  /\bwith\s+offers?\b/gi,
  /\bfree\s+delivery\b/gi,
  /\bflat\s+\d+%?\s*off\b/gi,
  /\bemi\s+starts?\b/gi,
  /\bno\s+cost\s+emi\b/gi,
  /\bbrand\s+new\b/gi,
  /\bsealed\s+pack\b/gi,
  /\bunboxed\b/gi,
  /\b(?:without|with)\s+charger\b/gi,
];

// Common colour names to strip — they create false mismatches
// (e.g. "iPhone 15 Black" vs "iPhone 15 Blue" are the same product)
const COLOUR_NAMES = [
  'black', 'white', 'blue', 'red', 'green', 'gold', 'silver', 'grey', 'gray',
  'purple', 'pink', 'orange', 'yellow', 'titanium', 'graphite', 'midnight',
  'starlight', 'coral', 'cream', 'mint', 'lavender', 'phantom', 'cosmic',
  'natural', 'teal', 'desert', 'ultramarine', 'space grey', 'space gray',
  'sierra blue', 'alpine green', 'deep purple', 'product red',
  'marble black', 'glacial blue', 'rock gray', 'force black',
  'lunar white', 'ice blue', 'storm grey', 'sandstone',
];

// Build a regex that matches any colour name as a standalone word
const colourRegex = new RegExp(
  '\\b(' + COLOUR_NAMES.map((c) => c.replace(/\s+/g, '\\s+')).join('|') + ')\\b',
  'gi'
);

/**
 * Normalize a raw product title into a clean, comparable string.
 * Goal: "Apple iPhone 15 (128 GB)" on Amazon and
 *        "Buy Apple iPhone 15 128GB Black Online" on Flipkart
 *        should both become → "apple iphone 15 128 gb"
 *
 * @param {string} rawTitle
 * @returns {string} Normalized product name
 */
function normalizeName(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';

  let name = rawTitle;

  // 1. Lowercase everything
  name = name.toLowerCase();

  // 2. Remove colour names (before removing special chars so multi-word colours work)
  name = name.replace(colourRegex, ' ');

  // 3. Remove filler words/phrases
  for (const pattern of FILLER_PATTERNS) {
    name = name.replace(pattern, ' ');
  }

  // 4. Remove parentheses, brackets, and their contents if they only contain filler
  //    But keep content like "(128 GB)" — so we strip the parens but keep the text
  name = name.replace(/[()[\]]/g, ' ');

  // 5. Remove special characters except alphanumeric, spaces, dots, and hyphens
  name = name.replace(/[^a-z0-9\s.\-]/g, ' ');

  // 6. Normalize storage/memory notation: "128gb" → "128 gb"
  name = name.replace(/(\d+)\s*(gb|tb|mb|ram)/gi, '$1 $2');

  // 7. Collapse multiple spaces into one and trim
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

// Known brands and their common variations
const BRANDS = [
  { canonical: 'Apple', patterns: [/\bapple\b/i, /\biphone\b/i, /\bipad\b/i, /\bmacbook\b/i] },
  { canonical: 'Samsung', patterns: [/\bsamsung\b/i, /\bgalaxy\b/i] },
  { canonical: 'OnePlus', patterns: [/\boneplus\b/i, /\bone\s*plus\b/i] },
  { canonical: 'Xiaomi', patterns: [/\bxiaomi\b/i, /\bmi\b/i] },
  { canonical: 'Redmi', patterns: [/\bredmi\b/i] },
  { canonical: 'Realme', patterns: [/\brealme\b/i] },
  { canonical: 'Motorola', patterns: [/\bmotorola\b/i, /\bmoto\b/i] },
  { canonical: 'Vivo', patterns: [/\bvivo\b/i] },
  { canonical: 'Oppo', patterns: [/\boppo\b/i] },
  { canonical: 'Google', patterns: [/\bgoogle\b/i, /\bpixel\b/i] },
  { canonical: 'Nothing', patterns: [/\bnothing\b/i] },
  { canonical: 'iQOO', patterns: [/\biqoo\b/i] },
];

// Model patterns — tries to grab the model string that follows the brand name
// Examples: "Samsung Galaxy S24 Ultra", "iPhone 15 Pro Max", "OnePlus 12R"
const MODEL_PATTERNS = [
  // Apple: "iPhone 15 Pro Max", "iPhone SE (3rd Gen)"
  /\biphone\s*([\w\s]+?)(?:\s*\(|$|\s+\d+\s*gb)/i,
  // Samsung: "Galaxy S24 Ultra", "Galaxy A55 5G"
  /\bgalaxy\s*([\w\d]+(?:\s+[\w\d]+){0,2})/i,
  // OnePlus: "OnePlus 12R", "OnePlus Nord CE 4"
  /\boneplus\s*([\w\d]+(?:\s+[\w\d]+){0,3})/i,
  // Pixel: "Pixel 8 Pro"
  /\bpixel\s*([\w\d]+(?:\s+[\w\d]+){0,2})/i,
  // Generic: "Brand ModelName 123 Variant"
  /(?:redmi|realme|motorola|moto|vivo|oppo|nothing|iqoo|xiaomi)\s+([\w\d]+(?:\s+[\w\d]+){0,3})/i,
];

/**
 * Extract brand and model from a raw product title.
 *
 * @param {string} rawTitle
 * @returns {{ brand: string|null, model: string|null }}
 */
function extractBrandModel(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { brand: null, model: null };
  }

  // Detect brand
  let brand = null;
  for (const b of BRANDS) {
    if (b.patterns.some((p) => p.test(rawTitle))) {
      brand = b.canonical;
      break;
    }
  }

  // Extract model
  let model = null;
  for (const pattern of MODEL_PATTERNS) {
    const match = rawTitle.match(pattern);
    if (match && match[1]) {
      // Clean up the model string
      model = match[1].trim().replace(/\s+/g, ' ');
      // Remove trailing filler if it leaked in
      model = model.replace(/\b(buy|online|with|at|best|price)\b.*$/i, '').trim();
      if (model.length > 0) break;
      model = null; // reset if empty after cleanup
    }
  }

  return { brand, model };
}

module.exports = { normalizeName, extractBrandModel };

// ============================================================
// Retry Utility with Exponential Backoff + Jitter
// Wraps any async function with configurable retry logic.
// Returns a structured result object so callers can inspect
// the outcome without try/catch gymnastics.
// ============================================================

/**
 * Execute an async function with automatic retries.
 *
 * @param {Function} fn                   - Async function to execute
 * @param {Object}   [options]
 * @param {number}   [options.attempts=3] - Maximum number of attempts
 * @param {number}   [options.baseDelay=2000]  - Initial delay in ms
 * @param {number}   [options.multiplier=2]    - Backoff multiplier
 * @param {string}   [options.label='operation'] - Label for log messages
 * @returns {{ success: boolean, data: any, error: Error|null, attempts: number }}
 */
async function withRetry(fn, options = {}) {
  const {
    attempts = 3,
    baseDelay = 2000,
    multiplier = 2,
    label = 'operation',
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const data = await fn();
      return { success: true, data, error: null, attempts: attempt };
    } catch (err) {
      lastError = err;

      if (attempt < attempts) {
        // Exponential backoff: baseDelay * multiplier^(attempt-1)
        // Plus random jitter (0–50% of the computed delay) to avoid thundering herd
        const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
        const jitter = Math.random() * exponentialDelay * 0.5;
        const totalDelay = Math.round(exponentialDelay + jitter);

        console.log(
          `[RETRY] ${label} — attempt ${attempt}/${attempts} failed: ${err.message}. ` +
          `Retrying in ${totalDelay}ms…`
        );

        await sleep(totalDelay);
      } else {
        console.error(
          `[RETRY] ${label} — all ${attempts} attempts exhausted. Last error: ${err.message}`
        );
      }
    }
  }

  return { success: false, data: null, error: lastError, attempts };
}

/** Simple promisified sleep */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry };

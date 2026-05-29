/**
 * Search Route
 *
 * GET /api/search?q=<query>
 *
 * Validates the query param, delegates to the matcher service,
 * and returns a JSON array of matching products with prices.
 */

const { Router } = require('express');
const { searchProducts } = require('../services/matcher');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const query = (req.query.q || '').trim();

    // --- Validation ---
    if (!query) {
      return res.status(400).json({
        error: 'Missing required query parameter "q".',
      });
    }

    if (query.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long.',
      });
    }

    // --- Search ---
    const results = await searchProducts(query);

    return res.json({ results });
  } catch (err) {
    // Forward to global error handler
    next(err);
  }
});

module.exports = router;

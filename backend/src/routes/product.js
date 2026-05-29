/**
 * Product Route
 *
 * GET /api/product/:id
 *
 * Returns a single product's details, current per-platform prices,
 * and 30-day price history.
 */

const { Router } = require('express');
const { getProduct } = require('../services/matcher');

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // --- Validation: id must be a positive integer ---
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        error: 'Product ID must be a numeric value.',
      });
    }

    const productId = parseInt(id, 10);

    // --- Fetch product ---
    const product = await getProduct(productId);

    if (!product) {
      return res.status(404).json({
        error: `Product with ID ${productId} not found.`,
      });
    }

    return res.json({ product });
  } catch (err) {
    // Forward to global error handler
    next(err);
  }
});

module.exports = router;

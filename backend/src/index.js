/**
 * Price Comparison – Backend API Server
 *
 * Entry point: loads env vars, sets up middleware, mounts routes,
 * and starts listening on the configured port.
 */

// Load environment variables before anything else
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const searchRoutes = require('./routes/search');
const productRoutes = require('./routes/product');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const IS_DEV = process.env.NODE_ENV !== 'production';

/* ------------------------------------------------------------------ */
/*  Middleware                                                        */
/* ------------------------------------------------------------------ */

// CORS – only allow the frontend origin
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ['GET'],
  })
);

// Parse JSON request bodies (for future POST endpoints)
app.use(express.json());

// Request logging – logs method, url, status code, and duration
app.use((req, res, next) => {
  const start = Date.now();

  // Hook into the response finish event so we can capture the status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });

  next();
});

/* ------------------------------------------------------------------ */
/*  Routes                                                            */
/* ------------------------------------------------------------------ */

app.use('/api/search', searchRoutes);
app.use('/api/product', productRoutes);

// Health-check endpoint (useful for uptime monitors / load balancers)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Catch-all for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

/* ------------------------------------------------------------------ */
/*  Global Error Handler                                              */
/* ------------------------------------------------------------------ */

// Express requires the 4-arg signature to recognise this as an error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.stack || err.message);

  const status = err.status || 500;
  const message = IS_DEV
    ? err.message
    : 'An internal server error occurred.';

  res.status(status).json({ error: message });
});

/* ------------------------------------------------------------------ */
/*  Start Server                                                      */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`\n🚀  Price Comparison API running on http://localhost:${PORT}`);
  console.log(`   CORS origin : ${FRONTEND_URL}`);
  console.log(`   Environment : ${IS_DEV ? 'development' : 'production'}\n`);
});

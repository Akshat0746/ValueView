# PriceHunt — Smartphone Price Comparison

Compare smartphone prices across **Amazon.in**, **Flipkart**, and **Croma** in real-time.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Frontend   │────▶│  Backend API │────▶│   PostgreSQL     │
│  Next.js    │     │  Express     │     │   (Docker)       │
│  :3005      │     │  :3006       │     │   :5432          │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                ▲
                                                │
                                         ┌──────┴──────┐
                                         │   Scraper   │
                                         │  Service    │
                                         │ (Playwright)│
                                         └─────────────┘
```

## Prerequisites

- **Node.js** >= 18
- **Docker** & Docker Compose (for PostgreSQL)
- **npm** (comes with Node.js)

## Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL on port 5432 and auto-applies the database schema.

### 2. Install Dependencies

```bash
# Scraper service
cd scraper
npm install
npx playwright install chromium

# Backend API
cd ../backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configure Environment

```bash
# Copy env files
cp scraper/.env.example scraper/.env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Default values work out of the box for local development.

### 4. Run the Scraper (first time)

```bash
cd scraper
# Scrape a specific query
npm run scrape -- --run-now --query="iPhone 15"

# Scrape all default queries
npm run scrape -- --run-now

# Start with cron scheduler (every 4 hours)
npm start
```

### 5. Start the Backend API

```bash
cd backend
npm run dev
# Server runs on http://localhost:3006
```

### 6. Start the Frontend

```bash
cd frontend
npm run dev
# App runs on http://localhost:3005
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=iPhone 15` | Search products across all platforms |
| GET | `/api/product/:id` | Get product details with price history |

## Project Structure

```
├── scraper/                # Playwright scraper service
│   └── src/
│       ├── scrapers/       # Platform-specific scrapers
│       ├── utils/          # Browser, retry, normalizer
│       └── db/             # Schema, pool, queries
├── backend/                # Express REST API
│   └── src/
│       ├── routes/         # API routes
│       ├── services/       # Business logic
│       └── db/             # Connection pool
├── frontend/               # Next.js web app
│   └── src/
│       ├── app/            # Pages (App Router)
│       └── components/     # Reusable UI components
├── docker-compose.yml      # PostgreSQL container
└── README.md
```

## Environment Variables

### Scraper (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/pricecompare | PostgreSQL connection |
| NODE_ENV | development | Environment |

### Backend (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/pricecompare | PostgreSQL connection |
| PORT | 3006 | Server port |
| FRONTEND_URL | http://localhost:3005 | CORS origin |

### Frontend (.env.local)
| Variable | Default | Description |
|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | http://localhost:3006/api | Backend API URL |

## Scraper Details

| Platform | Strategy | Anti-Bot Level |
|----------|----------|----------------|
| Croma | JSON-LD extraction (primary) + DOM fallback | Low |
| Amazon | data-asin targeting + DOM extraction | Medium |
| Flipkart | data-id/data-pid + structural DOM | High |

All scrapers use:
- `playwright-extra` with stealth plugin
- User-agent rotation
- Random delays between actions
- Retry with exponential backoff
- Error logging to `scrape_logs` table

## Troubleshooting

### Scraper returns no results
- Check `scrape_logs` table for error messages
- Website may have changed their HTML structure
- Try running with `--platform=croma` first (most reliable)
- Check if your IP is blocked (use a VPN)

### Database connection refused
- Ensure Docker is running: `docker-compose ps`
- Check PostgreSQL logs: `docker-compose logs postgres`

### Frontend can't reach API
- Ensure backend is running on port 3006
- Check NEXT_PUBLIC_API_URL in `.env.local`
- Check browser console for CORS errors

## License

MIT — For educational/personal use only. Web scraping may violate platform ToS.

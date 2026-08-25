# KuberOne

Portfolio Tracking & Wealth Intelligence Platform

## What is KuberOne?

KuberOne is a self-hosted, family-scoped portfolio tracking platform. A family account is created at registration and the admin can invite members. Each member tracks holdings across multiple investment accounts and asset classes with real-time market data from Yahoo Finance.

## Features

- **Family Workspace** — Single family account with admin and member roles; admin invites members who set their own password via activation token
- **Multi-Account Portfolio** — Organize holdings into named investment accounts per member, each with its own currency and drag-to-reorder support
- **Multi-Asset Tracking** — Stocks, ETFs, REITs, Mutual Funds, Bonds, Gold, Silver, Crypto
- **Real-Time Market Data** — Powered by Yahoo Finance (free, no API key required), with batch price fetch and TTL cache
- **P&L Calculation** — Automatic profit/loss and return % with current market prices, FX-normalized to family base currency
- **Portfolio Dashboard** — Summary tiles, performance trendline, top 5 lifetime gainers/losers, top 5 daily gainers/losers
- **Holdings Table** — Sortable, per-account filterable, with CSV/Excel import
- **Backup & Restore** — Export all accounts and holdings to a JSON file; restore with replace or append mode
- **Dark Mode** — System-aware with manual toggle
- **Mobile Responsive** — Optimized for phones and tablets
- **Secure Auth** — JWT access + refresh tokens with JTI rotation and token versioning
- **Self-Hosted** — Runs entirely in Docker with no external dependencies

## Tech Stack

### Backend
- **FastAPI** (Python) — REST API
- **PostgreSQL** — Relational database
- **SQLAlchemy** — ORM
- **JWT (python-jose)** — Access + refresh token auth with JTI rotation
- **bcrypt** — Password hashing
- **yfinance** — Yahoo Finance integration

### Frontend
- **React 18 + TypeScript** — UI
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **Zustand** — Auth + price cache state (persisted to localStorage)
- **react-hook-form** — Form handling
- **Axios** — HTTP client with 401 interceptor and refresh retry

### Infrastructure
- **Docker + Docker Compose** — Multi-container orchestration
- **Nginx** — Serves frontend, proxies `/api` to backend

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd kuberone
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Open `.env` and set:

   | Variable | Description |
   |---|---|
   | `DB_PASSWORD` | PostgreSQL password |
   | `SECRET_KEY` | JWT signing key (at least 32 random characters) |
   | `FRONTEND_URL` | Frontend origin for CORS (default: `http://localhost:5173`) |

3. **Start the application**
   ```bash
   docker compose up -d
   ```

4. **Open your browser**: [http://localhost:5173](http://localhost:5173)

5. **Register** — creates your family account (you become Admin). Log in and start adding accounts and holdings.

## Usage

### Family & Members

The first user to register creates a **Family** and becomes its Admin. The admin can invite members via **Settings → Members** (generates an activation link). Invited members set their own password before logging in.

### Accounts

Each family member can have multiple **investment accounts** (e.g., "HDFC Demat", "Zerodha", "US Brokerage"). Accounts specify a currency and can be reordered on the Accounts page.

### Holdings

Add holdings manually by entering a ticker symbol. Prices are fetched from Yahoo Finance.

| Market | Symbol format | Example |
|---|---|---|
| Indian stocks (NSE) | `SYMBOL.NS` | `RELIANCE.NS`, `TCS.NS` |
| Indian stocks (BSE) | `SYMBOL.BO` | `RELIANCE.BO` |
| US stocks | Plain symbol | `AAPL`, `GOOGL` |
| Other markets | Check Yahoo Finance | — |

Holdings can also be bulk-imported via **CSV or Excel** from the Holdings page.

### Dashboard

Aggregates all holdings across all accounts and shows:
- Summary tiles: Total Investment, Current Value, Total P&L, Total Return %
- Performance trendline over time
- Top 5 Lifetime Gainers / Losers
- Top 5 Daily Gainers / Losers

### Backup & Restore

Go to **Settings → Backup** to export all accounts and holdings to a `.json` file. Admins can choose which family members to include; members export only their own data.

To restore, upload a KuberOne backup file. Two modes are available:
- **Clear & Restore** — wipes existing holdings in matched accounts before importing (best for a clean restore)
- **Append** — adds backup holdings alongside existing ones

Accounts are matched by name + currency + owner. New accounts are created if no match is found; existing accounts are never duplicated.

### Preferences

Go to **Settings → Preferences** to set the price cache duration (1 minute to 1 hour). Market prices are cached client-side for this duration and reused across the Dashboard and Holdings pages; use Refresh to force an immediate update.

## Docker Commands

```bash
# Start all services
docker compose up -d

# Stop services (keep data)
docker compose down

# Stop and remove volumes (deletes database)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
```

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens (short-lived) + refresh tokens with JTI rotation
- `token_version` on User enables instant invalidation of all sessions
- CORS restricted to configured `FRONTEND_URL`
- All secrets via environment variables — nothing hardcoded

## Troubleshooting

**Database connection failed**
```bash
docker compose ps       # Check all containers are running
docker compose logs db  # Check PostgreSQL logs
```

**Port 5173 already in use**

Change the host port in `docker-compose.yml`:
```yaml
ports:
  - "3000:5173"  # Access on http://localhost:3000
```
Also update `FRONTEND_URL` in `.env` to match.

**Symbol not found / price shows zero**
- For Indian NSE stocks append `.NS` (e.g., `RELIANCE.NS`)
- For BSE stocks append `.BO`
- Verify the symbol at [finance.yahoo.com](https://finance.yahoo.com)

**Frontend shows blank page**
```bash
docker compose logs frontend
docker compose up -d --build frontend
```

## License

MIT License — feel free to use and modify.

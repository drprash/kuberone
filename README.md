# KuberOne

Portfolio Tracking & Wealth Intelligence Platform

## What is KuberOne?

KuberOne is a self-hosted, family-scoped portfolio tracking platform. A family account is created at registration, and the admin can invite members. Each member tracks holdings across multiple investment accounts and asset classes with real-time market data from Yahoo Finance.

## Features

- **Family Accounts**: Single family workspace with admin and member roles
- **Member Invitation Flow**: Admin invites members who set their own password via activation token
- **Multi-Account Portfolio**: Organize holdings into named investment accounts per member
- **Multi-Asset Tracking**: Stocks, ETFs, REITs, Mutual Funds, Bonds, Gold, Silver, Crypto
- **Account Types**: NRE, NRO, and Resident accounts
- **Real-Time Market Data**: Powered by Yahoo Finance (free, no API key required)
- **P&L Calculation**: Automatic profit/loss with current market prices
- **Secure Auth**: JWT access + refresh tokens with JTI rotation and token versioning
- **Self-Hosted**: Runs entirely in Docker with no external dependencies

## Tech Stack

### Backend
- **FastAPI** (Python) — Modern async web framework
- **PostgreSQL** — Relational database
- **SQLAlchemy** — ORM for database interactions
- **JWT (python-jose)** — Access + refresh token authentication with JTI rotation
- **bcrypt** — Password hashing
- **yfinance** — Yahoo Finance integration

### Frontend
- **React 18** — UI library
- **TypeScript** — Type-safe JavaScript
- **Vite** — Fast build tool
- **Tailwind CSS** — Utility-first CSS framework
- **React Router** — Client-side routing
- **Zustand** — State management (auth + theme, persisted to localStorage)
- **react-hook-form** — Form handling
- **Axios** — HTTP client with 401 interceptor and refresh retry

### Infrastructure
- **Docker + Docker Compose** — Multi-container orchestration
- **Nginx** — Serves frontend and proxies `/api` to backend

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (Port 5173)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend Container (Nginx + React)                     │
│  - Serves static files                                  │
│  - Proxies /api/* → backend                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Backend Container (FastAPI, Port 8000)                 │
│  - REST API endpoints                                   │
│  - JWT authentication with refresh rotation             │
│  - Yahoo Finance integration                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Database Container (PostgreSQL)                        │
│  - Family, User, Account, Holding data                  │
│  - Refresh and Activation tokens                        │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Docker
- Docker Compose

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

   Edit `.env` and set strong values for:
   - `DB_PASSWORD` — PostgreSQL password
   - `SECRET_KEY` — JWT signing key (at least 32 characters)
   - `FRONTEND_URL` — Frontend origin for CORS (default: `http://localhost:5173`)

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**

   Open your browser: **http://localhost:5173**

5. **Register**
   - Click **Register** and create your family account (you become the Admin)
   - Log in and start adding investment accounts and holdings

## Usage

### Family & Members

The first user to register creates a **Family** and becomes its Admin. The admin can:
- Invite members via **Settings → Members** (generates an activation link)
- Edit or remove members
- Reset a member's password

Invited members receive an activation token and must set their password before logging in.

### Accounts

Each family member can have multiple **investment accounts** (e.g., "HDFC Demat", "Zerodha", "US Brokerage"). Accounts specify which asset types they hold and can be reordered.

### Holdings

Add holdings to an account by entering a ticker symbol and looking up its current price from Yahoo Finance.

- **US Stocks**: Plain symbol — `AAPL`, `GOOGL`, `MSFT`
- **Indian Stocks (NSE)**: Add `.NS` — `RELIANCE.NS`, `TCS.NS`, `INFY.NS`
- **Other markets**: Check Yahoo Finance for the correct symbol format

### Dashboard

The dashboard aggregates all holdings across all accounts and shows:
- **Total Investment**: Sum of (quantity × avg buy price)
- **Current Value**: Sum of (quantity × current price)
- **Total P&L**: Current Value − Total Investment
- **Total Return %**: P&L / Investment × 100

## Development

### Project Structure

```
kuberone/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, router registration
│   │   ├── config.py            # Settings & environment config
│   │   ├── database.py          # Database connection
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── auth.py              # JWT helpers, password hashing
│   │   └── routers/
│   │       ├── auth.py          # Auth endpoints (register, login, refresh, me)
│   │       ├── admin.py         # Admin endpoints (family, members)
│   │       ├── accounts.py      # Account CRUD + summary
│   │       ├── holdings.py      # Holdings CRUD
│   │       ├── market.py        # Yahoo Finance price endpoints
│   │       └── backup.py        # Data export/backup
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # Router, layout selection, protected routes
│   │   ├── layouts/
│   │   │   ├── AuthLayout.tsx   # Centered card (login, register, set-password)
│   │   │   └── MainLayout.tsx   # Sidebar + mobile hamburger (app pages)
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── SetPassword.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Accounts.tsx
│   │   │   ├── Holdings.tsx
│   │   │   ├── AddHolding.tsx
│   │   │   ├── ImportHoldings.tsx
│   │   │   ├── PortfolioSummary.tsx
│   │   │   └── Settings.tsx
│   │   ├── store/
│   │   │   ├── authStore.ts     # Zustand auth state (persisted)
│   │   │   └── themeStore.ts    # Zustand theme state
│   │   ├── lib/
│   │   │   └── api.ts           # Axios client, 401 refresh retry
│   │   ├── components/          # Shared UI components
│   │   └── types/               # TypeScript interfaces
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

### Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop services (keep data)
docker-compose down

# Stop and remove volumes (deletes database)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens (short-lived) + refresh tokens with JTI rotation
- `token_version` on User enables instant invalidation of all sessions
- CORS restricted to configured `FRONTEND_URL`
- All secrets via environment variables — nothing hardcoded

## Limitations

- Yahoo Finance data may have slight delays and rate limits
- Not all symbols are available on Yahoo Finance
- Market prices are fetched client-side per holding (no server-side caching)

## Troubleshooting

**Database connection failed**
```bash
docker-compose ps          # Check containers are running
docker-compose logs db     # Check PostgreSQL logs
```

**Port 5173 already in use**
Change the host port in `docker-compose.yml`:
```yaml
ports:
  - "3000:5173"   # Access on http://localhost:3000
```

**Symbol not found**
- For Indian NSE stocks, append `.NS` (e.g., `RELIANCE.NS`)
- Verify the symbol at [finance.yahoo.com](https://finance.yahoo.com)

**Frontend shows blank page**
```bash
docker-compose logs frontend
docker-compose up -d --build frontend
```

## License

MIT License — feel free to use and modify.

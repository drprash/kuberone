from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.config import settings
from app.routers import auth, holdings, market, accounts, admin, backup, portfolio
from app.snapshot import capture_all_families

def build_allowed_origins(frontend_url_value: str) -> list[str]:
    origins = [item.strip() for item in frontend_url_value.split(",") if item.strip()]
    allow_origins: list[str] = []

    for origin in origins:
        if origin not in allow_origins:
            allow_origins.append(origin)

        if "localhost" in origin:
            mirror_origin = origin.replace("localhost", "127.0.0.1")
            if mirror_origin not in allow_origins:
                allow_origins.append(mirror_origin)
        elif "127.0.0.1" in origin:
            mirror_origin = origin.replace("127.0.0.1", "localhost")
            if mirror_origin not in allow_origins:
                allow_origins.append(mirror_origin)

    return allow_origins


def run_migrations() -> None:
    """Apply incremental DDL on every startup — all statements are idempotent."""
    statements = [
        # account_type was removed from the ORM model but left as NOT NULL with no default
        # on existing installs. Only set the default if the column still exists (fresh installs
        # won't have it because create_all uses the current model which no longer defines it).
        """
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'holdings' AND column_name = 'account_type'
            ) THEN
                ALTER TABLE holdings ALTER COLUMN account_type SET DEFAULT 'RESIDENT';
            END IF;
        END $$
        """,
    ]
    with engine.connect() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.commit()


# Create base tables then apply incremental migrations
Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(
    title=settings.app_name,
    description="Portfolio tracking and wealth intelligence platform",
    version="1.0.0"
)

allowed_origins = build_allowed_origins(settings.frontend_url)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(holdings.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(portfolio.router, prefix="/api")


def _run_daily_snapshot_job() -> None:
    """Captures today's portfolio snapshot for every family — see app.snapshot."""
    db = SessionLocal()
    try:
        count = capture_all_families(db)
        print(f"Daily portfolio snapshot: captured {count} families")
    except Exception as e:
        print(f"Daily portfolio snapshot job failed: {e}")
    finally:
        db.close()


scheduler = BackgroundScheduler(timezone="UTC")


@app.on_event("startup")
def _start_scheduler() -> None:
    # Single backend process (no --workers), so one in-process scheduler is safe —
    # no risk of the same job firing multiple times from separate workers.
    scheduler.add_job(
        _run_daily_snapshot_job,
        "cron",
        hour=23,
        minute=55,
        id="daily_portfolio_snapshot",
        replace_existing=True,
    )
    scheduler.start()


@app.on_event("shutdown")
def _stop_scheduler() -> None:
    scheduler.shutdown(wait=False)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/")
def root():
    return {
        "message": "KuberOne Portfolio Tracker API",
        "docs": "/docs",
        "health": "/api/health"
    }

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.config import settings
from app.routers import auth, holdings, market, accounts, admin, backup

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

# Create database tables
Base.metadata.create_all(bind=engine)

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

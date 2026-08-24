from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_admin
from app.snapshot import capture_family_snapshot

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/history", response_model=List[schemas.PortfolioSnapshotResponse])
def get_portfolio_history(
    days: int = 30,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Real daily portfolio snapshots for the user's family, most recent `days` days.
    See app.snapshot for how these are captured and what they represent."""
    days = max(1, min(days, 365))
    since = date.today() - timedelta(days=days - 1)
    snapshots = (
        db.query(models.PortfolioSnapshot)
        .filter(
            models.PortfolioSnapshot.family_id == current_user.family_id,
            models.PortfolioSnapshot.snapshot_date >= since,
        )
        .order_by(models.PortfolioSnapshot.snapshot_date)
        .all()
    )
    return [
        schemas.PortfolioSnapshotResponse(
            date=s.snapshot_date,
            total_investment=s.total_investment,
            total_value=s.total_value,
        )
        for s in snapshots
    ]


@router.post("/snapshot", response_model=schemas.PortfolioSnapshotResponse, status_code=201)
def trigger_snapshot(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Manually captures today's snapshot for the current family (admin only).
    Idempotent — safe to call more than once a day. Useful right after initial
    setup/import so the trendline has a first data point without waiting for the
    scheduled job, or as a fallback if the scheduler didn't run."""
    snapshot = capture_family_snapshot(db, current_user.family)
    return schemas.PortfolioSnapshotResponse(
        date=snapshot.snapshot_date,
        total_investment=snapshot.total_investment,
        total_value=snapshot.total_value,
    )

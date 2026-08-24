"""Daily portfolio snapshot capture.

Computes each family's total investment and current value (in the family's
base currency) and stores one row per family per day. This is what powers the
real portfolio performance history on the Dashboard trendline — replacing a
chart that used to interpolate fake noise between two numbers.

Snapshots are captured at the family level (all accounts, all members), which
matches what an ADMIN's Dashboard shows. For a family using PRIVATE account
visibility, an individual MEMBER's own Dashboard total may differ from the
family-wide history shown here — that's a known simplification: capturing a
separate series per member would multiply the number of Yahoo Finance calls
made by the daily job by the number of members.
"""
from datetime import date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.orm import Session

from app import models
from app.fx import get_exchange_rate
from app.routers.market import _fetch_price


def capture_family_snapshot(db: Session, family: models.Family) -> models.PortfolioSnapshot:
    """Computes and upserts today's snapshot for one family. Idempotent — safe to
    call more than once on the same day (e.g. manual trigger + scheduled job)."""
    holdings: list[models.Holding] = []
    account_currency_by_id: dict = {}
    for account in family.accounts:
        account_currency_by_id[account.id] = account.currency
        holdings.extend(h for h in account.holdings if not h.is_draft)

    symbols = sorted({h.symbol for h in holdings})
    prices: dict = {}
    if symbols:
        with ThreadPoolExecutor(max_workers=min(len(symbols), 10)) as executor:
            results = list(executor.map(_fetch_price, symbols))
        prices = {r.symbol: r for r in results}

    total_investment = Decimal("0")
    total_value = Decimal("0")
    for holding in holdings:
        price = prices.get(holding.symbol)
        if price is None or price.current_price is None or price.error:
            # Excluded, not valued at zero — a failed fetch shouldn't read as a
            # fabricated loss in the history either.
            continue

        account_currency = account_currency_by_id[holding.account_id]
        price_currency = price.currency or account_currency

        fx_account = Decimal(str(get_exchange_rate(account_currency, family.base_currency)))
        fx_price = Decimal(str(get_exchange_rate(price_currency, family.base_currency)))

        total_investment += holding.quantity * holding.avg_buy_price * fx_account
        total_value += holding.quantity * price.current_price * fx_price

    today = date.today()
    snapshot = (
        db.query(models.PortfolioSnapshot)
        .filter(
            models.PortfolioSnapshot.family_id == family.id,
            models.PortfolioSnapshot.snapshot_date == today,
        )
        .first()
    )
    if snapshot:
        snapshot.total_investment = total_investment
        snapshot.total_value = total_value
    else:
        snapshot = models.PortfolioSnapshot(
            family_id=family.id,
            snapshot_date=today,
            total_investment=total_investment,
            total_value=total_value,
        )
        db.add(snapshot)

    db.commit()
    db.refresh(snapshot)
    return snapshot


def capture_all_families(db: Session) -> int:
    """Runs capture_family_snapshot for every (non-deleted) family. Returns the
    number of families captured. Used by the daily scheduled job."""
    families = db.query(models.Family).filter(models.Family.deleted_at.is_(None)).all()
    for family in families:
        capture_family_snapshot(db, family)
    return len(families)

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
import json

from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("")
def create_backup(
    user_ids: Optional[str] = None,  # comma-separated; admin-only filter
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a JSON backup of accounts and holdings.

    Admin: can filter by user_ids (defaults to all family members).
    Member: always exports only their own data.
    """
    is_admin = current_user.role == models.Role.ADMIN

    if is_admin:
        if user_ids:
            uid_list = [u.strip() for u in user_ids.split(",") if u.strip()]
            target_users = (
                db.query(models.User)
                .filter(
                    models.User.id.in_(uid_list),
                    models.User.family_id == current_user.family_id,
                )
                .all()
            )
        else:
            target_users = (
                db.query(models.User)
                .filter(models.User.family_id == current_user.family_id)
                .all()
            )
    else:
        target_users = [current_user]

    accounts_data = []
    for user in target_users:
        user_accounts = (
            db.query(models.Account)
            .filter(models.Account.user_id == user.id)
            .order_by(models.Account.sort_order)
            .all()
        )
        for account in user_accounts:
            holdings = (
                db.query(models.Holding)
                .filter(models.Holding.account_id == account.id)
                .all()
            )
            accounts_data.append(
                {
                    "id": str(account.id),
                    "name": account.name,
                    "currency": account.currency,
                    "asset_types": account.asset_types,
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "user_first_name": user.first_name,
                    "holdings": [
                        {
                            "symbol": h.symbol,
                            "name": h.name,
                            "quantity": str(h.quantity),
                            "avg_buy_price": str(h.avg_buy_price),
                            "asset_type": h.asset_type.value,
                            "is_draft": h.is_draft,
                        }
                        for h in holdings
                    ],
                }
            )

    return {
        "version": "1.0",
        "app": "KuberOne",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "family_name": current_user.family.name,
        "accounts": accounts_data,
    }


@router.post("/restore")
def restore_backup(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore accounts and holdings from a KuberOne JSON backup.

    - Accounts are matched by (owner user_id + name + currency); created if not found.
    - Holdings are always inserted fresh into the matched/created account.
    - Admin: can restore data for any family member found by email in the backup.
    - Member: only restores accounts whose user_email matches their own email.
    """
    is_admin = current_user.role == models.Role.ADMIN

    try:
        content = file.file.read()
        data = json.loads(content)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON file",
        )

    if data.get("app") != "KuberOne" or "accounts" not in data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid KuberOne backup file",
        )

    # Build email -> user map for the family
    family_members = (
        db.query(models.User)
        .filter(models.User.family_id == current_user.family_id)
        .all()
    )
    email_to_user = {m.email: m for m in family_members}

    accounts_created = 0
    accounts_matched = 0
    holdings_created = 0
    holdings_failed = 0

    for acc_data in data.get("accounts", []):
        user_email = acc_data.get("user_email", "")

        # Determine which user this account belongs to
        if is_admin:
            owner = email_to_user.get(user_email, current_user)
        else:
            if user_email and user_email != current_user.email:
                continue  # members skip accounts not belonging to them
            owner = current_user

        # Match account by owner + name + currency (avoid duplicates)
        existing = (
            db.query(models.Account)
            .filter(
                models.Account.user_id == owner.id,
                models.Account.name == acc_data["name"],
                models.Account.currency == acc_data.get("currency", "INR"),
            )
            .first()
        )

        if existing:
            account = existing
            accounts_matched += 1
        else:
            account = models.Account(
                family_id=current_user.family_id,
                user_id=owner.id,
                name=acc_data["name"],
                currency=acc_data.get("currency", "INR"),
                asset_types=acc_data.get("asset_types", ["STOCK"]),
            )
            db.add(account)
            db.flush()  # obtain account.id before inserting holdings
            accounts_created += 1

        # Insert holdings into this account
        for h in acc_data.get("holdings", []):
            try:
                asset_type = models.AssetType(h.get("asset_type", "STOCK"))
                quantity = Decimal(str(h["quantity"]))
                avg_buy_price = Decimal(str(h["avg_buy_price"]))

                holding = models.Holding(
                    account_id=account.id,
                    symbol=h["symbol"].upper(),
                    name=h.get("name") or h["symbol"],
                    quantity=quantity,
                    avg_buy_price=avg_buy_price,
                    asset_type=asset_type,
                    is_draft=h.get("is_draft", False),
                )
                db.add(holding)
                holdings_created += 1
            except (KeyError, ValueError, InvalidOperation):
                holdings_failed += 1

    db.commit()

    return {
        "accounts_created": accounts_created,
        "accounts_matched": accounts_matched,
        "holdings_created": holdings_created,
        "holdings_failed": holdings_failed,
    }

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from decimal import Decimal
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.put("/reorder", status_code=200)
def reorder_accounts(
    items: List[schemas.AccountReorderItem],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """Reorder accounts (admin only)"""
    for item in items:
        account = db.query(models.Account).filter(
            models.Account.id == item.id,
            models.Account.family_id == current_user.family_id
        ).first()
        if account:
            account.sort_order = item.sort_order

    db.commit()
    return {"status": "ok"}

@router.get("", response_model=List[schemas.AccountSummary])
def get_accounts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all accounts accessible to the current user with summaries"""
    # Get accounts based on privacy level
    # Admins always see all family accounts regardless of privacy level
    family_privacy = current_user.family.privacy_level
    is_admin = current_user.role == models.Role.ADMIN

    if is_admin or family_privacy == models.PrivacyLevel.FAMILY:
        # See all family accounts
        accounts = db.query(models.Account).options(
            joinedload(models.Account.user)
        ).filter(
            models.Account.family_id == current_user.family_id
        ).order_by(models.Account.sort_order).all()
    elif family_privacy == models.PrivacyLevel.PRIVATE:
        # See only own accounts
        accounts = db.query(models.Account).options(
            joinedload(models.Account.user)
        ).filter(
            models.Account.user_id == current_user.id
        ).all()
    else:  # SHARED - future implementation
        accounts = db.query(models.Account).options(
            joinedload(models.Account.user)
        ).filter(
            models.Account.user_id == current_user.id
        ).all()

    # Calculate summaries for each account
    result = []
    for account in accounts:
        holdings = db.query(models.Holding).filter(
            models.Holding.account_id == account.id
        ).all()

        invested_amount = sum(h.quantity * h.avg_buy_price for h in holdings)
        # Note: current_value requires market prices, will be calculated on frontend
        # For now, return 0 and let frontend fetch prices

        result.append(schemas.AccountSummary(
            id=account.id,
            family_id=account.family_id,
            user_id=account.user_id,
            name=account.name,
            currency=account.currency,
            asset_types=account.asset_types,
            created_at=account.created_at,
            updated_at=account.updated_at,
            invested_amount=Decimal(str(invested_amount)),
            current_value=Decimal("0"),
            profit_loss=Decimal("0"),
            profit_loss_percentage=Decimal("0"),
            holdings_count=len(holdings),
            user_first_name=account.user.first_name if account.user else None
        ))

    return result

@router.post("", response_model=schemas.AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    account: schemas.AccountCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new account"""
    # Validate asset types
    valid_asset_types = [e.value for e in models.AssetType]
    for asset_type in account.asset_types:
        if asset_type not in valid_asset_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid asset type: {asset_type}. Valid types: {', '.join(valid_asset_types)}"
            )

    db_account = models.Account(
        family_id=current_user.family_id,
        user_id=current_user.id,
        name=account.name,
        currency=account.currency,
        asset_types=account.asset_types
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)

    return schemas.AccountResponse.from_orm(db_account)

@router.get("/{account_id}", response_model=schemas.AccountResponse)
def get_account(
    account_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific account"""
    account = db.query(models.Account).filter(
        models.Account.id == account_id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Check access based on privacy level
    # Admins always have full family access
    family_privacy = current_user.family.privacy_level
    is_admin = current_user.role == models.Role.ADMIN
    if not is_admin and family_privacy == models.PrivacyLevel.PRIVATE:
        if account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access other users' accounts"
            )
    if account.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account does not belong to your family"
        )

    return schemas.AccountResponse.from_orm(account)

@router.get("/{account_id}/summary", response_model=schemas.AccountSummary)
def get_account_summary(
    account_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get account summary with holdings calculations"""
    account = db.query(models.Account).filter(
        models.Account.id == account_id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Check access based on privacy level
    # Admins always have full family access
    family_privacy = current_user.family.privacy_level
    is_admin = current_user.role == models.Role.ADMIN
    if not is_admin and family_privacy == models.PrivacyLevel.PRIVATE:
        if account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access other users' accounts"
            )
    if account.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account does not belong to your family"
        )

    # Calculate summary
    holdings = db.query(models.Holding).filter(
        models.Holding.account_id == account.id
    ).all()

    invested_amount = sum(h.quantity * h.avg_buy_price for h in holdings)

    return schemas.AccountSummary(
        id=account.id,
        family_id=account.family_id,
        user_id=account.user_id,
        name=account.name,
        currency=account.currency,
        asset_types=account.asset_types,
        created_at=account.created_at,
        updated_at=account.updated_at,
        invested_amount=Decimal(str(invested_amount)),
        current_value=Decimal("0"),  # Frontend will calculate with market prices
        profit_loss=Decimal("0"),
        profit_loss_percentage=Decimal("0"),
        holdings_count=len(holdings)
    )

@router.put("/{account_id}", response_model=schemas.AccountResponse)
def update_account(
    account_id: str,
    account_update: schemas.AccountUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an account"""
    account = db.query(models.Account).filter(
        models.Account.id == account_id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Check ownership - only account owner can update
    if account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the account owner can update the account"
        )

    # Update fields if provided
    update_data = account_update.model_dump(exclude_unset=True)

    # Validate asset types if being updated
    if "asset_types" in update_data:
        valid_asset_types = [e.value for e in models.AssetType]
        for asset_type in update_data["asset_types"]:
            if asset_type not in valid_asset_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid asset type: {asset_type}"
                )

        # Check if any existing holdings would become invalid
        holdings = db.query(models.Holding).filter(
            models.Holding.account_id == account.id
        ).all()

        for holding in holdings:
            if holding.asset_type.value not in update_data["asset_types"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot remove asset type {holding.asset_type.value} - holding {holding.symbol} uses this type"
                )

    for field, value in update_data.items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)

    return schemas.AccountResponse.from_orm(account)

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an account (only if no holdings)"""
    account = db.query(models.Account).filter(
        models.Account.id == account_id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Check ownership or admin role
    if account.user_id != current_user.id and current_user.role != models.Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the account owner or admin can delete the account"
        )

    # Check for holdings
    holdings_count = db.query(models.Holding).filter(
        models.Holding.account_id == account.id
    ).count()

    if holdings_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete account with {holdings_count} holdings. Delete holdings first."
        )

    db.delete(account)
    db.commit()

    return None

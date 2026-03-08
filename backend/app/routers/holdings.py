from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/holdings", tags=["holdings"])

@router.get("", response_model=List[schemas.HoldingResponse])
def get_holdings(
    account_id: str = None,
    include_drafts: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all holdings for the current user's family accounts"""
    # Get all accounts accessible to the user based on privacy level
    # Admins always see all family accounts regardless of privacy level
    family_privacy = current_user.family.privacy_level
    is_admin = current_user.role == models.Role.ADMIN

    if is_admin or family_privacy == models.PrivacyLevel.FAMILY:
        # See all family accounts
        accessible_accounts = db.query(models.Account).filter(
            models.Account.family_id == current_user.family_id
        ).all()
    elif family_privacy == models.PrivacyLevel.PRIVATE:
        # See only own accounts
        accessible_accounts = db.query(models.Account).filter(
            models.Account.user_id == current_user.id
        ).all()
    else:  # SHARED - future implementation
        accessible_accounts = db.query(models.Account).filter(
            models.Account.user_id == current_user.id
        ).all()

    account_ids = [str(acc.id) for acc in accessible_accounts]

    # Filter holdings by accessible accounts
    query = db.query(models.Holding).filter(
        models.Holding.account_id.in_(account_ids)
    )

    if not include_drafts:
        query = query.filter(models.Holding.is_draft == False)

    # Optional account filter
    if account_id:
        query = query.filter(models.Holding.account_id == account_id)

    holdings = query.all()

    return [schemas.HoldingResponse.from_orm(holding) for holding in holdings]

@router.post("", response_model=schemas.HoldingResponse, status_code=status.HTTP_201_CREATED)
def create_holding(
    holding: schemas.HoldingCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new holding"""
    # Verify account exists and user has access
    account = db.query(models.Account).filter(
        models.Account.id == holding.account_id
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
                detail="Cannot add holdings to other users' accounts"
            )
    if account.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account does not belong to your family"
        )

    # Validate asset type is allowed in account
    if holding.asset_type.value not in account.asset_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset type {holding.asset_type.value} not allowed in this account. Allowed types: {', '.join(account.asset_types)}"
        )

    db_holding = models.Holding(
        account_id=holding.account_id,
        symbol=holding.symbol.upper(),
        name=holding.name,
        quantity=holding.quantity,
        avg_buy_price=holding.avg_buy_price,
        asset_type=holding.asset_type,
        is_draft=holding.is_draft
    )
    db.add(db_holding)
    db.commit()
    db.refresh(db_holding)

    return schemas.HoldingResponse.from_orm(db_holding)

@router.put("/{holding_id}", response_model=schemas.HoldingResponse)
def update_holding(
    holding_id: str,
    holding_update: schemas.HoldingUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a holding"""
    db_holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id
    ).first()

    if not db_holding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holding not found"
        )

    # Check access to the account
    # Admins always have full family access
    account = db_holding.account
    family_privacy = current_user.family.privacy_level
    is_admin = current_user.role == models.Role.ADMIN

    if account.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Holding does not belong to your family"
        )
    if not is_admin and family_privacy == models.PrivacyLevel.PRIVATE:
        if account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update holdings in other users' accounts"
            )

    # Update fields if provided
    update_data = holding_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "symbol" and value:
            value = value.upper()
        if field == "asset_type" and value:
            # Validate asset type is allowed in account
            if value.value not in account.asset_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Asset type {value.value} not allowed in this account"
                )
        setattr(db_holding, field, value)

    db.commit()
    db.refresh(db_holding)

    return schemas.HoldingResponse.from_orm(db_holding)

@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holding(
    holding_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a holding"""
    db_holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id
    ).first()

    if not db_holding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holding not found"
        )

    # Check access to the account
    # Admins always have full family access regardless of privacy level
    account = db_holding.account
    is_admin = current_user.role == models.Role.ADMIN

    if account.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Holding does not belong to your family"
        )
    if not is_admin:
        family_privacy = current_user.family.privacy_level
        if family_privacy in (models.PrivacyLevel.PRIVATE, models.PrivacyLevel.FAMILY):
            if account.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot delete holdings from other users' accounts"
                )

    db.delete(db_holding)
    db.commit()

    return None

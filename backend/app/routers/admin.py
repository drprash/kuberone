import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.database import get_db
from app import models, schemas
from app.auth import get_current_admin, get_current_user, get_password_hash

router = APIRouter(prefix="/admin", tags=["admin"])


def _create_activation_token(db: Session, user_id: UUID, hours: int = 72) -> models.ActivationToken:
    token_string = secrets.token_urlsafe(32)
    db_token = models.ActivationToken(
        user_id=user_id,
        token=token_string,
        expires_at=datetime.utcnow() + timedelta(hours=hours)
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


@router.get("/family", response_model=schemas.FamilyResponse)
def get_family(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get the current user's family profile."""
    family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
    if not family:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")
    return schemas.FamilyResponse.model_validate(family)


@router.patch("/family", response_model=schemas.FamilyResponse)
def update_family(
    update_data: schemas.FamilyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """Update the family profile (admin only)."""
    family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
    if not family:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(family, field, value)

    db.commit()
    db.refresh(family)
    return schemas.FamilyResponse.model_validate(family)


@router.post("/members", response_model=schemas.MemberInviteInformation, status_code=status.HTTP_201_CREATED)
def create_member_with_activation(
    member_data: schemas.MemberCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """
    Create a new family member with activation token.
    Admin receives the activation token to share with the member.
    Member uses it at /auth/set-password to set their password.
    """
    if db.query(models.User).filter(
        models.User.email == member_data.email,
        models.User.deleted_at.is_(None)
    ).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    db_user = models.User(
        family_id=current_user.family_id,
        email=member_data.email,
        first_name=member_data.first_name,
        last_name=member_data.last_name,
        role=member_data.role,
        password_hash=None,
        password_required=True,
        activated=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    activation_token = _create_activation_token(db, db_user.id)

    return schemas.MemberInviteInformation(
        user_id=db_user.id,
        email=db_user.email,
        first_name=db_user.first_name,
        last_name=db_user.last_name,
        role=db_user.role,
        activation_token=activation_token.token,
        activation_expires_at=activation_token.expires_at
    )


@router.get("/members", response_model=List[schemas.UserResponse])
def list_family_members(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """List all family members (admin only)."""
    users = db.query(models.User).filter(
        models.User.family_id == current_user.family_id,
        models.User.deleted_at.is_(None)
    ).all()
    return [schemas.UserResponse.model_validate(u) for u in users]


@router.put("/members/{user_id}", response_model=schemas.UserResponse)
def update_member(
    user_id: UUID,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """Update a family member (admin only)."""
    if user_id == current_user.id and user_update.role and user_update.role != models.Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote yourself from admin"
        )

    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.family_id == current_user.family_id,
        models.User.deleted_at.is_(None)
    ).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    db.commit()
    db.refresh(db_user)
    return schemas.UserResponse.model_validate(db_user)


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_member(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """Soft-delete a family member (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.family_id == current_user.family_id,
        models.User.deleted_at.is_(None)
    ).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db_user.deleted_at = datetime.utcnow()
    db_user.active = False
    db_user.token_version = (db_user.token_version or 0) + 1
    db.commit()


@router.post("/members/{user_id}/reset-password", response_model=schemas.PasswordResetTokenResponse)
def reset_member_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    """Generate a password reset token for a family member (admin only)."""
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.family_id == current_user.family_id,
        models.User.deleted_at.is_(None)
    ).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not db_user.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset password for inactive users"
        )

    # Invalidate existing sessions
    db_user.token_version = (db_user.token_version or 0) + 1
    db.commit()

    reset_token = _create_activation_token(db, db_user.id)
    return schemas.PasswordResetTokenResponse(
        token=reset_token.token,
        expires_at=reset_token.expires_at,
        user_email=db_user.email
    )

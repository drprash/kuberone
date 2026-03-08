import uuid
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token_pair(db: Session, user: models.User):
    """Issue access + refresh token pair and persist the refresh token JTI."""
    jti = str(uuid.uuid4())
    access_token, _ = create_access_token(
        data={"sub": str(user.id), "role": user.role.value}
    )
    expires_at = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    refresh_token_str = create_refresh_token(
        data={"sub": str(user.id), "v": user.token_version},
        jti=jti
    )
    # Store refresh token JTI in DB
    rt = models.RefreshToken(
        jti=jti,
        user_id=user.id,
        token_version=user.token_version,
        expires_at=expires_at
    )
    db.add(rt)
    db.commit()
    return access_token, refresh_token_str


def _consume_refresh_token(db: Session, jti: str) -> bool:
    """Mark refresh token as used. Returns False if already used (reuse detected)."""
    rt = db.query(models.RefreshToken).filter(
        models.RefreshToken.jti == jti,
        models.RefreshToken.used_at.is_(None)
    ).first()
    if not rt:
        return False
    rt.used_at = datetime.utcnow()
    db.commit()
    return True


def _bump_token_version(db: Session, user: models.User) -> None:
    """Invalidate all refresh tokens by bumping token_version."""
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    db.refresh(user)


@router.post("/register", response_model=schemas.LoginResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register a new family with admin user.
    Creates Family + Admin User in one call.
    """
    existing_user = db.query(models.User).filter(
        models.User.email == user_data.email,
        models.User.deleted_at.is_(None)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create family
    db_family = models.Family(
        name=user_data.family_name,
        base_currency=user_data.base_currency or "INR"
    )
    db.add(db_family)
    db.flush()

    # Create admin user (activated=True, password_required=False since they set it now)
    hashed_password = get_password_hash(user_data.password)
    db_user = models.User(
        family_id=db_family.id,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        password_hash=hashed_password,
        role=models.Role.ADMIN,
        activated=True,
        password_required=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    db.refresh(db_family)

    access_token, refresh_token = _issue_token_pair(db, db_user)

    return schemas.LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(db_user),
        family=schemas.FamilyResponse.model_validate(db_family)
    )


@router.post("/login", response_model=schemas.LoginResponse)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login and get access + refresh token pair."""
    user = db.query(models.User).filter(
        models.User.email == login_data.email,
        models.User.deleted_at.is_(None)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Block new members who haven't set their password yet
    if user.password_required or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must set your password first using the activation token"
        )

    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    access_token, refresh_token = _issue_token_pair(db, user)

    # Eagerly load family for response
    db.refresh(user)
    family = db.query(models.Family).filter(models.Family.id == user.family_id).first()

    return schemas.LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(user),
        family=schemas.FamilyResponse.model_validate(family)
    )


@router.post("/refresh", response_model=schemas.LoginResponse)
def refresh_token(token_data: schemas.TokenRefresh, db: Session = Depends(get_db)):
    """Rotate refresh token (with reuse detection)."""
    payload = decode_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = payload.get("sub")
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.active == True,
        models.User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    token_version = payload.get("v", 0)
    if token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been invalidated"
        )

    jti = payload.get("jti")
    if not jti or not _consume_refresh_token(db, jti):
        # Token reuse detected — invalidate ALL tokens for this user
        _bump_token_version(db, user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. All sessions have been invalidated."
        )

    access_token, refresh_token_str = _issue_token_pair(db, user)
    family = db.query(models.Family).filter(models.Family.id == user.family_id).first()

    return schemas.LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(user),
        family=schemas.FamilyResponse.model_validate(family)
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Get current authenticated user."""
    return schemas.UserResponse.model_validate(current_user)


@router.post("/verify-activation-token", response_model=schemas.ActivationTokenVerification)
def verify_activation_token(token: str, db: Session = Depends(get_db)):
    """Verify if an activation token is valid (exists, not expired, not used)."""
    db_token = db.query(models.ActivationToken).filter(
        models.ActivationToken.token == token,
        models.ActivationToken.used_at.is_(None)
    ).first()

    if not db_token or db_token.expires_at < datetime.utcnow():
        return schemas.ActivationTokenVerification(valid=False)

    user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    return schemas.ActivationTokenVerification(
        valid=True,
        expires_at=db_token.expires_at,
        user_email=user.email if user else None
    )


@router.post("/set-password", response_model=schemas.LoginResponse)
def set_password(password_data: schemas.SetPasswordRequest, db: Session = Depends(get_db)):
    """Set password using activation token (for new members invited by admin)."""
    db_token = db.query(models.ActivationToken).filter(
        models.ActivationToken.token == password_data.activation_token,
        models.ActivationToken.used_at.is_(None)
    ).first()

    if not db_token or db_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired activation token"
        )

    user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )

    # Set password and activate account
    user.password_hash = get_password_hash(password_data.password)
    user.password_required = False
    user.activated = True

    # Mark token as used
    db_token.used_at = datetime.utcnow()

    # Invalidate any prior refresh tokens
    _bump_token_version(db, user)
    db.commit()
    db.refresh(user)

    access_token, refresh_token = _issue_token_pair(db, user)
    family = db.query(models.Family).filter(models.Family.id == user.family_id).first()

    return schemas.LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(user),
        family=schemas.FamilyResponse.model_validate(family)
    )

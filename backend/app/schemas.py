from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from app.models import AssetType, Role, PrivacyLevel

# Family schemas
class FamilyBase(BaseModel):
    name: str
    base_currency: str = "INR"
    privacy_level: PrivacyLevel = PrivacyLevel.FAMILY

class FamilyCreate(BaseModel):
    name: str
    base_currency: str = "INR"

class FamilyUpdate(BaseModel):
    name: Optional[str] = None
    base_currency: Optional[str] = None
    privacy_level: Optional[PrivacyLevel] = None

class FamilyResponse(FamilyBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# User schemas
class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr

class UserCreate(UserBase):
    """Used for family registration — creates family + admin user in one call."""
    password: str = Field(..., min_length=8)
    family_name: str
    base_currency: Optional[str] = "INR"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: UUID
    family_id: UUID
    role: Role
    active: bool
    activated: bool
    password_required: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[Role] = None
    active: Optional[bool] = None

# Member creation (admin creates members with activation token flow)
class MemberCreateRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: Role = Role.MEMBER

class MemberInviteInformation(BaseModel):
    user_id: UUID
    email: str
    first_name: str
    last_name: str
    role: Role
    activation_token: str
    activation_expires_at: datetime

    class Config:
        from_attributes = True

class SetPasswordRequest(BaseModel):
    activation_token: str
    password: str = Field(..., min_length=8)

class PasswordResetTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    user_email: str

    class Config:
        from_attributes = True

class ActivationTokenVerification(BaseModel):
    valid: bool
    expires_at: Optional[datetime] = None
    user_email: Optional[str] = None

# Auth token response (access + refresh + user + family for KuberOne context)
class TokenRefresh(BaseModel):
    refresh_token: str

class LoginResponse(BaseModel):
    """Auth response: includes refresh_token and family (KuberOne needs family context for UI)."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    family: FamilyResponse

# Account schemas
class AccountBase(BaseModel):
    name: str
    currency: str = "INR"
    asset_types: List[str]

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    asset_types: Optional[List[str]] = None
    # currency intentionally excluded — immutable after creation

class AccountReorderItem(BaseModel):
    id: UUID
    sort_order: int

class AccountResponse(AccountBase):
    id: UUID
    family_id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AccountSummary(AccountResponse):
    invested_amount: Decimal
    current_value: Decimal
    profit_loss: Decimal
    profit_loss_percentage: Decimal
    holdings_count: int
    user_first_name: Optional[str] = None

# Holding schemas
class HoldingCreate(BaseModel):
    account_id: UUID
    symbol: str
    name: str
    quantity: Decimal
    avg_buy_price: Decimal
    asset_type: AssetType
    is_draft: bool = False

class HoldingUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    quantity: Optional[Decimal] = None
    avg_buy_price: Optional[Decimal] = None
    asset_type: Optional[AssetType] = None
    is_draft: Optional[bool] = None

class HoldingResponse(BaseModel):
    id: UUID
    account_id: UUID
    symbol: str
    name: str
    quantity: Decimal
    avg_buy_price: Decimal
    asset_type: AssetType
    is_draft: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Market data schemas
class MarketPrice(BaseModel):
    symbol: str
    current_price: Optional[Decimal]
    name: Optional[str]
    day_change: Optional[Decimal] = None
    day_change_pct: Optional[Decimal] = None
    error: Optional[str] = None

class MarketQuote(BaseModel):
    symbol: str
    name: Optional[str]
    current_price: Optional[Decimal]
    currency: Optional[str]
    error: Optional[str] = None

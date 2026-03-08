import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Numeric, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base
import enum

# Enums matching
class Role(enum.Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"

class PrivacyLevel(enum.Enum):
    PRIVATE = "PRIVATE"
    SHARED = "SHARED"
    FAMILY = "FAMILY"

# Investment-specific enums
class AssetType(enum.Enum):
    STOCK = "STOCK"
    MUTUAL_FUND = "MUTUAL_FUND"
    ETF = "ETF"
    REIT = "REIT"
    BOND = "BOND"
    GOLD = "GOLD"
    SILVER = "SILVER"
    CRYPTO = "CRYPTO"

# Family Model
class Family(Base):
    __tablename__ = "families"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    base_currency = Column(String(3), default="INR")
    privacy_level = Column(SQLEnum(PrivacyLevel), default=PrivacyLevel.FAMILY)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    users = relationship("User", back_populates="family")
    accounts = relationship("Account", back_populates="family")

# User Model
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable until member sets password
    role = Column(SQLEnum(Role), default=Role.MEMBER)
    token_version = Column(Integer, default=0, nullable=False)  # Bumped on logout/password reset
    active = Column(Boolean, default=True)
    activated = Column(Boolean, default=False)   # True after user sets their password
    password_required = Column(Boolean, default=True)  # True for new members who haven't set password
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    family = relationship("Family", back_populates="users")
    accounts = relationship("Account", back_populates="user")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

# Account Model (investment-specific)
class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    asset_types = Column(ARRAY(String), nullable=False)  # ['STOCK', 'MUTUAL_FUND', etc.]
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="accounts")
    user = relationship("User", back_populates="accounts")
    holdings = relationship("Holding", back_populates="account", cascade="all, delete-orphan")

# Holding Model
class Holding(Base):
    __tablename__ = "holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    quantity = Column(Numeric(15, 4), nullable=False)
    avg_buy_price = Column(Numeric(15, 2), nullable=False)
    asset_type = Column(SQLEnum(AssetType), nullable=False)
    is_draft = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("Account", back_populates="holdings")

# Refresh Token
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti = Column(String(36), unique=True, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_version = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Activation Token (for member invitation flow)
class ActivationToken(Base):
    __tablename__ = "activation_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

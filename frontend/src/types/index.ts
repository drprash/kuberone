export enum AssetType {
  STOCK = "STOCK",
  MUTUAL_FUND = "MUTUAL_FUND",
  ETF = "ETF",
  REIT = "REIT",
  BOND = "BOND",
  GOLD = "GOLD",
  SILVER = "SILVER",
  CRYPTO = "CRYPTO",
}


export enum Role {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export enum PrivacyLevel {
  PRIVATE = "PRIVATE",
  SHARED = "SHARED",
  FAMILY = "FAMILY",
}

// Family
export interface Family {
  id: string;
  name: string;
  base_currency: string;
  privacy_level: PrivacyLevel;
  created_at: string;
}

// User (includes activated + password_required)
export interface User {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  active: boolean;
  activated: boolean;
  password_required: boolean;
  created_at: string;
}

// Account
export interface Account {
  id: string;
  family_id: string;
  user_id: string;
  name: string;
  currency: string;
  asset_types: string[];
  created_at: string;
  updated_at: string;
}

export interface AccountSummary extends Account {
  invested_amount: number;
  current_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
  holdings_count: number;
  user_first_name?: string;
}

// Holding
export interface Holding {
  id: string;
  account_id: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  asset_type: AssetType;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface HoldingWithMarketData extends Holding {
  current_price?: number;
  current_value?: number;
  profit_loss?: number;
  profit_loss_percentage?: number;
  day_change?: number | null;
  day_change_pct?: number | null;
}

// Market
export interface MarketQuote {
  symbol: string;
  name?: string;
  current_price?: number;
  currency?: string;
  error?: string;
}

// Auth: includes refresh_token
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  family_name: string;
  base_currency?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  family: Family;
}

export interface SetPasswordRequest {
  activation_token: string;
  password: string;
}

export interface MemberCreateRequest {
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

export interface MemberInviteInformation {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  activation_token: string;
  activation_expires_at: string;
}

// Family Requests
export interface FamilyUpdateRequest {
  name?: string;
  base_currency?: string;
  privacy_level?: PrivacyLevel;
}

// Password reset token (admin)
export interface PasswordResetToken {
  token: string;
  expires_at: string;
  user_email: string;
}

// Market price (batch response shape)
export interface MarketPrice {
  symbol: string;
  current_price?: number;
  name?: string;
  day_change?: number | null;
  day_change_pct?: number | null;
  error?: string;
}

// Account Requests
export interface AccountCreateRequest {
  name: string;
  currency: string;
  asset_types: string[];
}

export interface AccountUpdateRequest {
  name?: string;
  asset_types?: string[];
}

// Holding Requests
export interface HoldingCreateRequest {
  account_id: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  asset_type: AssetType;
  is_draft?: boolean;
}

export interface HoldingUpdateRequest {
  symbol?: string;
  name?: string;
  quantity?: number;
  avg_buy_price?: number;
  asset_type?: AssetType;
  is_draft?: boolean;
}

// Backup & Restore
export interface BackupHolding {
  symbol: string;
  name: string;
  quantity: string;
  avg_buy_price: string;
  asset_type: string;
  is_draft: boolean;
}

export interface BackupAccount {
  id: string;
  name: string;
  currency: string;
  asset_types: string[];
  user_id: string;
  user_email: string;
  user_first_name: string;
  holdings: BackupHolding[];
}

export interface BackupData {
  version: string;
  app: string;
  exported_at: string;
  family_name: string;
  accounts: BackupAccount[];
}

export interface RestoreResult {
  accounts_created: number;
  accounts_matched: number;
  holdings_created: number;
  holdings_failed: number;
}

// Summary
export interface PortfolioSummary {
  total_investment: number;
  current_value: number;
  total_profit_loss: number;
  total_profit_loss_percentage: number;
  holdings_count: number;
}

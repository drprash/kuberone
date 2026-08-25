// Supported currencies (matching ShreeOne FinancialEngine.DEFAULT_RATES)
export const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'THB', name: 'Thai Baht' },
];

// Rates: 1 unit of currency = X USD (matching ShreeOne FinancialEngine.DEFAULT_RATES)
const USD_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.1,
  GBP: 1.28,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.67,
  JPY: 0.0067,
  AED: 0.272,
  THB: 0.028,
};

/**
 * Get exchange rate to convert `from` currency amount to `to` currency.
 * Returns a multiplier: result = amount_in_from * getExchangeRate(from, to)
 */
export function getExchangeRate(from: string, to: string): number {
  if (from === to) return 1;
  const fromRate = USD_RATES[from] ?? 1;
  const toRate = USD_RATES[to] ?? 1;
  if (toRate === 0 || fromRate === 0) return 1;
  return fromRate / toRate;
}

/**
 * Format an amount with 3-letter ISO currency code (never symbols).
 * e.g. formatAmount(1234567.89, 'INR') => "1,23,45,68 INR"
 */
export function formatAmount(amount: number, currency: string, decimals = 0): string {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatted} ${currency}`;
}

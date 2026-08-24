"""Server-side currency conversion for portfolio snapshot capture.

Mirrors frontend/src/lib/currencies.ts USD_RATES exactly — the two must be kept
in sync by hand (no shared package between frontend/backend in this repo).
"""

# Rates: 1 unit of currency = X USD
USD_RATES: dict[str, float] = {
    "USD": 1.0,
    "EUR": 1.1,
    "GBP": 1.28,
    "INR": 0.012,
    "CAD": 0.74,
    "AUD": 0.67,
    "JPY": 0.0067,
    "AED": 0.272,
    "THB": 0.028,
}


def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    """Multiplier such that amount_in_to = amount_in_from * get_exchange_rate(from, to)."""
    if from_currency == to_currency:
        return 1.0
    from_rate = USD_RATES.get(from_currency, 1.0)
    to_rate = USD_RATES.get(to_currency, 1.0)
    if to_rate == 0 or from_rate == 0:
        return 1.0
    return from_rate / to_rate

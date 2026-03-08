from fastapi import APIRouter
from typing import Dict
from concurrent.futures import ThreadPoolExecutor
from app import schemas
import yfinance as yf
from decimal import Decimal

router = APIRouter(prefix="/market", tags=["market"])


def _fetch_price(symbol: str) -> schemas.MarketPrice:
    """Fetch price for a single symbol — reused by both single and batch endpoints."""
    try:
        ticker = yf.Ticker(symbol)
        current_price = None
        name = None
        day_change = None
        day_change_pct = None

        try:
            hist = ticker.history(period="1d")
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                open_price = float(hist['Open'].iloc[0])
                if open_price != 0:
                    day_change = current_price - open_price
                    day_change_pct = (day_change / open_price) * 100
        except Exception as e:
            print(f"History failed for {symbol}: {e}")

        if current_price is None:
            try:
                if hasattr(ticker.fast_info, 'lastPrice'):
                    current_price = ticker.fast_info.lastPrice
                elif hasattr(ticker.fast_info, 'regularMarketPrice'):
                    current_price = ticker.fast_info.regularMarketPrice
            except Exception as e:
                print(f"Fast_info failed for {symbol}: {e}")

        if day_change is None:
            try:
                if hasattr(ticker.fast_info, 'regularMarketChange'):
                    val = ticker.fast_info.regularMarketChange
                    if val is not None:
                        day_change = float(val)
                if hasattr(ticker.fast_info, 'regularMarketChangePercent'):
                    val = ticker.fast_info.regularMarketChangePercent
                    if val is not None:
                        day_change_pct = float(val) * 100
            except Exception as e:
                print(f"Fast_info day change failed for {symbol}: {e}")

        if current_price is None:
            try:
                info = ticker.info
                if info:
                    current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
                    name = info.get('longName') or info.get('shortName')
            except Exception as e:
                print(f"Info failed for {symbol}: {e}")

        if current_price is None or current_price == 0:
            return schemas.MarketPrice(
                symbol=symbol,
                current_price=None,
                error=f"Failed to fetch price for {symbol}. Verify symbol (e.g. AAPL for US, RELIANCE.NS for India)"
            )

        return schemas.MarketPrice(
            symbol=symbol,
            current_price=Decimal(str(current_price)),
            name=name,
            day_change=Decimal(str(round(day_change, 4))) if day_change is not None else None,
            day_change_pct=Decimal(str(round(day_change_pct, 4))) if day_change_pct is not None else None,
        )
    except Exception as e:
        print(f"Full price fetch failed for {symbol}: {e}")
        return schemas.MarketPrice(symbol=symbol, current_price=None, error=str(e))


@router.get("/price/{symbol}", response_model=schemas.MarketPrice)
def get_market_price(symbol: str):
    """Get current market price for a symbol using Yahoo Finance"""
    return _fetch_price(symbol.upper())


@router.get("/prices", response_model=Dict[str, schemas.MarketPrice])
def get_batch_prices(symbols: str):
    """Get prices for multiple comma-separated symbols concurrently (max 30)."""
    symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()][:30]
    if not symbol_list:
        return {}
    with ThreadPoolExecutor(max_workers=min(len(symbol_list), 10)) as executor:
        results = list(executor.map(_fetch_price, symbol_list))
    return {r.symbol: r for r in results}

@router.get("/quote/{symbol}", response_model=schemas.MarketQuote)
def get_market_quote(symbol: str):
    """Get detailed market quote for a symbol using Yahoo Finance"""
    try:
        ticker = yf.Ticker(symbol.upper())
        current_price = None
        name = None
        currency = None

        # Method 1: Try history first (most reliable)
        try:
            hist = ticker.history(period="1d")
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"History method failed: {e}")

        # Method 2: Try fast_info (properties, not dict)
        if current_price is None:
            try:
                # fast_info is an object with properties, not a dict
                if hasattr(ticker.fast_info, 'lastPrice'):
                    current_price = ticker.fast_info.lastPrice
                elif hasattr(ticker.fast_info, 'regularMarketPrice'):
                    current_price = ticker.fast_info.regularMarketPrice
            except Exception as e:
                print(f"Fast_info method failed: {e}")

        # Method 3: Try info dict (slowest but has metadata)
        try:
            info = ticker.info
            if info:
                name = info.get('longName') or info.get('shortName') or info.get('symbol')
                currency = info.get('currency') or info.get('financialCurrency')
                if current_price is None:
                    current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
        except Exception as e:
            print(f"Info method failed: {e}")

        if current_price is None or current_price == 0:
            return schemas.MarketQuote(
                symbol=symbol.upper(),
                name=name,
                current_price=None,
                currency=currency,
                error=f"Failed to fetch quote for symbol {symbol.upper()}. Verify symbol format (e.g., AAPL for US, RELIANCE.NS for India)"
            )

        return schemas.MarketQuote(
            symbol=symbol.upper(),
            name=name or symbol.upper(),
            current_price=Decimal(str(current_price)),
            currency=currency
        )
    except Exception as e:
        print(f"Full quote fetch failed: {e}")
        return schemas.MarketQuote(
            symbol=symbol.upper(),
            name=None,
            current_price=None,
            currency=None,
            error=f"Failed to fetch quote: {str(e)}"
        )

#!/usr/bin/env python3
"""
Test script to verify yfinance is working correctly
Run this inside the Docker container to test:
docker exec -it kuberone-backend-1 python test_yfinance.py
"""

import yfinance as yf

def test_symbol(symbol):
    print(f"\n{'='*60}")
    print(f"Testing symbol: {symbol}")
    print(f"{'='*60}")

    try:
        ticker = yf.Ticker(symbol)
        current_price = None
        name = None

        # Method 1: History
        print("\n[Method 1] Trying history...")
        try:
            hist = ticker.history(period="1d")
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                print(f"✓ History worked! Price: {current_price}")
            else:
                print("✗ History returned empty dataframe")
        except Exception as e:
            print(f"✗ History failed: {e}")

        # Method 2: fast_info
        if current_price is None:
            print("\n[Method 2] Trying fast_info...")
            try:
                if hasattr(ticker.fast_info, 'lastPrice'):
                    current_price = ticker.fast_info.lastPrice
                    print(f"✓ fast_info.lastPrice worked! Price: {current_price}")
                elif hasattr(ticker.fast_info, 'regularMarketPrice'):
                    current_price = ticker.fast_info.regularMarketPrice
                    print(f"✓ fast_info.regularMarketPrice worked! Price: {current_price}")
                else:
                    print("✗ fast_info has no price attributes")
            except Exception as e:
                print(f"✗ fast_info failed: {e}")

        # Method 3: info
        print("\n[Method 3] Trying info...")
        try:
            info = ticker.info
            if info:
                name = info.get('longName') or info.get('shortName')
                print(f"  Name: {name}")
                if current_price is None:
                    current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
                    if current_price:
                        print(f"✓ info dict worked! Price: {current_price}")
                    else:
                        print("✗ info dict has no price fields")
        except Exception as e:
            print(f"✗ info failed: {e}")

        print(f"\n{'='*60}")
        if current_price:
            print(f"✓ SUCCESS: {symbol} = {current_price} ({name or 'Unknown'})")
        else:
            print(f"✗ FAILED: Could not fetch price for {symbol}")
        print(f"{'='*60}")

        return current_price is not None

    except Exception as e:
        print(f"\n✗ FATAL ERROR: {e}")
        return False

if __name__ == "__main__":
    test_symbols = [
        "AAPL",           # US stock
        "RELIANCE.NS",    # Indian stock
        "TCS.NS",         # Indian stock
        "INFY.NS",        # Indian stock
        "BTC-USD",        # Crypto
        "MSFT",           # US stock
        "GOOGL",          # US stock
    ]

    print("\n" + "="*60)
    print("YFINANCE TEST SUITE")
    print("="*60)

    results = {}
    for symbol in test_symbols:
        results[symbol] = test_symbol(symbol)

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for symbol, success in results.items():
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {symbol}")

    total = len(results)
    passed = sum(results.values())
    print(f"\nPassed: {passed}/{total}")

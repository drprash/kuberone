import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { holdingsAPI, marketAPI, accountsAPI, portfolioAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { usePriceStore } from '../store/priceStore';
import { getExchangeRate, formatAmount } from '../lib/currencies';
import type { HoldingWithMarketData, PortfolioSummary, AccountSummary, PortfolioSnapshot } from '../types';
import PortfolioSummaryComponent from './PortfolioSummary';
import PortfolioTrendline from './PortfolioTrendline';
import AddHolding from './AddHolding';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function Dashboard() {
  const [holdings, setHoldings] = useState<HoldingWithMarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingWithMarketData | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const navigate = useNavigate();
  const family = useAuthStore((state) => state.family);
  const baseCurrency = family?.base_currency || 'INR';
  const priceStore = usePriceStore();

  const applyPrices = (
    holdingsData: HoldingWithMarketData[],
    priceMap: Record<string, any>,
    accountCurrencyMap: Record<string, string>
  ): HoldingWithMarketData[] =>
    holdingsData.map((h) => {
      const priceData = priceMap[h.symbol.toUpperCase()] || {};
      const priceUnavailable = priceData.current_price == null || !!priceData.error;
      if (priceUnavailable) {
        // Don't value a failed fetch at zero — that reads as a fabricated total loss.
        // Leave price fields undefined so this holding drops out of totals/gainer-loser lists.
        return {
          ...h,
          current_price: undefined,
          current_value: undefined,
          profit_loss: undefined,
          profit_loss_percentage: undefined,
          day_change: null,
          day_change_pct: null,
          price_unavailable: true,
        };
      }
      const accountCurrency = accountCurrencyMap[h.account_id] || baseCurrency;
      // avg_buy_price is entered by the user in the account's currency, but the live
      // price comes back in whatever currency the security itself trades in (e.g. AAPL
      // quotes in USD even inside an INR account) — each side needs its own FX rate.
      const priceCurrency = priceData.currency || accountCurrency;
      const fxAccount = getExchangeRate(accountCurrency, baseCurrency);
      const fxPrice = getExchangeRate(priceCurrency, baseCurrency);
      const current_price = Number(priceData.current_price);
      const quantity = Number(h.quantity);
      const current_value = current_price * quantity * fxPrice;
      const investment = Number(h.avg_buy_price) * quantity * fxAccount;
      const profit_loss = current_value - investment;
      const profit_loss_percentage = investment > 0 ? (profit_loss / investment) * 100 : 0;
      return {
        ...h,
        current_price,
        current_value,
        profit_loss,
        profit_loss_percentage,
        // Converted to base currency here so downstream (daily impact) doesn't need
        // to re-derive the FX rate.
        day_change: priceData.day_change != null ? Number(priceData.day_change) * fxPrice : null,
        day_change_pct: priceData.day_change_pct != null ? Number(priceData.day_change_pct) : null,
        price_unavailable: false,
        price_currency: priceCurrency,
      };
    });

  const fetchHoldings = async (force = false) => {
    setLoading(true);
    try {
      const [holdingsData, accountsData] = await Promise.all([
        holdingsAPI.getAll(),
        accountsAPI.getAll(),
      ]);

      const accountCurrencyMap: Record<string, string> = {};
      for (const acc of accountsData as AccountSummary[]) {
        accountCurrencyMap[acc.id] = acc.currency || baseCurrency;
      }

      if (!holdingsData.length) {
        setLoading(false);
        return;
      }

      const symbols = [...new Set(holdingsData.map((h) => h.symbol.toUpperCase()))];

      if (!force && priceStore.isCacheFresh(symbols)) {
        setHoldings(applyPrices(holdingsData as HoldingWithMarketData[], priceStore.priceMap, accountCurrencyMap));
        setLoading(false);
        return;
      }

      // Show holdings immediately with zero prices while we fetch
      setHoldings(holdingsData.map((h) => ({
        ...h,
        current_price: 0,
        current_value: 0,
        profit_loss: 0,
        profit_loss_percentage: 0,
        day_change: null,
        day_change_pct: null,
      })));
      setLoading(false);
      setPricesLoading(true);

      const priceMap = await marketAPI.getBatchPrices(symbols.join(','));
      priceStore.setPrices(priceMap);

      setHoldings(applyPrices(holdingsData as HoldingWithMarketData[], priceMap, accountCurrencyMap));
    } catch (error: any) {
      toast.error('Failed to fetch holdings');
      setLoading(false);
    } finally {
      setPricesLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await portfolioAPI.getHistory(30);
      setHistory(data);
    } catch {
      // Non-critical: the trendline just falls back to its "building history" state.
    }
  };

  useEffect(() => {
    fetchHoldings();
    fetchHistory();
  }, []);

  const calculateSummary = (): PortfolioSummary => {
    // Holdings with no live price are excluded entirely (not valued at zero) — otherwise
    // their full cost basis reads as a fabricated 100% loss.
    const priced = holdings.filter((h) => !h.price_unavailable);
    const total_investment = priced.reduce(
      (sum, h) => sum + (h.current_value !== undefined && h.profit_loss !== undefined
        ? h.current_value - h.profit_loss
        : Number(h.avg_buy_price) * Number(h.quantity)),
      0
    );
    const current_value = priced.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const total_profit_loss = current_value - total_investment;
    const total_profit_loss_percentage =
      total_investment > 0 ? (total_profit_loss / total_investment) * 100 : 0;

    return {
      total_investment,
      current_value,
      total_profit_loss,
      total_profit_loss_percentage,
      holdings_count: holdings.length,
      unpriced_count: holdings.length - priced.length,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const summary = calculateSummary();

  const topLifetimeGainers = [...holdings]
    .filter(h => (h.profit_loss || 0) > 0)
    .sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0))
    .slice(0, 5);

  const topLifetimeLosers = [...holdings]
    .filter(h => (h.profit_loss || 0) < 0)
    .sort((a, b) => (a.profit_loss || 0) - (b.profit_loss || 0))
    .slice(0, 5);

  const topDailyGainers = [...holdings]
    .filter(h => h.day_change_pct != null && h.day_change_pct > 0)
    .sort((a, b) => (b.day_change_pct ?? 0) - (a.day_change_pct ?? 0))
    .slice(0, 5);

  const topDailyLosers = [...holdings]
    .filter(h => h.day_change_pct != null && h.day_change_pct < 0)
    .sort((a, b) => (a.day_change_pct ?? 0) - (b.day_change_pct ?? 0))
    .slice(0, 5);

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end items-start sm:items-center mb-6">
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {pricesLoading && (
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-400" />
                Fetching prices…
              </span>
            )}
            {!pricesLoading && priceStore.fetchedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Prices from {timeAgo(priceStore.fetchedAt)}
              </span>
            )}
            <button
              onClick={() => fetchHoldings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 btn-press transition-all duration-200 font-medium"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddHolding(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 btn-press transition-all duration-200 font-medium"
            >
              + Add Holding
            </button>
          </div>
        </div>

        <PortfolioSummaryComponent summary={summary} baseCurrency={baseCurrency} />

        {holdings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center mt-6">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No holdings yet</p>
            <button
              onClick={() => setShowAddHolding(true)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              Add your first holding
            </button>
          </div>
        ) : (
          <>
            <PortfolioTrendline
              summary={summary}
              history={history}
              baseCurrency={baseCurrency}
              loading={pricesLoading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 card-hover slide-in">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top 5 Lifetime Gainers</h3>
                {topLifetimeGainers.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No profitable holdings yet</p>
                ) : (
                  <div className="space-y-3">
                    {topLifetimeGainers.map((holding) => (
                      <div key={holding.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                        <div className="min-w-0 mr-2">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{holding.symbol} ({holding.name})</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{holding.asset_type}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-green-600">
                            +{formatAmount(holding.profit_loss || 0, baseCurrency)}
                          </div>
                          <div className="text-xs text-green-600">
                            +{(holding.profit_loss_percentage || 0).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 card-hover slide-in">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top 5 Lifetime Losers</h3>
                {topLifetimeLosers.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No loss-making holdings</p>
                ) : (
                  <div className="space-y-3">
                    {topLifetimeLosers.map((holding) => (
                      <div key={holding.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                        <div className="min-w-0 mr-2">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{holding.symbol} ({holding.name})</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{holding.asset_type}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-red-600">
                            {formatAmount(holding.profit_loss || 0, baseCurrency)}
                          </div>
                          <div className="text-xs text-red-600">
                            {(holding.profit_loss_percentage || 0).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 card-hover slide-in">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top 5 Daily Gainers</h3>
                {topDailyGainers.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No daily gainers yet</p>
                ) : (
                  <div className="space-y-3">
                    {topDailyGainers.map((holding) => {
                      const dailyImpact = (holding.day_change ?? 0) * Number(holding.quantity);
                      return (
                        <div key={holding.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                          <div className="min-w-0 mr-2">
                            <div className="font-medium text-gray-900 dark:text-white truncate">{holding.symbol} ({holding.name})</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{holding.asset_type}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-green-600">
                              +{formatAmount(dailyImpact, baseCurrency)}
                            </div>
                            <div className="text-xs text-green-600">
                              +{(holding.day_change_pct ?? 0).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 card-hover slide-in">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top 5 Daily Losers</h3>
                {topDailyLosers.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No daily losers</p>
                ) : (
                  <div className="space-y-3">
                    {topDailyLosers.map((holding) => {
                      const dailyImpact = (holding.day_change ?? 0) * Number(holding.quantity);
                      return (
                        <div key={holding.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                          <div className="min-w-0 mr-2">
                            <div className="font-medium text-gray-900 dark:text-white truncate">{holding.symbol} ({holding.name})</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{holding.asset_type}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-red-600">
                              {formatAmount(dailyImpact, baseCurrency)}
                            </div>
                            <div className="text-xs text-red-600">
                              {(holding.day_change_pct ?? 0).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/holdings')}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View All Holdings →
          </button>
        </div>
      </div>

      {showAddHolding && (
        <AddHolding
          onClose={() => setShowAddHolding(false)}
          onSuccess={() => { setShowAddHolding(false); fetchHoldings(true); }}
        />
      )}

      {editingHolding && (
        <AddHolding
          holding={editingHolding}
          onClose={() => setEditingHolding(null)}
          onSuccess={() => { setEditingHolding(null); fetchHoldings(true); }}
        />
      )}
    </div>
  );
}

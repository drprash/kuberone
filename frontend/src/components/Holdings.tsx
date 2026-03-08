import React, { useState, useEffect } from 'react';
import { holdingsAPI, accountsAPI, marketAPI } from '../lib/api';
import { HoldingWithMarketData, Holding, AccountSummary } from '../types';
import { formatAmount } from '../lib/currencies';
import toast from 'react-hot-toast';
import AddHolding from './AddHolding';
import ImportHoldings from './ImportHoldings';
import { Edit2, Trash2, AlertTriangle } from 'lucide-react';

/** Always "Account Name - User First Name (Currency)" */
function accountDisplayName(account: AccountSummary): string {
  const currency = account.currency || 'INR';
  return account.user_first_name
    ? `${account.name} - ${account.user_first_name} (${currency})`
    : `${account.name} (${currency})`;
}

export default function Holdings() {
  const [holdings, setHoldings] = useState<HoldingWithMarketData[]>([]);
  const [draftHoldings, setDraftHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingWithMarketData | Holding | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedAccountId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsData, allHoldingsData] = await Promise.all([
        accountsAPI.getAll(),
        holdingsAPI.getAll(selectedAccountId || undefined, true),
      ]);

      setAccounts(accountsData);

      const accountCurrencyMap: Record<string, string> = {};
      for (const acc of accountsData) {
        accountCurrencyMap[acc.id] = acc.currency || 'INR';
      }

      const drafts = allHoldingsData.filter((h) => h.is_draft);
      const nonDrafts = allHoldingsData.filter((h) => !h.is_draft);
      setDraftHoldings(drafts);

      if (!nonDrafts.length) {
        setHoldings([]);
        setLoading(false);
        return;
      }

      // Batch fetch all prices at once
      const symbols = [...new Set(nonDrafts.map((h) => h.symbol))].join(',');
      const priceMap = await marketAPI.getBatchPrices(symbols);

      const holdingsWithPrices = nonDrafts.map((holding) => {
        const priceData = priceMap[holding.symbol.toUpperCase()] || {};
        const currentPrice = Number(priceData.current_price) || 0;
        const currentValue = Number(holding.quantity) * currentPrice;
        const investedValue = Number(holding.quantity) * Number(holding.avg_buy_price);
        const profitLoss = currentValue - investedValue;
        const profitLossPercentage = investedValue > 0 ? (profitLoss / investedValue) * 100 : 0;
        return {
          ...holding,
          current_price: currentPrice,
          current_value: currentValue,
          profit_loss: profitLoss,
          profit_loss_percentage: profitLossPercentage,
        };
      });

      setHoldings(holdingsWithPrices);
    } catch {
      toast.error('Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holding?')) return;
    try {
      await holdingsAPI.delete(id);
      toast.success('Holding deleted successfully');
      loadData();
    } catch {
      toast.error('Failed to delete holding');
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Delete this draft holding?')) return;
    try {
      await holdingsAPI.delete(id);
      toast.success('Draft deleted');
      loadData();
    } catch {
      toast.error('Failed to delete draft');
    }
  };

  // Get currency for a holding from its account
  const holdingCurrency = (accountId: string): string => {
    return accounts.find((a) => a.id === accountId)?.currency || 'INR';
  };

  const formatPercentage = (value: number) =>
    value >= 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`;

  const formatNumber = (value: number) => value.toFixed(2);

  const formatName = (name: string) =>
    name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Holdings</h2>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountDisplayName(account)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="border border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 px-4 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 font-medium text-sm"
            >
              Import CSV / Excel
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 btn-press transition-all duration-200 font-medium"
            >
              + Add Holding
            </button>
          </div>
        </div>

        {/* Draft Holdings Section */}
        {draftHoldings.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {draftHoldings.length} Draft Holding{draftHoldings.length > 1 ? 's' : ''} — Pending Completion
              </h3>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg overflow-x-auto">
              <table className="min-w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/30">
                    <th className="px-4 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Symbol</th>
                    <th className="px-4 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Asset Type</th>
                    <th className="px-4 py-2 text-right font-medium text-amber-800 dark:text-amber-300">Quantity</th>
                    <th className="px-4 py-2 text-right font-medium text-amber-800 dark:text-amber-300">Avg Buy Price</th>
                    <th className="px-4 py-2 text-center font-medium text-amber-800 dark:text-amber-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-amber-800">
                  {draftHoldings.map((draft) => {
                    const ccy = holdingCurrency(draft.account_id);
                    return (
                      <tr key={draft.id} className="hover:bg-amber-100/50 dark:hover:bg-amber-900/20">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {draft.symbol}
                          <span className="ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
                            Draft
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatName(draft.name)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{draft.asset_type}</td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatNumber(Number(draft.quantity))}</td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatAmount(Number(draft.avg_buy_price), ccy, 2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => setEditingHolding(draft)} className="text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400" title="Complete Draft">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteDraft(draft.id)} className="text-red-600 hover:text-red-800 dark:hover:text-red-400" title="Delete Draft">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-amber-100/50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Click the edit icon to complete each draft and add it to your portfolio.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Holdings Table */}
        {holdings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No holdings yet</p>
            <button onClick={() => setShowAddModal(true)} className="text-indigo-600 hover:text-indigo-800">
              Add your first holding
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="min-w-full min-w-[800px] divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Avg Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invested</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">P&amp;L</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Return %</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {holdings.map((holding) => {
                  const ccy = holdingCurrency(holding.account_id);
                  const invested = Number(holding.quantity) * Number(holding.avg_buy_price);
                  const current = Number(holding.current_value) || 0;
                  const pl = Number(holding.profit_loss) || 0;
                  const plPercent = Number(holding.profit_loss_percentage) || 0;

                  return (
                    <tr key={holding.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-white">{holding.symbol}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatName(holding.name)}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{holding.asset_type}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">{formatNumber(Number(holding.quantity))}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">{formatAmount(Number(holding.avg_buy_price), ccy, 2)}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">{formatAmount(Number(holding.current_price) || 0, ccy, 2)}</td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatAmount(invested, ccy)}</td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatAmount(current, ccy)}</td>
                      <td className={`py-3 px-4 text-right text-sm font-semibold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(pl, ccy)}
                      </td>
                      <td className={`py-3 px-4 text-right text-sm font-semibold ${plPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(plPercent)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setEditingHolding(holding)} className="text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400" title="Edit Holding">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(holding.id)} className="text-red-600 hover:text-red-800 dark:hover:text-red-400" title="Delete Holding">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddHolding
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadData(); }}
        />
      )}

      {showImportModal && (
        <ImportHoldings
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); loadData(); }}
        />
      )}

      {editingHolding && (
        <AddHolding
          holding={editingHolding}
          onClose={() => setEditingHolding(null)}
          onSuccess={() => { setEditingHolding(null); loadData(); }}
        />
      )}
    </div>
  );
}

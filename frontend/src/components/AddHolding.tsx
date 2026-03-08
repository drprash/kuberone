import React, { useState, useEffect } from 'react';
import { holdingsAPI, marketAPI, accountsAPI } from '../lib/api';
import { AssetType, Holding, AccountSummary } from '../types';
import toast from 'react-hot-toast';
import { X, Search, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

interface AddHoldingProps {
  holding?: Holding | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddHolding({ holding, onClose, onSuccess }: AddHoldingProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isEditing = !!holding;
  const isDraft = holding?.is_draft ?? false;

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgBuyPrice, setAvgBuyPrice] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.STOCK);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (holding) {
      setAccountId(holding.account_id);
      setSymbol(holding.symbol);
      setName(holding.name);
      setQuantity(holding.quantity.toString());
      setAvgBuyPrice(holding.avg_buy_price.toString());
      setAssetType(holding.asset_type);
    }
  }, [holding]);

  const loadAccounts = async () => {
    try {
      const data = await accountsAPI.getAll();
      setAccounts(data);
      if (data.length > 0 && !holding) {
        setAccountId(data[0].id);
      }
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const getAllowedAssetTypes = () => {
    const selectedAccount = accounts.find((acc) => acc.id === accountId);
    if (!selectedAccount) return Object.values(AssetType);
    return Object.values(AssetType).filter((type) =>
      selectedAccount.asset_types.includes(type)
    );
  };

  const getAccountDisplayName = (account: AccountSummary) => {
    const currency = account.currency || 'INR';
    return account.user_first_name
      ? `${account.name} - ${account.user_first_name} (${currency})`
      : `${account.name} (${currency})`;
  };

  const handleLookup = async () => {
    if (!symbol.trim()) {
      toast.error('Please enter a symbol');
      return;
    }
    setSearching(true);
    try {
      const quote = await marketAPI.getQuote(symbol.toUpperCase());
      if (quote.error) {
        toast.error(quote.error);
      } else {
        if (quote.name) setName(quote.name);
        if (quote.current_price && !avgBuyPrice.trim()) setAvgBuyPrice(quote.current_price.toString());
        toast.success('Symbol found!');
      }
    } catch {
      toast.error('Failed to fetch symbol information');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId) {
      toast.error('Please select an account');
      return;
    }

    setLoading(true);

    try {
      const data = {
        account_id: accountId,
        symbol: symbol.toUpperCase(),
        name,
        quantity: parseFloat(quantity),
        avg_buy_price: parseFloat(avgBuyPrice),
        asset_type: assetType,
      };

      if (isEditing && holding) {
        // When completing a draft, flip is_draft to false
        await holdingsAPI.update(holding.id, { ...data, is_draft: false });
        toast.success(isDraft ? 'Draft completed and added to portfolio!' : 'Holding updated successfully!');
      } else {
        await holdingsAPI.create(data);
        toast.success('Holding added successfully!');
      }
      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'add'} holding`;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = isDraft
    ? 'Complete Draft Holding'
    : isEditing
    ? 'Edit Holding'
    : 'Add New Holding';

  const submitLabel = isDraft
    ? 'Save & Add to Portfolio'
    : isEditing
    ? 'Update Holding'
    : 'Add Holding';

  const submitLoadingLabel = isDraft
    ? 'Saving...'
    : isEditing
    ? 'Updating...'
    : 'Adding...';

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md slide-in">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{modalTitle}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {isDraft && (
          <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Complete all fields below to add this holding to your portfolio.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Account *</label>
            {loadingAccounts ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-red-600 dark:text-red-400">No accounts available. Please create an account first.</div>
            ) : (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                disabled={isEditing}
                className={`${inputCls} disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400`}
              >
                <option value="">Select Account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Symbol *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
                placeholder="AAPL, RELIANCE.NS, etc."
                className={inputCls}
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={searching}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <Search size={16} />
                {searching ? 'Searching...' : 'Lookup'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">For Indian stocks, add .NS (e.g., RELIANCE.NS)</p>
          </div>

          <div>
            <label className={labelCls}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Company/Fund Name"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Quantity *</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                min="0"
                step="0.0001"
                placeholder="10"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Avg Buy Price *</label>
              <input
                type="number"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                required
                min="0"
                step="0.01"
                placeholder="150.00"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Asset Type *</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              required
              disabled={!accountId}
              className={`${inputCls} disabled:bg-gray-100 dark:disabled:bg-gray-700`}
            >
              {getAllowedAssetTypes().map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>
            {accountId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Only asset types allowed in selected account are shown
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 btn-press transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 btn-press transition-all duration-200 font-medium"
            >
              {loading ? submitLoadingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { accountsAPI, holdingsAPI, marketAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { AccountSummary, AccountCreateRequest, AssetType } from '../types';
import { CURRENCIES, formatAmount } from '../lib/currencies';
import toast from 'react-hot-toast';
import { Edit2, Trash2, X, GripVertical, ArrowLeftRight } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

/** Always returns "Account Name - User First Name (Currency)" */
function accountDisplayName(account: AccountSummary): string {
  const currency = account.currency || 'INR';
  const firstName = account.user_first_name;
  return firstName
    ? `${account.name} - ${firstName} (${currency})`
    : `${account.name} (${currency})`;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountSummary | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const family = useAuthStore((state) => state.family);
  const [isReordering, setIsReordering] = useState(false);
  const [orderedAccounts, setOrderedAccounts] = useState<AccountSummary[]>([]);
  const draggedIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await accountsAPI.getAll();

      const accountsWithValues = await Promise.all(
        data.map(async (account) => {
          try {
            const holdings = await holdingsAPI.getAll(account.id);
            let currentValue = 0;
            await Promise.all(
              holdings.map(async (holding) => {
                try {
                  const priceData = await marketAPI.getPrice(holding.symbol);
                  const price = Number(priceData.current_price) || 0;
                  currentValue += price * Number(holding.quantity);
                } catch {
                  // skip on failure
                }
              })
            );
            return {
              ...account,
              current_value: currentValue,
              profit_loss: currentValue - Number(account.invested_amount),
              profit_loss_percentage:
                Number(account.invested_amount) > 0
                  ? ((currentValue - Number(account.invested_amount)) / Number(account.invested_amount)) * 100
                  : 0,
            };
          } catch {
            return account;
          }
        })
      );

      setAccounts(accountsWithValues);
      setOrderedAccounts(accountsWithValues);
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account? All holdings in this account will also be deleted.')) return;
    try {
      await accountsAPI.delete(id);
      toast.success('Account deleted successfully');
      loadAccounts();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete account');
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    draggedIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedIdRef.current || draggedIdRef.current === targetId) return;

    const newOrdered = [...orderedAccounts];
    const dragIdx = newOrdered.findIndex(a => a.id === draggedIdRef.current);
    const targetIdx = newOrdered.findIndex(a => a.id === targetId);
    const [dragged] = newOrdered.splice(dragIdx, 1);
    newOrdered.splice(targetIdx, 0, dragged);
    setOrderedAccounts(newOrdered);

    const reorderItems = newOrdered.map((a, i) => ({ id: a.id, sort_order: i }));
    try {
      await accountsAPI.reorder(reorderItems);
      toast.success('Order saved');
      loadAccounts();
    } catch {
      toast.error('Failed to save order');
      setOrderedAccounts(accounts);
    }
    draggedIdRef.current = null;
  };

  const handleDragEnd = () => { draggedIdRef.current = null; };

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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Accounts</h2>
          <div className="flex gap-2">
            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={() => setIsReordering(!isReordering)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 border btn-press transition-all duration-200 font-medium ${
                  isReordering
                    ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <ArrowLeftRight size={16} />
                {isReordering ? 'Done Reordering' : 'Reorder'}
              </button>
            )}
            {!isReordering && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 btn-press transition-all duration-200 font-medium"
              >
                + Add Account
              </button>
            )}
          </div>
        </div>

        {isReordering && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">Drag accounts to reorder. Changes save automatically.</p>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No accounts yet</p>
            <button onClick={() => setShowAddModal(true)} className="text-indigo-600 hover:text-indigo-800">
              Create your first account
            </button>
          </div>
        ) : isReordering ? (
          <div className="space-y-3">
            {orderedAccounts.map((account) => (
              <div
                key={account.id}
                draggable
                onDragStart={(e) => handleDragStart(e, account.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, account.id)}
                onDragEnd={handleDragEnd}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-move hover:shadow-lg transition-shadow border-2 border-transparent hover:border-indigo-200 dark:hover:border-indigo-700"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="text-gray-400 dark:text-gray-500" size={20} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{accountDisplayName(account)}</h3>
                    <div className="flex items-center space-x-2 mt-1 flex-wrap">
                      {[...account.asset_types].sort((a, b) => {
                        const order = Object.values(AssetType);
                        return order.indexOf(a as AssetType) - order.indexOf(b as AssetType);
                      }).map((type) => (
                        <span key={type} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs rounded">
                          {type.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Holdings</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{account.holdings_count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onUpdate={loadAccounts}
                onEdit={() => setEditingAccount(account)}
                onDelete={() => handleDelete(account.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddAccountModal
          defaultCurrency={family?.base_currency || 'INR'}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadAccounts(); }}
        />
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => { setEditingAccount(null); loadAccounts(); }}
        />
      )}
    </div>
  );
}

function AccountCard({
  account,
  onUpdate,
  onEdit,
  onDelete,
}: {
  account: AccountSummary;
  onUpdate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const currency = account.currency || 'INR';
  const assetTypeOrder = Object.values(AssetType);
  const sortedAssetTypes = [...account.asset_types].sort(
    (a, b) => assetTypeOrder.indexOf(a as AssetType) - assetTypeOrder.indexOf(b as AssetType)
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 card-hover">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 truncate">{accountDisplayName(account)}</h3>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {sortedAssetTypes.map((type) => (
              <span key={type} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs rounded">
                {type.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400 p-2" title="Edit Account">
            <Edit2 size={18} />
          </button>
          <button onClick={onDelete} className="text-red-600 hover:text-red-800 dark:hover:text-red-400 p-2" title="Delete Account">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Invested Amount</p>
          <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            {formatAmount(Number(account.invested_amount), currency)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Value</p>
          <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            {formatAmount(Number(account.current_value), currency)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Holdings</p>
          <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{account.holdings_count}</p>
        </div>
      </div>
    </div>
  );
}

function AddAccountModal({
  defaultCurrency,
  onClose,
  onSuccess,
}: {
  defaultCurrency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const assetTypes = Object.values(AssetType);

  const toggleAssetType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      toast.error('Please select at least one asset type');
      return;
    }
    setLoading(true);
    try {
      await accountsAPI.create({ name, currency, asset_types: selectedTypes } as AccountCreateRequest);
      toast.success('Account created successfully!');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 slide-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Account</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
              placeholder="NRE Portfolio"
            />
          </div>

          <div>
            <label className={labelCls}>
              Currency <span className="text-gray-400 dark:text-gray-500 font-normal">(cannot be changed later)</span>
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Asset Types</label>
            <div className="grid grid-cols-2 gap-2">
              {assetTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleAssetType(type)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    selectedTypes.includes(type)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 btn-press transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 btn-press transition-all duration-200 font-medium"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAccountModal({
  account,
  onClose,
  onSuccess,
}: {
  account: AccountSummary;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(account.asset_types);
  const [loading, setLoading] = useState(false);

  const assetTypes = Object.values(AssetType);

  const toggleAssetType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      toast.error('Please select at least one asset type');
      return;
    }
    setLoading(true);
    try {
      await accountsAPI.update(account.id, { name, asset_types: selectedTypes });
      toast.success('Account updated successfully!');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 slide-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Account</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Currency</label>
            <input
              type="text"
              value={account.currency || 'INR'}
              disabled
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Currency cannot be changed after account creation.</p>
          </div>

          <div>
            <label className={labelCls}>Asset Types</label>
            <div className="grid grid-cols-2 gap-2">
              {assetTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleAssetType(type)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    selectedTypes.includes(type)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 btn-press transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 btn-press transition-all duration-200 font-medium"
            >
              {loading ? 'Updating...' : 'Update Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { familyAPI } from '../../lib/api';
import { CURRENCIES } from '../../lib/currencies';
import type { Family, PrivacyLevel } from '../../types';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export default function FamilySettings() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const { theme, setTheme } = useThemeStore();

  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    base_currency: 'INR',
    privacy_level: 'FAMILY' as PrivacyLevel,
  });

  useEffect(() => {
    familyAPI.get()
      .then((data) => {
        setFamily(data);
        setForm({
          name: data.name,
          base_currency: data.base_currency,
          privacy_level: data.privacy_level,
        });
      })
      .catch(() => toast.error('Failed to load family settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family) return;

    const changed: Record<string, string> = {};
    if (form.name !== family.name) changed.name = form.name;
    if (form.base_currency !== family.base_currency) changed.base_currency = form.base_currency;
    if (form.privacy_level !== family.privacy_level) changed.privacy_level = form.privacy_level;

    if (Object.keys(changed).length === 0) {
      toast('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const updated = await familyAPI.update(changed);
      setFamily(updated);
      toast.success('Family settings updated');
    } catch {
      toast.error('Failed to update family settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Family Profile */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Family Profile</h2>
        {!isAdmin && (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2 mb-4">
            Only the family admin can edit these settings.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Family Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!isAdmin}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Base Currency</label>
              <select
                value={form.base_currency}
                onChange={(e) => setForm({ ...form, base_currency: e.target.value })}
                disabled={!isAdmin}
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
              <label className={labelCls}>Privacy Level</label>
              <select
                value={form.privacy_level}
                onChange={(e) => setForm({ ...form, privacy_level: e.target.value as PrivacyLevel })}
                disabled={!isAdmin}
                className={inputCls}
              >
                <option value="FAMILY">Family — all members see everything</option>
                <option value="SHARED">Shared — members see shared accounts + their own</option>
                <option value="PRIVATE">Private — members see only their own data</option>
              </select>
            </div>
          </div>

          {isAdmin && (
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Family Profile'}
            </button>
          )}
        </form>
      </div>

      <hr className="dark:border-gray-700" />

      {/* Theme */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Theme</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose your display preference. Applied instantly.</p>
        <div className="flex flex-wrap gap-3">
          {(['light', 'dark', 'auto'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-5 py-2 rounded-lg border font-medium capitalize transition-all ${
                theme === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

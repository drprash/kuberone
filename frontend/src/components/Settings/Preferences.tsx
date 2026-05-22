import React from 'react';
import { usePriceStore } from '../../store/priceStore';

const TTL_OPTIONS = [
  { label: '1 minute', value: 60_000 },
  { label: '5 minutes', value: 300_000 },
  { label: '15 minutes', value: 900_000 },
  { label: '30 minutes', value: 1_800_000 },
  { label: '1 hour', value: 3_600_000 },
];

export default function Preferences() {
  const { ttlMs, setTtl, invalidate, fetchedAt } = usePriceStore();

  const handleTtlChange = (value: number) => {
    setTtl(value);
    invalidate();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Preferences</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Application behaviour settings</p>
      </div>

      <div className="border-t dark:border-gray-700 pt-6">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Price Cache Duration
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Prices are reused across Dashboard and Holdings for this duration. Use Refresh to force an immediate update.
          </p>
          <select
            value={ttlMs}
            onChange={(e) => handleTtlChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TTL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fetchedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Prices last fetched at {new Date(fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

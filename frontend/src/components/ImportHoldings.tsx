import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { holdingsAPI, accountsAPI } from '../lib/api';
import { AssetType } from '../types';
import type { AccountSummary } from '../types';
import toast from 'react-hot-toast';

interface ParsedRow {
  rowNum: number;
  symbol: string;
  quantity: number | null;
  avg_buy_price: number | null;
  name: string;
  asset_type: AssetType | null;
  valid: boolean;
  error: string;
}

interface ImportHoldingsProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ASSET_TYPE_VALUES = Object.values(AssetType);

function parseAssetType(value: string | undefined): AssetType | null {
  if (!value) return null;
  const normalized = value.toUpperCase().trim().replace(/[\s-]+/g, '_');
  return ASSET_TYPE_VALUES.includes(normalized as AssetType) ? (normalized as AssetType) : null;
}

export default function ImportHoldings({ onClose, onSuccess }: ImportHoldingsProps) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    accountsAPI.getAll()
      .then((data) => {
        setAccounts(data);
        if (data.length > 0) setSelectedAccountId(data[0].id);
      })
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setLoadingAccounts(false));
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const defaultAssetType = selectedAccount?.asset_types?.[0] as AssetType | undefined;

  const getAccountDisplayName = (account: AccountSummary) => {
    const currency = account.currency || 'INR';
    return account.user_first_name
      ? `${account.name} - ${account.user_first_name} (${currency})`
      : `${account.name} (${currency})`;
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Holdings');
    sheet.addRow(['Symbol', 'Quantity', 'Avg Buy Price', 'Name', 'Asset Type']);
    sheet.addRow(['RELIANCE.NS', 10, 2450.50, 'Reliance Industries Ltd', 'STOCK']);
    const buffer = await workbook.csv.writeBuffer();
    const blob = new Blob([buffer], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'holdings_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseRows = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      if (file.name.toLowerCase().endsWith('.csv')) {
        await workbook.csv.load(buffer);
      } else {
        await workbook.xlsx.load(buffer);
      }

      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('No sheet found');

      // Extract headers from row 1
      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
        headers.push(String(cell.value ?? '').toLowerCase().trim().replace(/\s+/g, '_'));
      });

      const parsed: ParsedRow[] = [];
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;

        const norm: Record<string, string> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const header = headers[colNum - 1];
          if (header !== undefined) {
            let rawVal: ExcelJS.CellValue = cell.value;
            if (rawVal !== null && typeof rawVal === 'object' && 'result' in rawVal) {
              rawVal = (rawVal as ExcelJS.CellFormulaValue).result ?? '';
            }
            norm[header] = String(rawVal ?? '').trim();
          }
        });

        const symbol = (norm['symbol'] || '').toUpperCase();
        const quantityRaw = norm['quantity'] || norm['qty'] || '';
        const priceRaw =
          norm['avg_buy_price'] ||
          norm['avg_price'] ||
          norm['average_buy_price'] ||
          norm['price'] ||
          '';
        const name = norm['name'] || '';
        const assetTypeRaw = norm['asset_type'] || norm['type'] || '';

        const quantity = quantityRaw !== '' ? parseFloat(quantityRaw) : null;
        const avg_buy_price = priceRaw !== '' ? parseFloat(priceRaw) : null;
        const asset_type = parseAssetType(assetTypeRaw) || defaultAssetType || null;

        const errors: string[] = [];
        if (!symbol) errors.push('Symbol required');
        if (quantity === null || isNaN(quantity) || quantity <= 0) errors.push('Valid quantity required');
        if (avg_buy_price === null || isNaN(avg_buy_price) || avg_buy_price <= 0) errors.push('Valid avg buy price required');

        parsed.push({
          rowNum,
          symbol,
          quantity: quantity !== null && !isNaN(quantity) ? quantity : null,
          avg_buy_price: avg_buy_price !== null && !isNaN(avg_buy_price) ? avg_buy_price : null,
          name: name || symbol,
          asset_type,
          valid: errors.length === 0,
          error: errors.join(', '),
        });
      });

      setParsedRows(parsed);
    } catch {
      toast.error('Failed to parse file. Please use a valid CSV or XLSX file.');
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAccountId) {
      toast.error('Please select an account first');
      e.target.value = '';
      return;
    }

    setFileName(file.name);
    setParsedRows([]);
    await parseRows(file);
  };

  const handleAccountChange = (id: string) => {
    setSelectedAccountId(id);
    setParsedRows([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = parsedRows.filter((r) => r.valid);

  const handleImport = async () => {
    if (validRows.length === 0 || !selectedAccountId) return;

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        await holdingsAPI.create({
          account_id: selectedAccountId,
          symbol: row.symbol,
          name: row.name,
          quantity: row.quantity!,
          avg_buy_price: row.avg_buy_price!,
          asset_type: row.asset_type || (defaultAssetType as AssetType),
          is_draft: true,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setImporting(false);

    if (successCount > 0) {
      toast.success(`${successCount} holding${successCount > 1 ? 's' : ''} imported as drafts`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} row${failCount > 1 ? 's' : ''} failed to import`);
    }
    if (successCount > 0) {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Holdings</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Account selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Import into Account *
            </label>
            {loadingAccounts ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-red-600 dark:text-red-400">No accounts available. Please create an account first.</div>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Download Template</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                Required: Symbol, Quantity, Avg Buy Price &nbsp;·&nbsp; Optional: Name, Asset Type
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shrink-0"
            >
              <Download size={14} />
              Template
            </button>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Upload File (.csv, .xlsx)
            </label>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto text-gray-400 dark:text-gray-500 mb-2" size={24} />
              {fileName ? (
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">{fileName}</p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Click to browse or drag &amp; drop</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Preview — {parsedRows.length} row{parsedRows.length > 1 ? 's' : ''} &nbsp;
                <span className="text-green-600 dark:text-green-400">({validRows.length} valid)</span>
                {parsedRows.length - validRows.length > 0 && (
                  <span className="text-red-500 dark:text-red-400 ml-1">
                    · {parsedRows.length - validRows.length} will be skipped
                  </span>
                )}
              </p>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Symbol</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Quantity</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Avg Buy Price</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Asset Type</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {parsedRows.map((row) => (
                      <tr key={row.rowNum} className={row.valid ? 'dark:bg-gray-800' : 'bg-red-50 dark:bg-red-900/20'}>
                        <td className="px-3 py-2 text-gray-400 dark:text-gray-500">{row.rowNum}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                          {row.symbol || <span className="text-red-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                          {row.quantity ?? <span className="text-red-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                          {row.avg_buy_price ?? <span className="text-red-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.name}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">
                          {row.asset_type || <span className="text-gray-400 dark:text-gray-500">default</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.valid ? (
                            <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                          ) : (
                            <span title={row.error}>
                              <AlertCircle size={14} className="text-red-500 mx-auto" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.some((r) => !r.valid) && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Rows with errors will be skipped. Hover the icon for details.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {importing
              ? 'Importing...'
              : `Import ${validRows.length} Valid Row${validRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

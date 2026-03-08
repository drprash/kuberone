import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, Users, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { adminAPI, backupAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import type { User, BackupData, RestoreResult } from '../../types';

export default function BackupRestore() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  // Backup state
  const [members, setMembers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupData | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingMembers(true);
    adminAPI.getMembers()
      .then((data) => {
        setMembers(data);
        setSelectedUserIds(data.map((m) => m.id));
      })
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setLoadingMembers(false));
  }, [isAdmin]);

  const toggleUserId = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDownload = async () => {
    if (isAdmin && selectedUserIds.length === 0) {
      toast.error('Select at least one member to include in the backup');
      return;
    }
    setDownloading(true);
    try {
      const data = await backupAPI.download(isAdmin ? selectedUserIds : undefined);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kuberone_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch {
      toast.error('Failed to create backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreResult(null);
    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupData;
        if (parsed.app !== 'KuberOne' || !Array.isArray(parsed.accounts)) {
          toast.error('Invalid KuberOne backup file');
          setRestoreFile(null);
          setRestorePreview(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        setRestorePreview(parsed);
      } catch {
        toast.error('Invalid JSON file');
        setRestoreFile(null);
        setRestorePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const result = await backupAPI.restore(restoreFile);
      setRestoreResult(result);
      setRestoreFile(null);
      setRestorePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Restore completed');
    } catch {
      toast.error('Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const totalHoldings = restorePreview?.accounts.reduce((sum, a) => sum + a.holdings.length, 0) ?? 0;

  return (
    <div className="p-6 space-y-8">
      {/* ── Backup ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Download size={17} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Create Backup</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Downloads a single <span className="font-medium text-gray-700 dark:text-gray-300">.json</span> file
          containing all accounts and their holdings in a structured format.
          {isAdmin
            ? ' As Family Admin you can choose which members to include.'
            : ' Your backup will include your own accounts and holdings only.'}
        </p>

        {/* Member selector — admin only */}
        {isAdmin && (
          <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowMemberSelect((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              <div className="flex items-center gap-2">
                <Users size={15} />
                Select Members to Include
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedUserIds.length} / {members.length} selected
                </span>
                {showMemberSelect
                  ? <ChevronUp size={15} className="text-gray-400" />
                  : <ChevronDown size={15} className="text-gray-400" />}
              </div>
            </button>

            {showMemberSelect && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
                {loadingMembers ? (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Loading members…</div>
                ) : (
                  <>
                    <div className="px-4 py-2 flex gap-4 bg-white dark:bg-gray-800">
                      <button
                        onClick={() => setSelectedUserIds(members.map((m) => m.id))}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedUserIds([])}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                    {members.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(member.id)}
                          onChange={() => toggleUserId(member.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                        </div>
                        {member.role === 'ADMIN' && (
                          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            Admin
                          </span>
                        )}
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading || (isAdmin && selectedUserIds.length === 0)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition-colors"
        >
          <Download size={15} />
          {downloading ? 'Creating Backup…' : 'Download Backup (.json)'}
        </button>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* ── Restore ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Upload size={17} className="text-green-600 dark:text-green-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Restore from Backup</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload a KuberOne <span className="font-medium text-gray-700 dark:text-gray-300">.json</span> backup file.
          Accounts are restored first, then holdings are added to each account.
          If an account with the same name and currency already exists it will be reused — no duplicate account is created.
          {!isAdmin && ' You can only restore your own account data.'}
        </p>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto text-gray-400 dark:text-gray-500 mb-2" size={22} />
          {restoreFile ? (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">{restoreFile.name}</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click to browse or drag &amp; drop a <span className="font-medium">.json</span> backup file
            </p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Preview */}
        {restorePreview && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Backup Preview</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Family: <span className="text-gray-800 dark:text-gray-200 font-medium">{restorePreview.family_name}</span></span>
                <span>Exported: <span className="text-gray-800 dark:text-gray-200 font-medium">{new Date(restorePreview.exported_at).toLocaleString()}</span></span>
                <span>Accounts: <span className="text-gray-800 dark:text-gray-200 font-medium">{restorePreview.accounts.length}</span></span>
                <span>Total Holdings: <span className="text-gray-800 dark:text-gray-200 font-medium">{totalHoldings}</span></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Account</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Currency</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Owner</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Holdings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {restorePreview.accounts.map((acc, i) => (
                    <tr key={i} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{acc.name}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{acc.currency}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                        {acc.user_first_name || acc.user_email}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{acc.holdings.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Restore result */}
        {restoreResult && (
          <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg px-4 py-3 mb-4">
            <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div className="text-sm text-green-800 dark:text-green-300 space-y-0.5">
              <p className="font-medium">Restore completed successfully</p>
              <p>
                Accounts created: <span className="font-medium">{restoreResult.accounts_created}</span>
                &nbsp;·&nbsp;
                Accounts matched (existing): <span className="font-medium">{restoreResult.accounts_matched}</span>
              </p>
              <p>
                Holdings restored: <span className="font-medium">{restoreResult.holdings_created}</span>
                {restoreResult.holdings_failed > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    &nbsp;·&nbsp;Failed: <span className="font-medium">{restoreResult.holdings_failed}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Error note when no file but result failed hint */}
        {!restoreFile && !restoreResult && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-4">
            <AlertCircle size={12} />
            Only KuberOne backup files (.json) are accepted
          </div>
        )}

        <button
          onClick={handleRestore}
          disabled={!restoreFile || restoring}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm transition-colors"
        >
          <Upload size={15} />
          {restoring ? 'Restoring…' : 'Restore from Backup'}
        </button>
      </div>
    </div>
  );
}

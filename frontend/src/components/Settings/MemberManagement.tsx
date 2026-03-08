import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import type { User, MemberCreateRequest, MemberInviteInformation, PasswordResetToken } from '../../types';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export default function MemberManagement() {
  const currentUser = useAuthStore((state) => state.user);

  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [inviteData, setInviteData] = useState<MemberInviteInformation | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetToken, setResetToken] = useState<PasswordResetToken | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [memberForm, setMemberForm] = useState<MemberCreateRequest>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'MEMBER' as any,
  });

  const fetchMembers = async () => {
    try {
      const data = await adminAPI.getMembers();
      setMembers(data);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await adminAPI.createMember(memberForm);
      setInviteData(data);
      setMemberForm({ email: '', first_name: '', last_name: '', role: 'MEMBER' as any });
      toast.success('Member created!');
      fetchMembers();
    } catch {
      // error toast handled by api interceptor
    }
  };

  const handleRemove = async (member: User) => {
    if (!confirm(`Remove ${member.first_name} ${member.last_name}? They will lose access.`)) return;
    try {
      await adminAPI.deleteMember(member.id);
      toast.success('Member removed');
      fetchMembers();
    } catch {
      // handled by interceptor
    }
  };

  const handleMakeAdmin = async (member: User) => {
    if (!confirm(`Make ${member.first_name} an admin?`)) return;
    try {
      await adminAPI.updateMember(member.id, { role: 'ADMIN' });
      toast.success('Admin role assigned');
      fetchMembers();
    } catch {
      // handled by interceptor
    }
  };

  const handleResetPassword = async (member: User) => {
    try {
      const data = await adminAPI.resetMemberPassword(member.id);
      setResetTarget(member);
      setResetToken(data);
      setShowResetModal(true);
    } catch {
      // handled by interceptor
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Family Members</h2>
        <button
          onClick={() => { setShowAddModal(true); setInviteData(null); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
        >
          + Add Member
        </button>
      </div>

      {/* Members table */}
      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {member.first_name} {member.last_name}
                  {member.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.role === 'ADMIN'
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.active
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  }`}>
                    {member.active ? (member.activated ? 'Active' : 'Pending Setup') : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {member.id !== currentUser?.id && (
                    <div className="flex flex-wrap gap-2">
                      {member.active && (
                        <>
                          <button
                            onClick={() => handleResetPassword(member)}
                            className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded text-xs hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors"
                          >
                            Reset Password
                          </button>
                          {member.role !== 'ADMIN' && (
                            <>
                              <button
                                onClick={() => handleMakeAdmin(member)}
                                className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded text-xs hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
                              >
                                Make Admin
                              </button>
                              <button
                                onClick={() => handleRemove(member)}
                                className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            {!inviteData ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Family Member</h3>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="member@example.com"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>First Name</label>
                      <input
                        type="text"
                        value={memberForm.first_name}
                        onChange={(e) => setMemberForm({ ...memberForm, first_name: e.target.value })}
                        placeholder="John"
                        required
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Last Name</label>
                      <input
                        type="text"
                        value={memberForm.last_name}
                        onChange={(e) => setMemberForm({ ...memberForm, last_name: e.target.value })}
                        placeholder="Doe"
                        required
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Role</label>
                    <select
                      value={memberForm.role}
                      onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as any })}
                      className={inputCls}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                    >
                      Create Member
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Member Created!</h3>
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Share this activation token with the member:
                  </p>
                  <div className="bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded px-3 py-2 flex items-center justify-between mb-2">
                    <code className="text-xs text-slate-700 dark:text-slate-300 break-all flex-1">
                      {inviteData.activation_token}
                    </code>
                    <button
                      onClick={() => copyToClipboard(inviteData.activation_token, 'invite')}
                      className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                      {copiedKey === 'invite' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Expires: {new Date(inviteData.activation_expires_at).toLocaleString()}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Instructions for the member:</p>
                  <ol className="text-xs text-slate-600 dark:text-slate-400 list-decimal list-inside space-y-1">
                    <li>Open the app and click "Set password with activation token?"</li>
                    <li>Paste the token and create their password</li>
                    <li>They can then log in normally</li>
                  </ol>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setInviteData(null); }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetToken && resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Password Reset Token
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Share this token with {resetTarget.first_name} to reset their password. Valid for 72 hours.
            </p>
            <div className="space-y-3 mb-6">
              <div>
                <label className={labelCls}>Reset Token</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resetToken.token}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 font-mono text-xs"
                  />
                  <button
                    onClick={() => copyToClipboard(resetToken.token, 'reset')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {copiedKey === 'reset' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Account Email</label>
                <input
                  type="email"
                  value={resetToken.user_email}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => { setShowResetModal(false); setResetToken(null); setResetTarget(null); }}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

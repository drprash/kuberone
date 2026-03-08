import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import FamilySettings from '../components/Settings/FamilySettings';
import MemberManagement from '../components/Settings/MemberManagement';
import BackupRestore from '../components/Settings/BackupRestore';

const tabs = [
  { id: 'family', label: 'Family & Theme' },
  { id: 'members', label: 'Member Management', adminOnly: true },
  { id: 'backup', label: 'Backup & Restore' },
];

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState('family');

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your family portfolio and preferences</p>
      </div>

      {/* Tab navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-2 p-4">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                activeTab === tab.id
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {activeTab === 'family' && <FamilySettings />}
        {activeTab === 'members' && isAdmin && <MemberManagement />}
        {activeTab === 'backup' && <BackupRestore />}
      </div>
    </div>
  );
}

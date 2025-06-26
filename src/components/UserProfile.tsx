'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function UserProfile() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xl font-semibold">
            {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {user.name || 'User'}
          </h3>
          <p className="text-gray-600">{user.email}</p>
          {user.nostr_pubkey && (
            <p className="text-sm text-indigo-600 font-mono">
              {user.nostr_pubkey.slice(0, 8)}...{user.nostr_pubkey.slice(-8)}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-600">Email</span>
          <span className="font-medium">{user.email}</span>
        </div>
        
        {user.discord_id && (
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Discord ID</span>
            <span className="font-medium">{user.discord_id}</span>
          </div>
        )}
        
        {user.nostr_pubkey && (
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Nostr Public Key</span>
            <span className="font-mono text-sm">{user.nostr_pubkey}</span>
          </div>
        )}
      </div>

      <button
        onClick={signOut}
        className="w-full mt-6 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
      >
        Sign Out
      </button>
    </div>
  );
} 
'use client';

import { useNostr } from '../_context/NostrContext';

export default function UserProfile() {
  const { localSecretKey, bunkerConnectionToken } = useNostr();

  if (!localSecretKey) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xl font-semibold">
            {localSecretKey.slice(0, 8)}...{localSecretKey.slice(-8)}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {localSecretKey.slice(0, 8)}...{localSecretKey.slice(-8)}
          </h3>
          <p className="text-gray-600">{localSecretKey.slice(0, 8)}...{localSecretKey.slice(-8)}</p>
          {bunkerConnectionToken && (
            <p className="text-sm text-indigo-600 font-mono">
              {bunkerConnectionToken.slice(0, 8)}...{bunkerConnectionToken.slice(-8)}
            </p>
          )}
        </div>
      </div>


      <button
        onClick={() => {
          // Handle sign out
          if (typeof window !== 'undefined') {
            localStorage.removeItem('openbunker_session');
            window.location.href = '/';
          }
        }}
        className="w-full mt-6 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
      >
        Sign Out
      </button>
    </div>
  );
} 
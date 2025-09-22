'use client';

import { getPublicKey, nip19 } from 'nostr-tools';
import { useState } from 'react';
import { useNostr } from '../_context/NostrProvider';

export default function UserProfile() {
  const { localSecretKey, bunkerConnectionConfiguration, logout } = useNostr();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!localSecretKey) return null;

  // Generate npub from the secret key
  const publicKey = getPublicKey(localSecretKey);
  const npub = nip19.npubEncode(publicKey);

  const tooltipContent = (
    <div className="space-y-3 text-left">
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">Public Key (npub)</h4>
        <p className="text-sm font-mono text-gray-700 break-all">{npub}</p>
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">Secret Key (nsec)</h4>
        <p className="text-sm font-mono text-gray-700 break-all">
          {nip19.nsecEncode(localSecretKey)}
        </p>
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">Public Key (hex)</h4>
        <p className="text-sm font-mono text-gray-700 break-all">{publicKey}</p>
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">Secret Key (hex)</h4>
        <p className="text-sm font-mono text-gray-700 break-all">
          {localSecretKey}
        </p>
      </div>
      {bunkerConnectionConfiguration && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">
            Bunker Connection Token
          </h4>
          <p className="text-sm font-mono text-gray-700 break-all">
            {bunkerConnectionConfiguration.connectionToken}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div
          className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="text-white text-xl font-semibold">
            {npub.slice(0, 8)}...{npub.slice(-8)}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {npub.slice(0, 8)}...{npub.slice(-8)}
          </h3>
          <p className="text-gray-600">Nostr Public Key</p>
          {bunkerConnectionConfiguration && (
            <p className="text-sm text-indigo-600 font-mono">
              {bunkerConnectionConfiguration.connectionToken.slice(0, 8)}...
              {bunkerConnectionConfiguration.connectionToken.slice(-8)}
            </p>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl max-w-md border border-gray-700">
          {tooltipContent}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
        </div>
      )}

      <button
        onClick={async () => {
          try {
            await logout();
            // The logout function will handle clearing all state
            // The main page will redirect to login when nostrStatus changes
          } catch (error) {
            console.error('Logout failed:', error);
          }
        }}
        className="w-full mt-6 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
      >
        Sign Out
      </button>
    </div>
  );
}

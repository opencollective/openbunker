'use client';

import { useState } from 'react';
import { useNostr } from '@/app/(example)/_context/NostrContext';
import { useRouter } from 'next/navigation';

export default function SecretKeyLogin() {
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setLocalSecretKey } = useNostr();

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) return;

    setLoading(true);
    setError('');

    try {
      setLocalSecretKey(secretKey as unknown as Uint8Array);
      router.push('/');
    } catch {
      setError('Invalid secret key. Please check your key and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Authenticate with Secret Key
        </h2>
        <p className="text-gray-600">
          Enter your Nostr secret key to sign events directly
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="secretKey"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Nostr Secret Key
          </label>
          <input
            id="secretKey"
            type="password"
            value={secretKey}
            onChange={e => setSecretKey(e.target.value)}
            placeholder="nsec1..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Your secret key will be stored locally and used to sign Nostr events
          </p>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !secretKey.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? 'Authenticating...' : 'Authenticate'}
        </button>
      </form>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          <strong>Security Note:</strong> Your secret key is stored locally in
          your browser and is never sent to our servers.
        </p>
      </div>
    </div>
  );
}

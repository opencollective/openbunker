'use client';

import { useEffect, useState } from 'react';

interface Scope {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner: string;
  keyNpub: string;
  createdAt: string;
  updatedAt: string;
  key: {
    npub: string;
    nsec: string;
    name: string;
  };
}

interface CreateKeyModalProps {
  onClose: () => void;
  onSubmit: (data: { scope: string }) => Promise<void>;
  scope?: string; // Optional scope parameter
}

export default function CreateKeyModal({
  onClose,
  onSubmit,
  scope: initialScope,
}: CreateKeyModalProps) {
  const [scope, setScope] = useState(initialScope || '');
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopesLoading, setScopesLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available scopes when modal opens
  useEffect(() => {
    if (initialScope) {
      setScope(initialScope);
    } else {
      fetchScopes();
    }
  }, [initialScope]);

  const fetchScopes = async () => {
    setScopesLoading(true);
    try {
      const response = await fetch('/api/scopes?queryType=all');
      if (response.ok) {
        const data = await response.json();
        setScopes(data.scopes || []);
      } else {
        setError('Failed to load available scopes');
      }
    } catch (error) {
      console.error('Error fetching scopes:', error);
      setError('Failed to load available scopes');
    } finally {
      setScopesLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scope.trim()) {
      setError('Please select a scope');
      return;
    }

    // Validate that the selected scope exists in the available scopes
    const selectedScope = scopes.find(s => s.slug === scope);
    console.log('selectedScope', selectedScope);
    console.log('scopes', scopes);
    if (!selectedScope && !initialScope) {
      setError('Please select a valid scope');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit({ scope: scope.trim() });
      // Reset form on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setScope(initialScope || '');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Create New Scope Key
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="scope"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Scope
              </label>
              {initialScope ? (
                // Show read-only input when scope is pre-selected
                <input
                  type="text"
                  id="scope"
                  value={initialScope}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 cursor-not-allowed"
                  disabled
                  readOnly
                />
              ) : (
                // Show dropdown when no scope is pre-selected
                <select
                  id="scope"
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  disabled={loading || scopesLoading}
                  required
                >
                  <option value="">
                    {scopesLoading ? 'Loading scopes...' : 'Select a scope'}
                  </option>
                  {scopes.map(scopeOption => (
                    <option key={scopeOption.id} value={scopeOption.slug}>
                      {scopeOption.name} ({scopeOption.slug})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {initialScope
                  ? `This key will be created for scope: ${initialScope}`
                  : scopesLoading
                    ? 'Loading available scopes...'
                    : scopes.length === 0
                      ? 'No scopes available. Create a scope first.'
                      : 'Select the scope for this key'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                scopesLoading ||
                (!initialScope && scopes.length === 0)
              }
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Key'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

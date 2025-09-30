'use client';

import { useUserKeys } from '@/hooks/useUserKeys';
import { Keys } from '@prisma/client';
import { useEffect, useState } from 'react';
import CreateKeyModal from './CreateKeyModal';

interface KeySelectorProps {
  onKeySelected?: (key: Keys) => void;
  selectedKeyId?: string;
  disabled?: boolean;
  scopeSlug?: string | null;
}

export default function KeySelector({
  onKeySelected,
  selectedKeyId,
  disabled = false,
  scopeSlug,
}: KeySelectorProps) {
  const { keys, loading, error, refetch, createKeyForScope } =
    useUserKeys(scopeSlug);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [autoCreating, setAutoCreating] = useState(false);

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(keyId);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatNpub = (npub: string) => {
    if (npub.length <= 20) return npub;
    return `${npub.substring(0, 10)}...${npub.substring(npub.length - 10)}`;
  };

  const handleKeySelect = (key: Keys) => {
    if (disabled || !onKeySelected) {
      return;
    }
    onKeySelected(key);
  };

  // Auto-create key when no keys exist for the scope
  useEffect(() => {
    const autoCreateKey = async () => {
      if (
        !loading &&
        !error &&
        (!keys || keys.length === 0) &&
        scopeSlug &&
        !autoCreating &&
        !disabled
      ) {
        setAutoCreating(true);
        try {
          await createKeyForScope(scopeSlug);
        } catch (err) {
          console.error('Failed to auto-create key:', err);
        } finally {
          setAutoCreating(false);
        }
      }
    };

    autoCreateKey();
  }, [
    loading,
    error,
    keys,
    scopeSlug,
    autoCreating,
    disabled,
    createKeyForScope,
    onKeySelected,
  ]);

  if (loading || autoCreating) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
        {autoCreating && (
          <div className="text-center text-sm text-gray-600">
            Creating identity for {scopeSlug}...
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <div className="text-red-500 mb-2">Error loading identities</div>
        <button
          onClick={refetch}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (showCreateModal) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Create New Identity
          </h3>
          <button
            onClick={() => setShowCreateModal(false)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to identities
          </button>
        </div>
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          scope={scopeSlug || undefined}
          onSubmit={async data => {
            try {
              const response = await fetch('/api/keys', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              });

              if (!response.ok) {
                throw new Error('Failed to create identity');
              }

              setShowCreateModal(false);
              refetch();
            } catch (error) {
              throw error;
            }
          }}
        />
      </div>
    );
  }

  if (!keys || keys.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {scopeSlug
              ? `No Identities Available for Scope: ${scopeSlug}`
              : 'No Identities Available'}
          </h3>
          <p className="text-gray-600 mb-4">
            {scopeSlug
              ? `No identities found for the "${scopeSlug}" scope. Create a new identity for this scope.`
              : 'Create your first Nostr identity to get started'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={disabled}
          className={`w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          Create New Identity
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {scopeSlug ? `Choose Identity for ${scopeSlug}` : 'Choose Identity'}
        </h3>
        <p className="text-gray-600">
          {scopeSlug
            ? `Select a Nostr identity for the "${scopeSlug}" scope`
            : 'Select a Nostr identity to authenticate with'}
        </p>
      </div>

      {/* Keys List */}
      <div className="space-y-3">
        {keys.map(key => (
          <div
            key={key.npub}
            className={`border rounded-lg p-4 transition-all ${
              disabled
                ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                : selectedKeyId === key.npub
                  ? 'border-indigo-500 bg-indigo-50 cursor-pointer'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
            }`}
            onClick={() => handleKeySelect(key)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {key.name?.charAt(0).toUpperCase() || 'K'}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {key.name || 'Unnamed Identity'}
                  </h4>
                  <p className="text-sm text-gray-600 font-mono">
                    {formatNpub(key.npub)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (!disabled) {
                      copyToClipboard(key.npub, key.npub);
                    }
                  }}
                  className={`p-1 transition-colors ${
                    disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Copy public identity"
                  disabled={disabled}
                >
                  {copied === key.npub ? (
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
                {selectedKeyId === key.npub && (
                  <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {(key.email || key.scopeSlug) && (
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                {key.email && <div>Email: {key.email}</div>}
                {key.scopeSlug && (
                  <div className="text-blue-600 font-medium">
                    Scope: {key.scopeSlug}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create New Key */}
      <div className="border-t border-gray-200 pt-6">
        <div className="text-center">
          <h4 className="text-md font-medium text-gray-900 mb-2">
            Need a New Identity?
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Create a new Nostr identity for this session
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={disabled}
            className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium transition-colors ${
              disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Create New Identity
          </button>
        </div>
      </div>
    </div>
  );
}

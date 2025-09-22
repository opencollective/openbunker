'use client';

import ConnectionTokensList from '@/components/ConnectionTokensList';
import { useUserKeys } from '@/hooks/useUserKeys';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function KeyDetailPage() {
  const params = useParams();
  const { keys, loading, error } = useUserKeys();
  const [copied, setCopied] = useState<string | null>(null);

  const npub = params.npub as string;
  const userKey = keys.find(key => key.npub === npub);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="container mx-auto px-4 py-16">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error Loading Key
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!userKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-gray-600"
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Key Not Found
            </h3>
            <p className="text-gray-600 mb-4">
              The requested key could not be found or you don&apos;t have access
              to it.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors mb-4"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Keys
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {userKey.name || userKey.name || 'Unnamed Key'}
          </h1>
          <p className="text-lg text-gray-600">
            Key Details and Connection Tokens
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Key Information */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Key Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Public Key (npub)
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono">
                        {formatNpub(userKey.npub)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(userKey.npub, 'npub')}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy npub"
                      >
                        {copied === 'npub' ? (
                          <svg
                            className="w-5 h-5 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
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
                    </div>
                  </div>

                  {userKey.email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <p className="text-gray-900">{userKey.email}</p>
                    </div>
                  )}

                  {userKey.relays && userKey.relays.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Connected Relays ({userKey.relays.length})
                      </label>
                      <div className="space-y-1">
                        {userKey.relays.map((relay, index) => (
                          <div
                            key={index}
                            className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded"
                          >
                            {relay}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Tokens */}
            <div className="space-y-6">
              <ConnectionTokensList npub={npub} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

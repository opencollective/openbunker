'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function ExamplePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user && !loading) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Application Example
            </h1>
            <p className="text-xl text-gray-600">
              This page demonstrates how to use OpenBunker authentication in your application
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                User Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">User ID</label>
                  <p className="text-gray-900 font-mono text-sm">{user.id}</p>
                </div>
                {user.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{user.email}</p>
                  </div>
                )}
                {user.name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{user.name}</p>
                  </div>
                )}
                {user.nostr_pubkey && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nostr Public Key</label>
                    <p className="text-gray-900 font-mono text-sm break-all">{user.nostr_pubkey}</p>
                  </div>
                )}
                {user.discord_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Discord ID</label>
                    <p className="text-gray-900">{user.discord_id}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Authentication Status
              </h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-900">Authenticated</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-900">Nostr Key Available</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-900">Session Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Code Example
            </h2>
            <div className="bg-gray-900 rounded-lg p-6 overflow-x-auto">
              <pre className="text-green-400 text-sm">
{`// Check authentication status
const { user, loading } = useAuth();

// Redirect if not authenticated
useEffect(() => {
  if (!user && !loading) {
    router.push('/login');
  }
}, [user, loading, router]);

// Access user information
if (user) {
  console.log('User ID:', user.id);
  console.log('Nostr Pubkey:', user.nostr_pubkey);
  console.log('Email:', user.email);
}`}
              </pre>
            </div>
          </div>

          <div className="text-center">
            <Link 
              href="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 
'use client';

import UserKeys from '@/components/UserKeys';
import UserProfile from '@/components/UserProfile';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              OpenBunker
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            An example app that establishes remote signing to Nostr via social
            sign in. Experience seamless authentication and real-time Nostr
            relay listening.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Welcome!
                </h2>
                <p className="text-gray-600">
                  Authenticate to sign events and connect to Nostr.
                </p>
              </div>
              <UserProfile />

              <div className="text-center space-y-4">
                <Link
                  href="/example"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                >
                  View Application Example
                </Link>
                <div>
                  <Link
                    href="/scopes"
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
                  >
                    Manage Scopes
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Your Nostr Keys
                </h2>
                <p className="text-gray-600">
                  Manage your Nostr identities and keys for secure interactions.
                </p>
              </div>
              <UserKeys />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

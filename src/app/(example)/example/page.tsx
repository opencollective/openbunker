'use client';

import BunkerStatus from '@/app/(example)/_components/BunkerStatus';
import UserProfile from '@/app/(example)/_components/NostrUserProfile';
// import UserProfileEvent from '@/app/(example)/_components/UserProfileEvent';
import { useNostr } from '@/app/(example)/_context/NostrProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { nostrStatus, logout } = useNostr();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    console.log('Example page: nostrStatus changed to:', nostrStatus);
    if (nostrStatus !== 'connected') {
      console.log('Example page: Redirecting to login');
      router.push('/example/login');
    }
  }, [nostrStatus, router]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/example/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (nostrStatus !== 'connected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      {/* Header with logout button */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">
                OpenBunker Example
              </h2>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              OpenBunker Example App
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            An example app that establishes remote signing to Nostr via social
            sign in. Experience seamless authentication and real-time Nostr
            relay listening.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Welcome back!
                </h2>
                <p className="text-gray-600">
                  You&apos;re successfully authenticated and connected to Nostr
                  relays.
                </p>
              </div>
              <UserProfile />

              <div className="text-center">
                <Link
                  href="/example"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                >
                  View Application Example
                </Link>
              </div>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Bunker Connection
                </h2>
                <p className="text-gray-600">
                  Status of your remote signing connection
                </p>
              </div>
              <BunkerStatus />
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Your Profile
                </h2>
                <p className="text-gray-600">
                  View and edit your Nostr profile (kind 0 event)
                </p>
              </div>
              {/* <UserProfileEvent /> */}
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Secure Authentication
              </h3>
              <p className="text-gray-600">
                Multiple authentication methods including secret keys and
                Discord OAuth.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nostr Integration
              </h3>
              <p className="text-gray-600">
                Real-time connection to Nostr relays for community events and
                interactions.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-pink-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Community Focused
              </h3>
              <p className="text-gray-600">
                Designed for onboarding members to Nostr communities with ease.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

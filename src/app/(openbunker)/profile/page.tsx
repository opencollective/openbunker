'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Profile</h1>
          <p className="text-gray-600">Manage your account information and settings</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center space-x-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">
                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">
                {user.user_metadata?.full_name || user.user_metadata?.name || 'User'}
              </h2>
              <p className="text-gray-600">{user.email}</p>
              {user.user_metadata?.provider && (
                <p className="text-sm text-indigo-600 capitalize mt-1">
                  Connected via {user.user_metadata.provider}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600 font-medium">User ID</span>
              <span className="font-mono text-sm text-gray-900">{user.id}</span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Email</span>
              <span className="font-medium text-gray-900">{user.email}</span>
            </div>
            
            {user.user_metadata?.full_name && (
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Full Name</span>
                <span className="font-medium text-gray-900">{user.user_metadata.full_name}</span>
              </div>
            )}

            {user.user_metadata?.name && (
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Display Name</span>
                <span className="font-medium text-gray-900">{user.user_metadata.name}</span>
              </div>
            )}
            
            {user.user_metadata?.provider && (
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Provider</span>
                <span className="font-medium text-gray-900 capitalize">{user.user_metadata.provider}</span>
              </div>
            )}

            {user.user_metadata?.avatar_url && (
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Avatar</span>
                <span className="font-medium text-gray-900">{user.user_metadata.avatar_url}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Email Verified</span>
              <span className="font-medium text-gray-900">
                {user.email_confirmed_at ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Account Created</span>
              <span className="font-medium text-gray-900">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>

            {user.last_sign_in_at && (
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Last Sign In</span>
                <span className="font-medium text-gray-900">
                  {new Date(user.last_sign_in_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={signOut}
              className="w-full bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-200"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

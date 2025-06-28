'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@supabase/supabase-js';

interface NostrKey {
  npub: string;
  name?: string;
  avatar?: string;
  relays?: string[];
}

export default function UserProfile() {
  const { user, loading, signOut } = useAuth();
  const [showNostrKey, setShowNostrKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mock Nostr key data - in a real app this would come from your backend
  const nostrKey: NostrKey = {
    npub: 'npub1example...',
    name: 'User Display Name',
    avatar: user?.user_metadata?.avatar_url || '/default-avatar.png',
    relays: ['wss://relay.damus.io', 'wss://nos.lol']
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Authenticated</h3>
          <p className="text-gray-600 mb-4">Please sign in to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <img
              src={user.user_metadata?.avatar_url || '/default-avatar.png'}
              alt="Profile"
              className="w-16 h-16 rounded-full border-2 border-gray-200"
              onError={(e) => {
                e.currentTarget.src = '/default-avatar.png';
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {user.user_metadata?.full_name || user.user_metadata?.name || 'User'}
            </h3>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Authenticated
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Sign out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Nostr Key Section */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-gray-900">Nostr Identity</h4>
          <button
            onClick={() => setShowNostrKey(!showNostrKey)}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {showNostrKey ? 'Hide' : 'Show'} Details
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {nostrKey.name || 'Nostr User'}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {formatNpub(nostrKey.npub)}
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(nostrKey.npub)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy npub"
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          {showNostrKey && (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Connected Relays</p>
                <div className="space-y-1">
                  {nostrKey.relays?.map((relay, index) => (
                    <div key={index} className="flex items-center justify-between text-xs text-gray-600">
                      <span className="font-mono">{relay}</span>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Full Public Key</p>
                <div className="bg-white rounded border p-2">
                  <p className="text-xs font-mono text-gray-800 break-all">{nostrKey.npub}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="border-t border-gray-200 pt-6 mt-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Account Information</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Provider</span>
            <span className="text-sm font-medium text-gray-900">
              {user.app_metadata?.provider || 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Last Sign In</span>
            <span className="text-sm font-medium text-gray-900">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Created</span>
            <span className="text-sm font-medium text-gray-900">
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-gray-200 pt-6 mt-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h4>
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-sm">Edit Profile</span>
          </button>
          <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-sm">New Event</span>
          </button>
        </div>
      </div>
    </div>
  );
}

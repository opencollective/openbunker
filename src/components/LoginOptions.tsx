'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import SecretKeyLogin from '@/components/SecretKeyLogin';
import OpenBunkerLogin from '@/components/OpenBunkerLogin';

export default function LoginOptions() {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);
  const { user, checkOpenBunkerCallback } = useAuth();
  const router = useRouter();

  // Set up the callback function for the popup
  useEffect(() => {
    // Define the callback function on the window object
    (window as any).openBunkerCallback = (secretKey: string) => {
      handleOpenBunkerSuccess(secretKey);
    };

    // Set up message listener as fallback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      console.log('handleMessage', event);
      
      if (event.data.type === 'openbunker-auth-success') {
        handleOpenBunkerSuccess(event.data.secretKey);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      // Clean up
      delete (window as any).openBunkerCallback;
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleOpenBunkerSuccess = async (secretKey: string) => {
    try {
      // Use the auth context to handle the secret key
      await checkOpenBunkerCallback(secretKey);
      router.push('/');
    } catch (err) {
      console.error('Failed to complete OpenBunker authentication:', err);
    }
  };

  const handleOpenBunkerPopup = () => {
    console.log('handleOpenBunkerPopup');
    // Create a popup with the OpenBunkerLogin component
    const popupWindow = window.open(
      '/openbunker-login-popup',
      'openbunker-login',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (popupWindow) {
      setPopup(popupWindow);

      // Check if popup is closed
      const checkClosed = setInterval(() => {
        console.log('checkClosed', popupWindow.closed);
        if (popupWindow.closed) {
          clearInterval(checkClosed);
          setPopup(null);
        }
      }, 1000);
    }
  };

  if (user) {
    return null;
  }

  if (showSecretKey) {
    return (
      <div>
        <button
          onClick={() => setShowSecretKey(false)}
          className="mb-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center"
        >
          ← Back to options
        </button>
        <SecretKeyLogin />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Choose Authentication Method
        </h2>
        <p className="text-gray-600">
          Select how you'd like to authenticate with OpenBunker
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setShowSecretKey(true)}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Authenticate with Secret Key</span>
        </button>

        <button
          onClick={handleOpenBunkerPopup}
          disabled={!!popup}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          <span>
            {popup ? 'OpenBunker Login in Progress...' : 'Authenticate with OpenBunker'}
          </span>
        </button>
      </div>

      {popup && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            A new window has opened for OpenBunker authentication.
          </p>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-500">
          <strong>Secret Key:</strong> Use your existing Nostr secret key for direct authentication
        </p>
        <p className="text-sm text-gray-500 mt-1">
          <strong>OpenBunker:</strong> Use Discord OAuth to get a new Nostr key
        </p>
      </div>
    </div>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function OpenBunkerLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState<Window | null>(null);
  const { authenticateWithOpenBunker, checkOpenBunkerCallback } = useAuth();
  const router = useRouter();

  // Set up message listener for popup communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'openbunker-auth-success') {
        console.log('Received auth success message from popup:', event.data);
        handleOpenBunkerSuccess(event.data.secretKey);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Check for OpenBunker callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const secretKey = urlParams.get('secret_key');
    const error = urlParams.get('error');
    console.log('handleOpenBunkerSuccess', secretKey, error);
    if (secretKey) {
      handleOpenBunkerSuccess(secretKey);
    } else if (error) {
      setError('OpenBunker authentication failed. Please try again.');
    }
  }, []);

  const handleOpenBunkerSuccess = async (secretKey: string) => {
    setLoading(true);
    setError('');

    try {
      await checkOpenBunkerCallback(secretKey);
      
      console.log('handleOpenBunkerSuccess', secretKey);
      // Check if we're in a popup window
      if (window.opener && !window.opener.closed) {
        // We're in a popup - post message to parent and close
        console.log('handleOpenBunkerSuccess', window.opener);
        try {
          window.opener.postMessage({
            type: 'openbunker-auth-success',
            secretKey: secretKey
          }, window.location.origin);
          window.close();
        } catch (err) {
          console.error('Failed to communicate with parent window:', err);
          // Fallback to redirect
          router.push('/');
        }
      } else {
        // Not in a popup - redirect normally
        router.push('/');
      }
    } catch (err) {
      setError('Failed to complete OpenBunker authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBunkerAuth = async () => {
    setLoading(true);
    setError('');

    try {
      const authUrl = await authenticateWithOpenBunker();
      
      // Open popup window (both development and production)
      const popupWindow = window.open(
        authUrl,
        'openbunker-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (popupWindow) {
        setPopup(popupWindow);

        // Check if popup is closed
        const checkClosed = setInterval(() => {
          if (popupWindow.closed) {
            clearInterval(checkClosed);
            setPopup(null);
            setLoading(false);
          }
        }, 1000);
      } else {
        setError('Popup blocked. Please allow popups and try again.');
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to start OpenBunker authentication. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Authenticate with OpenBunker
        </h2>
        <p className="text-gray-600">
          Use Discord OAuth to get a new Nostr key
        </p>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 p-2 bg-yellow-100 rounded-lg">
            <p className="text-sm text-yellow-800">
              🧪 Development mode: OAuth flow will be simulated
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleOpenBunkerAuth}
          disabled={loading || !!popup}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          <span>
            {loading 
              ? (process.env.NODE_ENV === 'development' ? 'Opening simulated OAuth...' : 'Opening OpenBunker...') 
              : popup 
                ? 'Authentication in progress...' 
                : 'Start Discord OAuth'
            }
          </span>
        </button>

        {popup && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              A new window has opened for authentication. Please complete the Discord OAuth flow.
              {process.env.NODE_ENV === 'development' && (
                <span className="block text-xs text-yellow-600 mt-1">
                  🧪 Development mode: OAuth is simulated in the popup
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          <strong>How it works:</strong> You'll be redirected to Discord for OAuth, then receive a new Nostr key from OpenBunker.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-yellow-600 mt-1">
            <strong>Dev mode:</strong> OAuth flow is simulated in a popup window for realistic testing.
          </p>
        )}
      </div>
    </div>
  );
} 
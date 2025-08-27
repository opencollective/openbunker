'use client';

import KeySelector from '@/components/KeySelector';
import SessionSelector from '@/components/SessionSelector';
import { useAuth } from '@/contexts/AuthContext';
import { Session } from '@supabase/supabase-js';
import { nip19 } from 'nostr-tools';
import { useState } from 'react';

interface UserKey {
  id: string;
  userId: string;
  npub: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  key: {
    npub: string;
    name?: string;
    avatar?: string;
    relays?: string[];
    email?: string;
  };
}

type Step = 'session' | 'key';

export default function OpenBunkerLoginPopup() {
  const [currentStep, setCurrentStep] = useState<Step>('session');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedKey, setSelectedKey] = useState<UserKey | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSessionSelected = (session: Session) => {
    setSelectedSession(session);
    setCurrentStep('key');
  };

  const validateBunkerUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.protocol === 'bunker:' &&
        urlObj.searchParams.has('relay') &&
        urlObj.searchParams.has('secret')
      );
    } catch {
      return false;
    }
  };

  const handleKeySelected = async (key: UserKey) => {
    // Prevent multiple simultaneous token creation attempts
    if (isCreatingToken) {
      console.log('Token creation already in progress, ignoring request');
      return;
    }

    console.log('Key selected:', key);
    setSelectedKey(key);
    setIsCreatingToken(true);
    setTokenError(null);
    setTokenSuccess(null);

    try {
      // Check if user is authenticated
      if (!user) {
        throw new Error(
          'You must be authenticated to create a connection token'
        );
      }

      console.log('User authenticated:', user.id);

      // Check if the key belongs to the current user
      if (key.userId !== user.id) {
        throw new Error("You don't have access to this key");
      }

      // Check if the key is active
      if (!key.isActive) {
        throw new Error('This key is not active and cannot be used');
      }

      // Check if the key has valid tokens (optional - could be useful for user feedback)
      console.log('Key access verified');

      const npub = key.key.npub;
      if (!npub) {
        throw new Error('Invalid key: missing npub');
      }

      console.log('Creating connection token for npub:', npub);

      let hex: string;
      try {
        hex = nip19.decode(npub).data as string;
        console.log('Decoded hex:', hex);
      } catch (decodeError) {
        throw new Error('Invalid key: could not decode npub:' + decodeError);
      }

      // Call the API to create a connection token
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(`/api/keys/${npub}/connection-tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = 'Failed to create connection token';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If we can't parse the error response, use the status text
            errorMessage = response.statusText || errorMessage;
          }

          if (response.status === 401) {
            errorMessage = 'Authentication required. Please sign in again.';
          } else if (response.status === 403) {
            errorMessage =
              "Access denied. You don't have permission to use this key.";
          } else if (response.status === 404) {
            errorMessage = 'Key not found or access denied.';
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Token creation response:', data);

        const token = data.token?.token;

        if (!token) {
          throw new Error('Invalid response: missing token data');
        }

        console.log('Connection token created successfully:', token);

        // Get the relay URL with fallback
        const relayUrl =
          process.env.NEXT_PUBLIC_BUNKER_RELAYS || 'wss://relay.nsec.app';
        console.log('Using relay URL:', relayUrl);

        // Create the bunker URL
        // FIXME
        const bunkerUrl = `bunker://${hex}?relay=${encodeURIComponent(relayUrl)}&secret=${token}`;

        // Validate the bunker URL
        if (!validateBunkerUrl(bunkerUrl)) {
          throw new Error('Invalid bunker URL format');
        }

        console.log('Bunker URL created and validated:', bunkerUrl);

        // Now we have both session and key, proceed with authentication
        setTokenSuccess(
          'Connection token created successfully! Redirecting...'
        );

        // Show success message briefly before proceeding
        setTimeout(() => {
          console.log('Proceeding with popup callback');
          handlePopupCallback(bunkerUrl);
        }, 1000);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error creating connection token:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to create connection token';
      console.error('Setting error message:', errorMessage);
      setTokenError(errorMessage);
    } finally {
      console.log('Token creation process completed');
      setIsCreatingToken(false);
    }
  };

  const handleBackToSession = () => {
    setCurrentStep('session');
    setSelectedKey(null);
    setTokenError(null);
    setTokenSuccess(null);
  };

  const handlePopupCallback = (bunkerConnectionToken: string) => {
    // Check if we're in a popup window
    if (window.opener && !window.opener.closed) {
      // We're in a popup - communicate with parent via postMessage
      try {
        // Use postMessage as the primary communication method to avoid cross-origin issues
        window.opener.postMessage(
          {
            type: 'openbunker-auth-success',
            secretKey: bunkerConnectionToken,
          },
          '*' // Allow any origin for cross-origin communication
        );

        // Close the popup
        window.close();
      } catch (err) {
        console.error('Failed to communicate with parent window:', err);
        // Fallback to redirect
        const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(bunkerConnectionToken)}`;
        window.location.href = loginUrl;
      }
    } else {
      console.log('Not in a popup - redirect to login page');
      // Not in a popup - redirect to login page
      const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(bunkerConnectionToken)}`;
      window.location.href = loginUrl;
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center space-x-4">
          <div
            className={`flex items-center ${currentStep === 'session' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'session'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              1
            </div>
            <span className="ml-2 text-sm font-medium">Session</span>
          </div>
          <div className="w-8 h-1 bg-gray-200 rounded"></div>
          <div
            className={`flex items-center ${currentStep === 'key' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'key'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              2
            </div>
            <span className="ml-2 text-sm font-medium">Key</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              OpenBunker
            </h1>
            <p className="text-gray-600">Authentication Setup</p>
          </div>

          {renderStepIndicator()}

          <div className="bg-white rounded-2xl shadow-xl p-6">
            {currentStep === 'session' ? (
              <SessionSelector onSessionSelected={handleSessionSelected} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Choose Key
                  </h3>
                  <button
                    onClick={handleBackToSession}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to session
                  </button>
                </div>

                {selectedSession && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedSession.user.user_metadata?.full_name ||
                            selectedSession.user.user_metadata?.name ||
                            selectedSession.user.email?.split('@')[0] ||
                            'User'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {selectedSession.user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <KeySelector
                  onKeySelected={handleKeySelected}
                  selectedKeyId={selectedKey?.id}
                  disabled={isCreatingToken}
                />

                {isCreatingToken && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    <span>Creating connection token...</span>
                  </div>
                )}
                {tokenError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-5 h-5 text-red-500"
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
                      <span className="text-red-800 text-sm font-medium">
                        Error creating token
                      </span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{tokenError}</p>
                    <button
                      onClick={() =>
                        selectedKey && handleKeySelected(selectedKey)
                      }
                      className="mt-3 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
                {tokenSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-green-800 text-sm font-medium">
                        {tokenSuccess}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              {currentStep === 'session'
                ? 'Select your Discord session to continue'
                : 'Choose a Nostr key to complete authentication'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import KeySelector from '@/components/KeySelector';
import OpenBunkerLogin from '@/components/OpenBunkerLogin';
import { useAuth } from '@/contexts/AuthContext';
import { OpenBunkerAuthMessage } from '@/types/openbunkerApiTypes';
import {
  isValidNostrConnectToken,
  ParsedNostrConnectURI,
  parseNostrConnectURI,
  validateBunkerUrl,
} from '@/utils/nip46Utils';
import { Keys } from '@prisma/client';
import { useSearchParams } from 'next/navigation';
import { nip19 } from 'nostr-tools';
import { Suspense, useEffect, useState } from 'react';

function OpenBunkerLoginPopupContent() {
  const [selectedKey, setSelectedKey] = useState<Keys | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);
  const [scopeSlug, setScopeSlug] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<
    'bunker' | 'nostrconnect'
  >('bunker');
  const [connectionToken, setConnectionToken] = useState<string | null>(null);
  const [parsedConnectionToken, setParsedConnectionToken] =
    useState<ParsedNostrConnectURI | null>(null);
  // Redirect URL, if not defined, we are in popup mode
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();

  // Parse scope, connectionMode, and connectionToken parameters from URL
  useEffect(() => {
    const scope = searchParams.get('scope');
    // const mode = searchParams.get('connectionMode');
    const token = searchParams.get('connectionToken');
    const mode = token ? 'nostrconnect' : 'bunker';
    const redirectUrl = searchParams.get('redirectUrl');

    setRedirectUrl(redirectUrl);

    if (scope) {
      setScopeSlug(scope);
    }

    // nostrconnect mode
    if (token) {
      // Validate the connection token format
      if (!isValidNostrConnectToken(token)) {
        console.warn(
          'Invalid NostrConnect token format, falling back to bunker mode'
        );
        setConnectionMode('bunker');
        return;
      }

      // Parse the token to get the connection details
      try {
        const parsed = parseNostrConnectURI(token);
        setParsedConnectionToken(parsed);
        console.log(
          'Valid NostrConnect token provided, using nostrconnect mode'
        );
      } catch (parseError) {
        console.warn(
          'Failed to parse NostrConnect token, falling back to bunker mode',
          parseError
        );
        setConnectionMode('bunker');
        return;
      }

      setConnectionToken(token);
      setConnectionMode('nostrconnect');
    }
    setConnectionMode(mode);
  }, [searchParams]);

  const handleKeySelected = async (key: Keys) => {
    // Prevent multiple simultaneous token creation attempts
    if (isCreatingToken) {
      console.log('Token creation already in progress, ignoring request');
      return;
    }

    console.log('Key selected:', key, 'Connection mode:', connectionMode);
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

      // Check if the key belongs to the current user
      if (key.email !== user.email) {
        throw new Error("You don't have access to this key");
      }

      // Use the user's key for connection token creation
      const userNpub = key.npub;
      console.log('Using user key for connection token:', userNpub);

      if (connectionMode === 'nostrconnect') {
        // Handle nostrconnect mode - it handles its own errors internally
        await handleNostrConnectMode(key);
      } else {
        // Handle bunker mode
        await handleBunkerMode(key, userNpub);
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
      // Only reset loading state for bunker mode, nostrconnect handles its own
      if (connectionMode !== 'nostrconnect') {
        console.log('Token creation process completed');
        setIsCreatingToken(false);
      }
    }
  };

  const handleBunkerMode = async (key: Keys, userNpub: string) => {
    // Get the scope slug from the user metadata
    // This assumes the session is already set and we can access user metadata
    const scopeSlug = key?.scopeSlug;

    let scopeNpub: string;
    console.log('Scope slug:', scopeSlug);

    if (scopeSlug) {
      // Fetch the scope to get its npub
      const scopeResponse = await fetch(`/api/scopes/${scopeSlug}`);
      if (!scopeResponse.ok) {
        throw new Error('Failed to fetch scope information');
      }

      const scopeData = await scopeResponse.json();
      const scope = scopeData.scope;
      if (!scope || !scope.key || !scope.key.npub) {
        throw new Error('Invalid scope: missing npub');
      }

      scopeNpub = scope.key.npub;
      console.log('Using scope npub for bunker URL:', scopeNpub);
    } else {
      // Use BUNKER_NPUB environment variable as fallback
      const bunkerNpub = process.env.NEXT_PUBLIC_BUNKER_NPUB;
      if (!bunkerNpub) {
        throw new Error(
          'No scope associated with this session and BUNKER_NPUB not configured'
        );
      }
      scopeNpub = bunkerNpub;
      console.log('Using BUNKER_NPUB for bunker URL:', scopeNpub);
    }

    // Call the API to create a connection token using the user's key
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`/api/keys/${userNpub}/connection-tokens`, {
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

      // Decode the scope's npub to get the hex
      let scopeHex: string;
      try {
        scopeHex = nip19.decode(scopeNpub).data as unknown as string;
        console.log('Decoded scope hex:', scopeHex);
      } catch (decodeError) {
        throw new Error(
          'Invalid scope npub: could not decode: ' + String(decodeError)
        );
      }

      // Get the relay URL with fallback
      const relayUrl =
        process.env.NEXT_PUBLIC_BUNKER_RELAYS || 'wss://relay.nsec.app';

      // Create the bunker URL using the scope's npub
      const bunkerUrl = `bunker://${scopeHex}?relay=${encodeURIComponent(relayUrl)}&secret=${token}`;

      // Validate the bunker URL
      if (!validateBunkerUrl(bunkerUrl)) {
        throw new Error('Invalid bunker URL format');
      }

      console.log('Bunker URL created and validated:', bunkerUrl);

      // Now we have both session and key, proceed with authentication
      setTokenSuccess('Connection token created successfully! Redirecting...');

      // Show success message briefly before proceeding
      setTimeout(() => {
        console.log('Proceeding with popup callback');
        handlePopupCallback({
          type: 'openbunker-auth-success',
          connectionMode: 'bunker',
          secretKey: bunkerUrl,
        });
      }, 1000);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw fetchError;
    }
  };

  const handleNostrConnectMode = async (key: Keys) => {
    // Validate that we have a connection token and parsed data
    if (!connectionToken || !parsedConnectionToken) {
      throw new Error(
        'No connection token or parsed data provided for NostrConnect mode'
      );
    }

    // Call the API to create a nostrconnect response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`/api/keys/${key.npub}/nostrconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionToken: connectionToken,
          scope: key.scopeSlug,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Failed to create nostrconnect response';
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

        // Send error message via popup callback
        setTimeout(() => {
          console.log('Proceeding with nostrconnect popup callback (error)');
          handlePopupCallback({
            type: 'openbunker-auth-success',
            connectionMode: 'nostrconnect',
            success: false,
            errorMessage: errorMessage,
          });
        }, 1000);
        return;
      }

      const data = await response.json();
      console.log('NostrConnect response:', data);

      // Show success message briefly before proceeding
      setTokenSuccess(
        'NostrConnect response created successfully! Redirecting...'
      );

      // Show success message briefly before proceeding
      setTimeout(() => {
        console.log('Proceeding with nostrconnect popup callback (success)');
        handlePopupCallback({
          type: 'openbunker-auth-success',
          connectionMode: 'nostrconnect',
          success: true,
        });
      }, 1000);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      let errorMessage = 'Request timed out. Please try again.';

      if (fetchError instanceof Error && fetchError.name !== 'AbortError') {
        errorMessage = fetchError.message;
      }

      // Send error message via popup callback
      setTimeout(() => {
        console.log(
          'Proceeding with nostrconnect popup callback (catch error)'
        );
        handlePopupCallback({
          type: 'openbunker-auth-success',
          connectionMode: 'nostrconnect',
          success: false,
          errorMessage: errorMessage,
        });
      }, 1000);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // The AuthContext will handle the state update and redirect
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handlePopupCallback = (message: OpenBunkerAuthMessage) => {
    // Check if we're in redirect mode
    if (redirectUrl) {
      console.log('Redirect mode - redirecting to:', redirectUrl);

      // Convert message parameters to URL parameters
      const urlParams = new URLSearchParams();

      // Add common parameters
      urlParams.set('type', message.type);
      urlParams.set('connectionMode', message.connectionMode);

      // Add specific parameters based on connection mode
      if (message.connectionMode === 'bunker') {
        urlParams.set('secretKey', message.secretKey);
      } else if (message.connectionMode === 'nostrconnect') {
        urlParams.set('success', message.success.toString());
        if (message.errorMessage) {
          urlParams.set('errorMessage', message.errorMessage);
        }
      }

      // Construct the final redirect URL with parameters
      const separator = redirectUrl.includes('?') ? '&' : '?';
      const finalUrl = `${redirectUrl}${separator}${urlParams.toString()}`;

      console.log('Final redirect URL:', finalUrl);

      // Redirect to the specified URL with parameters
      window.location.href = finalUrl;
      return;
    }

    // Check if we're in a popup window
    if (window.opener && !window.opener.closed) {
      // We're in a popup - communicate with parent via postMessage
      try {
        // Use postMessage as the primary communication method to avoid cross-origin issues
        window.opener.postMessage(message, '*'); // Allow any origin for cross-origin communication

        // Close the popup
        window.close();
      } catch (err) {
        console.error('Failed to communicate with parent window:', err);
        // Fallback to redirect to login page
        window.location.href = `${window.location.origin}/login`;
      }
    } else {
      console.log('Not in a popup - redirect to login page');
      // Not in a popup - redirect to login page
      window.location.href = `${window.location.origin}/login`;
    }
  };

  // If user is not authenticated, show the login component
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                OpenBunker
              </h1>
              <p className="text-gray-600">Authenticate to continue</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <OpenBunkerLogin isInPopup={true} />
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Please authenticate to access your Nostr identities for{' '}
                {connectionMode === 'bunker' ? 'bunker' : 'NostrConnect'} mode
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              OpenBunker
            </h1>
            <p className="text-gray-600">Choose your Nostr identity</p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  connectionMode === 'bunker'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {connectionMode === 'bunker'
                  ? 'Bunker Mode'
                  : 'NostrConnect Mode'}
              </span>
              {searchParams.get('connectionMode') === 'nostrconnect' &&
                connectionMode === 'bunker' && (
                  <div className="mt-1">
                    <span className="text-xs text-amber-600">
                      Invalid NostrConnect token, using Bunker mode
                    </span>
                  </div>
                )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Choose Identity
              </h3>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
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
                        {user.user_metadata?.full_name ||
                          user.user_metadata?.name ||
                          user.email?.split('@')[0] ||
                          'User'}
                      </p>
                      <p className="text-xs text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-200"
                    title="Logout"
                  >
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
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <KeySelector
                onKeySelected={handleKeySelected}
                selectedKeyId={selectedKey?.npub}
                disabled={isCreatingToken}
                scopeSlug={scopeSlug}
              />

              {isCreatingToken && (
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span>
                    {connectionMode === 'bunker'
                      ? 'Creating connection token...'
                      : 'Creating NostrConnect response...'}
                  </span>
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
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Choose a Nostr identity to complete{' '}
              {connectionMode === 'bunker' ? 'bunker' : 'NostrConnect'}{' '}
              authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpenBunkerLoginPopup() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  OpenBunker
                </h1>
                <p className="text-gray-600">Loading...</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span>Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <OpenBunkerLoginPopupContent />
    </Suspense>
  );
}

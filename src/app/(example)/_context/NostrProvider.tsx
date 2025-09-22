'use client';

import type { OpenBunkerAuthMessage } from '@/types/openbunkerApiTypes';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type Event,
  type UnsignedEvent,
  type VerifiedEvent,
} from 'nostr-tools';
import React, { useCallback, useMemo, useState } from 'react';
import {
  openBunkerApi,
  parseAuthMessageFromUrl,
  type OpenBunkerAuthSuccessEvent,
} from '../_api/openbunker';
import { useBunkerAuthState } from '../_hooks/useBunkerAuthState';
import { useEventQueue } from '../_hooks/useEventQueue';
import { useNostrConnectionState } from '../_hooks/useNostrConnectionState';
import { useSecretKeyAuthState } from '../_hooks/useSecretKeyAuthState';
import {
  bunkerSignerfromURI,
  createNostrConnectURI,
} from '../_utils/nip46Utils';
import { NostrContext, type NostrContextType } from './NostrContext';

// Callbacks for authenticated operations
export interface AuthenticatedCallbacks {
  logout: () => Promise<void>;
  sendVerifiedEvent: (event: VerifiedEvent) => Promise<Event>;
  submitEvent: (event: UnsignedEvent) => string; // Returns the queue item ID
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  // Use custom hooks for different state management
  const connectionState = useNostrConnectionState();
  const secretKeyAuth = useSecretKeyAuthState();
  const bunkerAuth = useBunkerAuthState();

  // Openbunker specific
  const [error] = useState<string | null>(null);
  const [popup, setPopup] = useState<Window | null>(null);

  const hasSigningMethod = useMemo(
    () => !!secretKeyAuth.localSecretKey || !!bunkerAuth.bunkerSigner,
    [secretKeyAuth.localSecretKey, bunkerAuth.bunkerSigner]
  );

  const isConfigured = useMemo(
    () =>
      !!secretKeyAuth.localSecretKey ||
      !!bunkerAuth.bunkerConnectionConfiguration,
    [secretKeyAuth.localSecretKey, bunkerAuth.bunkerConnectionConfiguration]
  );

  // Send event (requires authentication)
  const sendVerifiedEvent = useCallback(
    async (event: Event) => {
      if (!connectionState.pool) {
        throw new Error('No pool available');
      }

      try {
        await connectionState.pool.publish(connectionState.relays, event);
        console.log('Event published successfully');
      } catch (err) {
        console.error('Failed to publish event:', err);
        // Note: Error handling is now managed in the secret key auth state
      }
      return event;
    },
    [connectionState.pool, connectionState.relays]
  );

  // Sign and send event (placeholder - implement based on your needs)
  const signAndSendEvent = useCallback(
    async (event: UnsignedEvent) => {
      // Event needs to be signed first
      if (secretKeyAuth.localSecretKey) {
        const signedEvent = finalizeEvent(
          {
            kind: event.kind,
            content: event.content,
            tags: event.tags,
            created_at: event.created_at,
          },
          secretKeyAuth.localSecretKey
        );

        return sendVerifiedEvent(signedEvent);
      } else if (bunkerAuth.bunkerSigner) {
        // Sign with bunker signer
        const signedEvent = await bunkerAuth.bunkerSigner.signEvent({
          kind: event.kind,
          content: event.content,
          tags: event.tags,
          created_at: event.created_at,
        });

        return sendVerifiedEvent(signedEvent);
      } else {
        throw new Error('No signing method available');
      }
    },
    [secretKeyAuth.localSecretKey, bunkerAuth.bunkerSigner, sendVerifiedEvent]
  );

  // Initialize event queue with the sendEvent function
  const eventQueue = useEventQueue(signAndSendEvent);

  // Logout function that clears all states
  const logout = useCallback(async () => {
    await Promise.all([
      secretKeyAuth.secretKeyLogout(),
      bunkerAuth.bunkerLogout(),
    ]);
    eventQueue.clearQueue();
  }, [secretKeyAuth, bunkerAuth, eventQueue]);

  // New submitEvent function that adds events to the queue
  const submitEvent = useCallback(
    (event: UnsignedEvent) => {
      const queueItemId = eventQueue.addToQueue(event);
      console.log('Event added to queue:', event, 'with ID:', queueItemId);
      return queueItemId;
    },
    [eventQueue]
  );

  // Handle URL-based authentication messages
  const handleUrlAuthMessage = useCallback(
    async (authMessage: OpenBunkerAuthMessage) => {
      try {
        console.log('Processing URL auth message:', authMessage);

        if (authMessage.connectionMode === 'bunker') {
          const sk = generateSecretKey();
          await bunkerAuth.handleBunkerConnectionToken(
            authMessage.secretKey,
            sk
          );
          console.log('Bunker connection established via URL');
        } else if (authMessage.connectionMode === 'nostrconnect') {
          if (authMessage.success) {
            console.log('NostrConnect authentication successful via URL');

            // Check if we have stored data from a redirect flow
            const storedSecretKey = sessionStorage.getItem(
              'nostrconnect-local-secret-key'
            );
            const storedConnectionUri = sessionStorage.getItem(
              'nostrconnect-connection-uri'
            );

            if (storedSecretKey && storedConnectionUri) {
              try {
                // Parse the stored secret key
                const localSecretKey = new Uint8Array(
                  JSON.parse(storedSecretKey)
                );

                // Create bunker signer from the stored connection URI
                const bunkerSigner = await bunkerSignerfromURI(
                  localSecretKey,
                  storedConnectionUri
                );

                // Connect with the bunker signer
                await bunkerAuth.connected(bunkerSigner, localSecretKey);

                // Clean up stored data
                sessionStorage.removeItem('nostrconnect-local-secret-key');
                sessionStorage.removeItem('nostrconnect-connection-uri');

                console.log(
                  'NostrConnect redirect flow completed successfully'
                );
              } catch (err) {
                console.error(
                  'Failed to complete NostrConnect redirect flow:',
                  err
                );
              }
            } else {
              console.log(
                'NostrConnect success but no stored data found (likely popup flow)'
              );
            }
          } else {
            console.error(
              'NostrConnect authentication failed:',
              authMessage.errorMessage
            );
          }
        }
      } catch (err) {
        console.error('Failed to process URL auth message:', err);
      }
    },
    [bunkerAuth.handleBunkerConnectionToken, bunkerAuth.connected]
  );

  // Process queue when authentication becomes available
  React.useEffect(() => {
    if (isConfigured && eventQueue.queue.length > 0) {
      // Only process events if we have a signing method available

      if (hasSigningMethod) {
        // Try to process any pending events in the queue
        eventQueue.processQueue();
      }
    }
  }, [
    hasSigningMethod,
    isConfigured,
    eventQueue,
    secretKeyAuth.localSecretKey,
    bunkerAuth.bunkerSigner,
  ]);

  // Check for URL-based authentication on mount
  React.useEffect(() => {
    const authMessage = parseAuthMessageFromUrl();
    if (authMessage) {
      handleUrlAuthMessage(authMessage);
      // Clean up URL parameters after processing
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }
  }, [handleUrlAuthMessage]);

  const handleOpenBunkerSuccess = useCallback(
    async (openBunkerEvent: MessageEvent<OpenBunkerAuthSuccessEvent>) => {
      try {
        console.log(
          'OpenBunker authentication successful:',
          openBunkerEvent.data
        );
        const bunkerConnectionToken = openBunkerEvent.data.secretKey;
        const sk = generateSecretKey();
        // Await the bunker connection to ensure state is updated
        await bunkerAuth.handleBunkerConnectionToken(bunkerConnectionToken, sk);
        console.log('Bunker connection established');
      } catch (err) {
        console.error('Failed to complete OpenBunker authentication:', err);
      }
    },
    [bunkerAuth.handleBunkerConnectionToken]
  );

  const configureBunkerConnectionWithBunkerToken = useCallback(async () => {
    await openBunkerApi.openBunkerPopupOpen(
      setPopup,
      handleOpenBunkerSuccess as (
        _event: MessageEvent<OpenBunkerAuthSuccessEvent>
      ) => Promise<void>
    );
  }, [setPopup, handleOpenBunkerSuccess]);

  // New function for redirect-based authentication
  const configureBunkerConnectionWithRedirect = useCallback(
    async (redirectUrl: string) => {
      await openBunkerApi.redirectWithBunkerToken(redirectUrl);
    },
    []
  );

  // New function for NostrConnect redirect-based authentication
  const configureBunkerConnectionWithNostrConnectRedirect = useCallback(
    async (redirectUrl: string) => {
      const localSecretKey = generateSecretKey();
      const secret = Math.random().toString(36).substring(2, 15);

      const connectionUri = createNostrConnectURI({
        clientPubkey: getPublicKey(localSecretKey),
        relays: ['wss://relay.nsec.app'],
        secret: secret,
        name: 'OpenBunker Example',
      });

      // Store the local secret key for when we return from redirect
      // We'll need to handle this in the URL auth message handler
      sessionStorage.setItem(
        'nostrconnect-local-secret-key',
        JSON.stringify(Array.from(localSecretKey))
      );
      sessionStorage.setItem('nostrconnect-connection-uri', connectionUri);

      await openBunkerApi.redirectWithNostrConnect(connectionUri, redirectUrl);
    },
    []
  );

  /**
   * This will init the flow from scratch using nostrconnect
   */
  const configureBunkerConnectionWithNostrConnect = useCallback(async () => {
    const localSecretKey = generateSecretKey();
    const secret = Math.random().toString(36).substring(2, 15);

    const connectionUri = createNostrConnectURI({
      clientPubkey: getPublicKey(localSecretKey),
      relays: ['wss://relay.nsec.app'],
      secret: secret,
      name: 'OpenBunker Example',
    });

    const popupPromise = await openBunkerApi.openBunkerPopupNostrConnect(
      connectionUri,
      setPopup
    );
    // Wait for both the bunker connection and popup to complete
    const [bunkerSigner] = await Promise.all([
      bunkerSignerfromURI(localSecretKey, connectionUri),
      popupPromise,
    ]);
    console.log('bunkerSigner:', bunkerSigner);

    // If we get here, connection was successful
    await bunkerAuth.connected(bunkerSigner, localSecretKey);
  }, [bunkerAuth]);

  // Compute aggregated nostrStatus for display
  const nostrStatus = useMemo(() => {
    // If using bunker authentication, use bunker status
    if (bunkerAuth.bunkerStatus !== 'disconnected') {
      return bunkerAuth.bunkerStatus;
    }

    // If using local secret key authentication, check if we have a connection
    if (secretKeyAuth.localSecretKey) {
      return connectionState.isConnected ? 'connected' : 'disconnected';
    }

    // No authentication method configured
    return 'disconnected';
  }, [
    bunkerAuth.bunkerConnectionConfiguration,
    bunkerAuth.bunkerStatus,
    secretKeyAuth.localSecretKey,
    connectionState.isConnected,
  ]);

  const userPublicKey = useMemo(() => {
    let pubkey: string | null = null;

    if (secretKeyAuth.localSecretKey) {
      // Derive public key from local secret key
      try {
        pubkey = getPublicKey(secretKeyAuth.localSecretKey);
      } catch (err) {
        console.error('Failed to derive public key from secret key:', err);
      }
    } else if (
      bunkerAuth.bunkerSigner &&
      bunkerAuth.bunkerStatus === 'connected'
    ) {
      // Get public key from bunker auth state
      pubkey = bunkerAuth.bunkerConnectionConfiguration?.publicKey || null;
    }
    return pubkey;
  }, [
    secretKeyAuth.localSecretKey,
    bunkerAuth.bunkerConnectionConfiguration,
    bunkerAuth.bunkerSigner,
    bunkerAuth.bunkerStatus,
  ]);

  const value: NostrContextType = {
    // Pool and general Nostr connection state
    ...connectionState,

    isConfigured,
    userPublicKey,
    // Secret key authentication state
    ...secretKeyAuth,

    // Bunker authentication state
    ...bunkerAuth,

    // Event queue state
    ...eventQueue,

    // Computed nostrStatus for display
    nostrStatus,
    error,
    popup,
    configureBunkerConnectionWithNostrConnect,
    configureBunkerConnectionWithBunkerToken,
    configureBunkerConnectionWithRedirect,
    configureBunkerConnectionWithNostrConnectRedirect,
    // Callbacks
    logout,
    sendVerifiedEvent,
    submitEvent,
  };

  return (
    <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
  );
}

export function useNostr() {
  const context = React.useContext(NostrContext);
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
}

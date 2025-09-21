/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

// Define the context type here to avoid circular dependency
export interface NostrContextType {
  // Pool and general Nostr connection state
  pool: any;
  isConnected: boolean;
  relays: string[];
  error: string | null;

  // Secret key authentication state
  localSecretKey: Uint8Array | null;
  secretKeyError: string | null;
  secretKeyLogout: () => Promise<void>;
  setLocalSecretKey: (secretKey: Uint8Array) => void;

  // Bunker authentication state
  bunkerConnectionConfiguration: any;
  configureBunkerConnection: (
    token: string,
    secretKey: Uint8Array
  ) => Promise<any>;
  handleBunkerConnectionToken: (
    token: string,
    secretKey: Uint8Array
  ) => Promise<void>;
  connected: (signer: any, secretKey: Uint8Array) => Promise<void>;
  bunkerStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  bunkerError: string | null;
  bunkerSigner: any;
  bunkerLogout: () => Promise<void>;

  // Event queue state
  queue: any[];
  processedQueue: any[];
  isProcessing: boolean;
  addToQueue: (event: any) => string;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  getQueueItemById: (id: string) => any;
  processQueue: () => Promise<void>;

  // Computed aggregated nostr status for display
  nostrStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  popup: Window | null;
  isConfigured: boolean;
  userPublicKey: string | null;

  // Nostr connect flow
  configureBunkerConnectionWithNostrConnect: () => Promise<void>;
  configureBunkerConnectionWithBunkerToken: () => Promise<void>;
  configureBunkerConnectionWithRedirect: (redirectUrl: string) => Promise<void>;
  configureBunkerConnectionWithNostrConnectRedirect: (
    redirectUrl: string
  ) => Promise<void>;

  // Callbacks
  logout: () => Promise<void>;
  sendVerifiedEvent: (event: any) => Promise<any>;
  submitEvent: (event: any) => string;
}

export const NostrContext = createContext<NostrContextType | undefined>(
  undefined
);

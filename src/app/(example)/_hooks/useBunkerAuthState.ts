import {
  parseBunkerInput,
  toBunkerURL,
  type BunkerPointer,
} from 'nostr-tools/nip46';
import { useCallback, useEffect, useState } from 'react';
import { storage } from '../_hooks/bunkerStorage';
import { BunkerSigner } from '../_utils/nip46Utils';

export type BunkerConnectionConfiguration = {
  connectionToken: string;
  localSecretKey: Uint8Array;
  publicKey: string;
  bunkerPointer: BunkerPointer;
};

// Bunker authentication specific state
export interface BunkerAuthState {
  bunkerConnectionConfiguration: BunkerConnectionConfiguration | null;
  configureBunkerConnection: (
    bunkerConnectionToken: string,
    localSecretKey: Uint8Array
  ) => Promise<BunkerConnectionConfiguration>;
  handleBunkerConnectionToken: (
    bunkerConnectionToken: string,
    localSecretKey: Uint8Array
  ) => Promise<void>;
  connected: (
    bunkerSigner: BunkerSigner,
    localSecretKey: Uint8Array
  ) => Promise<void>;
  bunkerStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  bunkerError: string | null;
  bunkerSigner: BunkerSigner | null;
  bunkerLogout: () => Promise<void>;
}

export function useBunkerAuthState(): BunkerAuthState {
  const [bunkerStatus, setBunkerStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [bunkerError, setBunkerErrorState] = useState<string | null>(null);
  const [bunkerSigner, setBunkerSigner] = useState<BunkerSigner | null>(null);
  const [bunkerConnectionConfiguration, setBunkerConnectionConfiguration] =
    useState<BunkerConnectionConfiguration | null>(null);
  /**
   * Call this to configure the bunker without connecting using a bunker:// token
   */
  const configureBunkerConnection = useCallback(
    async (
      bunkerConnectionToken: string,
      localSecretKey: Uint8Array
    ): Promise<BunkerConnectionConfiguration> => {
      const bunkerPointer = await parseBunkerInput(bunkerConnectionToken);
      if (!bunkerPointer) {
        throw new Error('Invalid bunker input');
      }
      const bunkerConnectionConfiguration = {
        connectionToken: bunkerConnectionToken,
        localSecretKey: localSecretKey,
        publicKey: bunkerPointer.pubkey,
        bunkerPointer: bunkerPointer,
      };
      setBunkerConnectionConfiguration(bunkerConnectionConfiguration);
      return bunkerConnectionConfiguration;
    },
    []
  );

  const connected = useCallback(
    async (bunkerSigner: BunkerSigner, localSecretKey: Uint8Array) => {
      setBunkerSigner(bunkerSigner);
      setBunkerStatus('connected');
      setBunkerErrorState(null);

      const bunkerConnectionToken = toBunkerURL(bunkerSigner.bp);
      await storage.saveBunkerToken(bunkerConnectionToken);
      await storage.saveBunkerLocalSecretKey(localSecretKey);
      await storage.saveBunkerPublicKey(bunkerSigner.bp.pubkey);
    },
    []
  );

  const error = useCallback((error: string) => {
    setBunkerStatus('error');
    setBunkerErrorState(error);
  }, []);

  const disconnected = useCallback(() => {
    setBunkerStatus('disconnected');
    setBunkerErrorState(null);
    setBunkerSigner(null);
    setBunkerConnectionConfiguration(null);
  }, []);

  const connectToBunker = useCallback(
    async (bunkerSigner: BunkerSigner, timeoutMs: number) => {
      try {
        console.log(
          'Connecting to bunker: client-pubkey',
          bunkerSigner.bp.pubkey,
          'signer',
          bunkerSigner.bp.pubkey
        );

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
        });

        // Race between connection and timeout
        const connectPromise = bunkerSigner.connect();
        await Promise.race([connectPromise, timeoutPromise]);
      } catch (err) {
        console.error('Failed to connect to bunker:', err);
        error(
          err instanceof Error ? err.message : 'Failed to connect to bunker'
        );
      }
    },
    [connected, error]
  );

  const connectToBunkerWithRetry = useCallback(
    async (
      bunkerConnectionConfiguration: BunkerConnectionConfiguration,
      timeoutMs: number
    ) => {
      if (bunkerStatus === 'connecting') {
        return;
      }
      setBunkerErrorState(null);
      setBunkerStatus('connecting');
      // Automatically attempt to reconnect when data is loaded from storage
      try {
        // Retry connection with timeout - up to 3 attempts
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const bunkerSigner = BunkerSigner.fromBunker(
              bunkerConnectionConfiguration.localSecretKey,
              bunkerConnectionConfiguration.bunkerPointer
            );
            console.log(`Connection attempt ${attempt}/${maxRetries}`);
            await connectToBunker(bunkerSigner, timeoutMs);
            // If we get here, connection was successful
            connected(
              bunkerSigner,
              bunkerConnectionConfiguration.localSecretKey
            );
            console.log('Bunker auto-reconnection successful');

            return; // Exit the function successfully
          } catch (err) {
            lastError =
              err instanceof Error
                ? err
                : new Error('Unknown connection error');
            console.error(
              `Bunker auto-reconnection attempt ${attempt} failed:`,
              lastError.message
            );

            if (attempt < maxRetries) {
              // Wait before retrying (exponential backoff)
              const delayMs = Math.min(
                1000 * Math.pow(2, attempt - 1),
                timeoutMs
              );
              console.log(`Waiting ${delayMs}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

        // If we get here, all attempts failed
        error(
          `Failed to auto-reconnect to bunker after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
        );
      } catch (reconnectErr) {
        console.error('Failed to auto-reconnect bunker:', reconnectErr);
        error(
          reconnectErr instanceof Error
            ? reconnectErr.message
            : 'Failed to auto-reconnect bunker'
        );
      }
    },
    [bunkerConnectionConfiguration, disconnected, error, connectToBunker]
  );

  // Load bunker data from storage on mount
  useEffect(() => {
    const loadStoredBunkerData = async () => {
      try {
        console.log('loadStoredBunkerData');
        const [token, secretKey, publicKey] = await Promise.all([
          storage.loadBunkerToken(),
          storage.loadBunkerLocalSecretKey(),
          storage.loadBunkerPublicKey(),
        ]);
        if (token && secretKey && publicKey) {
          const bunkerConnectionConfiguration = await configureBunkerConnection(
            token,
            secretKey
          );
          if (!bunkerConnectionConfiguration) {
            console.warn('Bunker not configured');
            disconnected();
            return;
          }
          await connectToBunkerWithRetry(bunkerConnectionConfiguration, 10000);
        }
        console.log(token, secretKey, publicKey);
      } catch (error) {
        console.error('Failed to load bunker data from storage:', error);
      }
    };

    loadStoredBunkerData();
  }, []);

  const handleBunkerConnectionToken = useCallback(
    async (bunkerConnectionToken: string, localSecretKey: Uint8Array) => {
      try {
        console.log('handleBunkerConnectionToken');
        const bunkerConnectionConfiguration = await configureBunkerConnection(
          bunkerConnectionToken,
          localSecretKey
        );
        if (!bunkerConnectionConfiguration) {
          disconnected();
          console.warn('Bunker not configured');
          return;
        }

        await connectToBunkerWithRetry(bunkerConnectionConfiguration, 10000);
      } catch (err) {
        console.error('Failed to handle bunker connection token:', err);
        error(
          err instanceof Error
            ? err.message
            : 'Failed to setup bunker connection'
        );
      }
    },
    [configureBunkerConnection, connectToBunkerWithRetry, disconnected, error]
  );

  const bunkerLogout = useCallback(async () => {
    disconnected();
    setBunkerSigner(null);
    setBunkerConnectionConfiguration(null);
    // Clear from storage
    await storage.clearAll();
  }, []);

  return {
    bunkerConnectionConfiguration,
    configureBunkerConnection,
    handleBunkerConnectionToken,
    connected,
    bunkerStatus,
    bunkerError,
    bunkerSigner,
    bunkerLogout,
  };
}

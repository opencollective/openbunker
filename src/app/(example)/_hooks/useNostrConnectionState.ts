import { SimplePool } from 'nostr-tools';
import { useEffect, useRef, useState } from 'react';

const relays = [
  'wss://relay.chorus.community',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

// Pool and general Nostr connection state (no authentication required)
export interface NostrConnectionState {
  pool: SimplePool | null;
  isConnected: boolean;
  relays: string[];
  error: string | null;
}

export function useNostrConnectionState(): NostrConnectionState {
  const [pool, setPool] = useState<SimplePool | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const poolRef = useRef<SimplePool | null>(null);

  // Initialize Nostr pool
  useEffect(() => {
    const initPool = async () => {
      try {
        const newPool = new SimplePool();
        setPool(newPool);
        poolRef.current = newPool;
        setIsConnected(true);
        setConnectionError(null);
      } catch {
        setConnectionError('Failed to connect to Nostr relays');
        setIsConnected(false);
      }
    };

    // Initialize pool on mount
    initPool();

    return () => {
      if (poolRef.current) {
        poolRef.current.close(relays);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  return {
    pool,
    isConnected,
    relays,
    error: connectionError,
  };
}

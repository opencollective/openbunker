'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SimplePool, Event, Filter } from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'

interface NostrContextType {
  localSecretKey: Uint8Array | null;
  bunkerConnectionToken: string | null;
  setBunkerConnectionToken: (token: string) => void;
  setLocalSecretKey: (sk: Uint8Array) => void;
  handleBunkerConnectionToken: (bunkerConnectionToken: string, localSecretKey: Uint8Array) => void;

  isConnected: boolean;
  events: Event[];
  sendEvent: (event: Event) => void;
  subscribeToEvents: (filter: Filter) => void;
  clearEvents: () => void;
  error: string | null;
}

const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine'
];
const NostrContext = createContext<NostrContextType | undefined>(undefined);

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [pool, setPool] = useState<SimplePool | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localSecretKey, setLocalSecretKey] = useState<Uint8Array | null>(null);
  const [bunkerConnectionToken, setBunkerConnectionToken] = useState<string | null>(null);

  // Initialize Nostr pool
  useEffect(() => {
    const initPool = async () => {
      try {
        const { SimplePool } = await import('nostr-tools/pool');
        const newPool = new SimplePool();
        setPool(newPool);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize Nostr pool:', err);
        setError('Failed to connect to Nostr relays');
        setIsConnected(false);
      }
    };

    initPool();

    return () => {
      if (pool) {
        pool.close(relays);
      }
    };
  }, []);

  const handleBunkerConnectionToken = useCallback(async (newBunkerConnectionToken: string, newLocalSecretKey: Uint8Array) => {
    setBunkerConnectionToken(newBunkerConnectionToken);
    setLocalSecretKey(newLocalSecretKey);
    // parse a bunker URI
    const bunkerPointer = await parseBunkerInput(newBunkerConnectionToken)
    if (!bunkerPointer) {
      throw new Error('Invalid bunker input:' + newBunkerConnectionToken)
    }
    let newPool = pool;
    if (newPool === null) {
      newPool = new SimplePool();
      setPool(newPool);
      console.log('Pool initialized')
      setIsConnected(true);
      setError(null);
    }
    console.log('Bunker pointer:', bunkerPointer);
    console.log(bunkerPointer.relays);
    const bunker = new BunkerSigner(newLocalSecretKey, bunkerPointer, { pool: newPool })
    await bunker.connect();
    console.log('Bunker connected');
    setIsConnected(true);
  }, []);
  // Subscribe to events
  const subscribeToEvents = useCallback((filter: Filter) => {
    if (!pool) return;

    try {
      const sub = pool.subscribe(relays, filter, {
        onevent(event) {
          console.log('Received Nostr event:', event);
          setEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
        },
        oneose() {
          console.log('Subscription ended');
        }
      });

      return () => {
        sub.close();
      };
    } catch (err) {
      console.error('Failed to subscribe to events:', err);
      setError('Failed to subscribe to Nostr events');
    }
  }, [pool]);

  // Send event
  const sendEvent = useCallback(async (event: Event) => {
    if (!pool) return;

    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.snort.social',
      'wss://nostr.wine'
    ];

    try {
      await pool.publish(relays, event);
      console.log('Event published successfully');
    } catch (err) {
      console.error('Failed to publish event:', err);
      setError('Failed to publish event');
    }
  }, [pool]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const value: NostrContextType = {
    isConnected,
    events,
    sendEvent,
    subscribeToEvents,
    clearEvents,
    error,
    localSecretKey,
    bunkerConnectionToken,
    setBunkerConnectionToken,
    setLocalSecretKey,
    handleBunkerConnectionToken
  };

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr() {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
} 
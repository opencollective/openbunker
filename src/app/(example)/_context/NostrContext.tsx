"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { SimplePool, Event, Filter } from "nostr-tools";
import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";

interface NostrContextType {
  localSecretKey: Uint8Array | null;
  userPublicKey: string | null;
  bunkerConnectionToken: string | null;
  setBunkerConnectionToken: (token: string) => void;
  setLocalSecretKey: (sk: Uint8Array) => void;
  handleBunkerConnectionToken: (
    bunkerConnectionToken: string,
    localSecretKey: Uint8Array,
  ) => void;

  isConnected: boolean;
  bunkerStatus: "disconnected" | "connecting" | "connected" | "error";
  bunkerError: string | null;
  bunkerSigner: BunkerSigner | null;
  events: Event[];
  userProfile: Event | null;
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (profileData: Record<string, string>) => Promise<void>;
  sendEvent: (event: Event) => void;
  subscribeToEvents: (filter: Filter) => void;
  clearEvents: () => void;
  error: string | null;
}

const relays = [
  // 'wss://relay.damus.io',
  "wss://relay.chorus.community",
  // 'wss://nos.lol',
  // 'wss://relay.snort.social',
  // 'wss://nostr.wine',
  // 'wss://choru'
];
const NostrContext = createContext<NostrContextType | undefined>(undefined);

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [pool, setPool] = useState<SimplePool | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localSecretKey, setLocalSecretKey] = useState<Uint8Array | null>(null);
  const [userPublicKey, setUserPublicKey] = useState<string | null>(null);
  const [bunkerConnectionToken, setBunkerConnectionToken] = useState<
    string | null
  >(null);
  const [bunkerStatus, setBunkerStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [bunkerSigner, setBunkerSigner] = useState<BunkerSigner | null>(null);
  const [userProfile, setUserProfile] = useState<Event | null>(null);

  // Initialize Nostr pool
  useEffect(() => {
    const initPool = async () => {
      try {
        const { SimplePool } = await import("nostr-tools/pool");
        const newPool = new SimplePool();
        setPool(newPool);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        console.error("Failed to initialize Nostr pool:", err);
        setError("Failed to connect to Nostr relays");
        setIsConnected(false);
      }
    };

    initPool();

    return () => {
      if (pool) {
        pool.close(relays);
      }
    };
  }, [pool]);

  const fetchUserProfile = useCallback(async () => {
    if (!isConnected ||!pool || !userPublicKey || userProfile) return;

    try {
      console.log("Fetching user profile for:", userPublicKey);
      const filter: Filter = {
        kinds: [0],
        authors: [userPublicKey],
        limit: 1,
      };

      const events = await pool.querySync(relays, filter);
      if (events.length > 0) {
        setUserProfile(events[0]);
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      setError("Failed to fetch user profile");
    }
  }, [pool, userPublicKey]);

  // Fetch user profile when connected and userPublicKey is available
  useEffect(() => {
      fetchUserProfile();
  }, []);

  const updateUserProfile = useCallback(
    async (profileData: Record<string, string>) => {
      if (!bunkerSigner || bunkerStatus !== "connected") {
        throw new Error("Bunker not connected");
      }

      try {
        const content = JSON.stringify(profileData);
        const event = await bunkerSigner.signEvent({
          kind: 0,
          content,
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
        });

        const result = pool?.publish(relays, event);
        if (result) {
          const relayResults = await Promise.all(result);
          console.log("Relay results:", relayResults);
        }
        setUserProfile(event);
        console.log("Profile updated successfully");
      } catch (err) {
        console.error("Failed to update profile:", err);
        throw new Error("Failed to update profile");
      }
    },
    [bunkerSigner, bunkerStatus, pool],
  );

  const handleBunkerConnectionToken = useCallback(
    async (newBunkerConnectionToken: string, newLocalSecretKey: Uint8Array) => {
      setBunkerConnectionToken(newBunkerConnectionToken);
      setLocalSecretKey(newLocalSecretKey);
      setBunkerStatus("connecting");
      setBunkerError(null);

      try {
        // parse a bunker URI
        const bunkerPointer = await parseBunkerInput(newBunkerConnectionToken);
        if (!bunkerPointer) {
          throw new Error("Invalid bunker input:" + newBunkerConnectionToken);
        }
        console.log("Bunker pubkey:", bunkerPointer.pubkey);
        setUserPublicKey(bunkerPointer.pubkey);
        let newPool = pool;
        if (newPool === null) {
          newPool = new SimplePool();
          setPool(newPool);
          console.log("Pool initialized");
          setIsConnected(true);
          setError(null);
        }
        console.log("Bunker pointer:", bunkerPointer);
        console.log(bunkerPointer.relays);
        const bunker = new BunkerSigner(newLocalSecretKey, bunkerPointer, {
          pool: newPool,
        });
        setBunkerSigner(bunker);
        await bunker.connect();
        console.log("Bunker connected");
        setBunkerStatus("connected");
        setIsConnected(true);
      } catch (err) {
        console.error("Failed to connect to bunker:", err);
        setBunkerStatus("error");
        setBunkerError(
          err instanceof Error ? err.message : "Failed to connect to bunker",
        );
        setIsConnected(false);
      }
    },
    [pool],
  );

  // Subscribe to events
  const subscribeToEvents = useCallback(
    (filter: Filter) => {
      if (!pool) return;

      try {
        const sub = pool.subscribe(relays, filter, {
          onevent(event) {
            console.log("Received Nostr event:", event);
            setEvents((prev) => [event, ...prev.slice(0, 99)]); // Keep last 100 events
          },
          oneose() {
            console.log("Subscription ended");
          },
        });

        return () => {
          sub.close();
        };
      } catch (err) {
        console.error("Failed to subscribe to events:", err);
        setError("Failed to subscribe to Nostr events");
      }
    },
    [pool],
  );

  // Send event
  const sendEvent = useCallback(
    async (event: Event) => {
      if (!pool) return;

      const relays = [
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.snort.social",
        "wss://nostr.wine",
      ];

      try {
        await pool.publish(relays, event);
        console.log("Event published successfully");
      } catch (err) {
        console.error("Failed to publish event:", err);
        setError("Failed to publish event");
      }
    },
    [pool],
  );

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const value: NostrContextType = {
    isConnected,
    bunkerStatus,
    bunkerError,
    bunkerSigner,
    events,
    userProfile,
    fetchUserProfile,
    updateUserProfile,
    sendEvent,
    subscribeToEvents,
    clearEvents,
    error,
    localSecretKey,
    userPublicKey,
    bunkerConnectionToken,
    setBunkerConnectionToken,
    setLocalSecretKey,
    handleBunkerConnectionToken,
  };

  return (
    <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
  );
}

export function useNostr() {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return context;
}

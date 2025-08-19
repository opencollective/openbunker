"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

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

interface UseUserKeysReturn {
  keys: UserKey[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserKeys(): UseUserKeysReturn {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!user) {
      setKeys([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/keys");
      if (!response.ok) {
        throw new Error("Failed to fetch keys");
      }

      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch keys");
      console.error("Error fetching user keys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [user]);

  return {
    keys,
    loading,
    error,
    refetch: fetchKeys,
  };
}

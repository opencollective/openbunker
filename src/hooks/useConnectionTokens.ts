"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ConnectionToken {
  token: string;
  npub: string;
  subNpub?: string;
  timestamp: number;
  expiry: number;
  jsonData: Record<string, unknown> | null;
  isExpired: boolean;
}

interface UseConnectionTokensReturn {
  tokens: ConnectionToken[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createToken: (subNpub?: string) => Promise<ConnectionToken | null>;
  deleteToken: (token: string) => Promise<boolean>;
}

export function useConnectionTokens(npub: string): UseConnectionTokensReturn {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<ConnectionToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!user || !npub) {
      setTokens([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/keys/${npub}/connection-tokens`);
      if (!response.ok) {
        throw new Error("Failed to fetch connection tokens");
      }

      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch connection tokens",
      );
      console.error("Error fetching connection tokens:", err);
    } finally {
      setLoading(false);
    }
  }, [user, npub]);

  const createToken = async (
    subNpub?: string,
  ): Promise<ConnectionToken | null> => {
    if (!user || !npub) {
      return null;
    }

    try {
      const response = await fetch(`/api/keys/${npub}/connection-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subNpub }),
      });

      if (!response.ok) {
        throw new Error("Failed to create connection token");
      }

      const data = await response.json();

      // Add the new token to the list
      setTokens((prev) => [data.token, ...prev]);

      return data.token;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create connection token",
      );
      console.error("Error creating connection token:", err);
      return null;
    }
  };

  const deleteToken = async (token: string): Promise<boolean> => {
    if (!user || !npub) {
      return false;
    }

    try {
      const response = await fetch(
        `/api/keys/${npub}/connection-tokens?token=${encodeURIComponent(token)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete connection token");
      }

      // Remove the token from the list
      setTokens((prev) => prev.filter((t) => t.token !== token));

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete connection token",
      );
      console.error("Error deleting connection token:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [user, npub, fetchTokens]);

  return {
    tokens,
    loading,
    error,
    refetch: fetchTokens,
    createToken,
    deleteToken,
  };
}

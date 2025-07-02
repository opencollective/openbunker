'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ConnectionToken {
  token: string;
  npub: string;
  subNpub?: string;
  timestamp: number;
  expiry: number;
  jsonData: any;
  isExpired: boolean;
}

interface UseConnectionTokensReturn {
  tokens: ConnectionToken[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useConnectionTokens(npub: string): UseConnectionTokensReturn {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<ConnectionToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = async () => {
    if (!user || !npub) {
      setTokens([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/keys/${npub}/connection-tokens`);
      if (!response.ok) {
        throw new Error('Failed to fetch connection tokens');
      }

      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch connection tokens');
      console.error('Error fetching connection tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [user, npub]);

  return {
    tokens,
    loading,
    error,
    refetch: fetchTokens,
  };
} 
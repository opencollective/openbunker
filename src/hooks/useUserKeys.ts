'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Keys } from '@prisma/client';
import { useCallback, useEffect, useState } from 'react';

interface UseUserKeysReturn {
  keys: Keys[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createKeyForScope: (scopeSlug: string) => Promise<Keys | null>;
}

export function useUserKeys(scopeSlug?: string | null): UseUserKeysReturn {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Keys[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!user) {
      setKeys([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = scopeSlug
        ? `/api/keys?scope=${encodeURIComponent(scopeSlug)}`
        : '/api/keys';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch keys');
      }

      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch keys');
      console.error('Error fetching user keys:', err);
    } finally {
      setLoading(false);
    }
  }, [user, scopeSlug]);

  const createKeyForScope = useCallback(
    async (scopeSlug: string): Promise<Keys | null> => {
      if (!user) {
        return null;
      }

      try {
        const response = await fetch('/api/keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scope: scopeSlug }),
        });

        if (!response.ok) {
          throw new Error('Failed to create key');
        }

        const data = await response.json();

        // Refresh the keys list to include the new key
        await fetchKeys();

        return data.key;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create key');
        console.error('Error creating key:', err);
        return null;
      }
    },
    [user, fetchKeys]
  );

  useEffect(() => {
    fetchKeys();
  }, [user, fetchKeys]);

  return {
    keys,
    loading,
    error,
    refetch: fetchKeys,
    createKeyForScope,
  };
}

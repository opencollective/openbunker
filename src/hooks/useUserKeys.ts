'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Keys } from '@prisma/client';
import { useCallback, useEffect, useState } from 'react';

interface UseUserKeysReturn {
  keys: Keys[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserKeys(): UseUserKeysReturn {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Keys[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!user) {
      setKeys([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/keys');
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
  }, [user]);

  useEffect(() => {
    fetchKeys();
  }, [user, fetchKeys]);

  return {
    keys,
    loading,
    error,
    refetch: fetchKeys,
  };
}

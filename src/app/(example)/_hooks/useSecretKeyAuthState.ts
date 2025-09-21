import { useCallback, useEffect, useState } from 'react';
import { storage } from '../_hooks/bunkerStorage';

// Secret key authentication specific state
export interface SecretKeyAuthState {
  localSecretKey: Uint8Array | null;
  secretKeyError: string | null;
  secretKeyLogout: () => Promise<void>;
  setLocalSecretKey: (secretKey: Uint8Array) => void;
}
export function useSecretKeyAuthState(): SecretKeyAuthState {
  const [localSecretKey, setLocalSecretKeyState] = useState<Uint8Array | null>(
    null
  );
  const [secretKeyError, setSecretKeyError] = useState<string | null>(null);

  // Load secret key from storage on mount
  useEffect(() => {
    const loadStoredSecretKey = async () => {
      try {
        const stored = await storage.loadSecretKey();
        if (stored) {
          setLocalSecretKeyState(stored);
          console.log('Loaded secret key from storage');
        }
      } catch (error) {
        console.error('Failed to load secret key from storage:', error);
      }
    };

    loadStoredSecretKey();
  }, []);

  const setLocalSecretKey = useCallback(async (sk: Uint8Array) => {
    setLocalSecretKeyState(sk);
    setSecretKeyError(null);
    // Save to storage
    await storage.saveSecretKey(sk);
  }, []);

  const secretKeyLogout = useCallback(async () => {
    setLocalSecretKeyState(null);
    setSecretKeyError(null);
    // Clear from storage
    await storage.clearAll();
  }, []);

  return {
    localSecretKey,
    secretKeyError,
    secretKeyLogout,
    setLocalSecretKey,
  };
}

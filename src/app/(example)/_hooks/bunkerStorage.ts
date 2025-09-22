// Simple localStorage-based storage for the example app
// In a real app, you might want to use a more robust storage solution

// Storage keys
const STORAGE_KEYS = {
  LOCAL_SECRET_KEY: 'local-secret-key',
  BUNKER_CONNECTION_TOKEN: 'bunker-connection-token',
  BUNKER_LOCAL_SECRET_KEY: 'bunker-local-secret-key',
  BUNKER_PUBLIC_KEY: 'bunker-public-key',
} as const;

// Storage utility functions
export const storage = {
  async saveSecretKey(secretKey: Uint8Array): Promise<void> {
    try {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_SECRET_KEY,
        JSON.stringify(Array.from(secretKey))
      );
    } catch (error) {
      console.error('Failed to save secret key:', error);
    }
  },

  async loadSecretKey(): Promise<Uint8Array | null> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_SECRET_KEY);
      if (!stored) return null;
      const array = JSON.parse(stored) as number[];
      return new Uint8Array(array);
    } catch (error) {
      console.error('Failed to load secret key:', error);
      return null;
    }
  },

  async saveBunkerToken(token: string): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.BUNKER_CONNECTION_TOKEN, token);
    } catch (error) {
      console.error('Failed to save bunker token:', error);
    }
  },

  async loadBunkerToken(): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_KEYS.BUNKER_CONNECTION_TOKEN);
    } catch (error) {
      console.error('Failed to load bunker token:', error);
      return null;
    }
  },

  async saveBunkerLocalSecretKey(secretKey: Uint8Array): Promise<void> {
    try {
      localStorage.setItem(
        STORAGE_KEYS.BUNKER_LOCAL_SECRET_KEY,
        JSON.stringify(Array.from(secretKey))
      );
    } catch (error) {
      console.error('Failed to save bunker local secret key:', error);
    }
  },

  async loadBunkerLocalSecretKey(): Promise<Uint8Array | null> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BUNKER_LOCAL_SECRET_KEY);
      if (!stored) return null;
      const array = JSON.parse(stored) as number[];
      return new Uint8Array(array);
    } catch (error) {
      console.error('Failed to load bunker local secret key:', error);
      return null;
    }
  },

  async saveBunkerPublicKey(publicKey: string): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.BUNKER_PUBLIC_KEY, publicKey);
    } catch (error) {
      console.error('Failed to save bunker public key:', error);
    }
  },

  async loadBunkerPublicKey(): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_KEYS.BUNKER_PUBLIC_KEY);
    } catch (error) {
      console.error('Failed to load bunker public key:', error);
      return null;
    }
  },

  async clearAll(): Promise<void> {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },

  async hasStoredData(): Promise<boolean> {
    try {
      const hasSecretKey = localStorage.getItem(STORAGE_KEYS.LOCAL_SECRET_KEY);
      const hasBunkerToken = localStorage.getItem(
        STORAGE_KEYS.BUNKER_CONNECTION_TOKEN
      );
      return !!(hasSecretKey || hasBunkerToken);
    } catch (error) {
      console.error('Failed to check stored data:', error);
      return false;
    }
  },
};

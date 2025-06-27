'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  discord_id?: string;
  nostr_pubkey?: string;
  nostr_secret_key?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  authenticateWithSecretKey: (secretKey: string) => Promise<void>;
  authenticateWithOpenBunker: () => Promise<string>;
  checkOpenBunkerCallback: (secretKey: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const session = localStorage.getItem('openbunker_session');
        if (session) {
          const userData = JSON.parse(session);
          setUser(userData);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string) => {
    try {
      setLoading(true);
      // Send verification code to email
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }

      console.log('Verification code sent to:', email);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithSecretKey = async (secretKey: string) => {
    try {
      setLoading(true);
      
      // Validate the secret key format (basic validation)
      if (!secretKey.startsWith('nsec1')) {
        throw new Error('Invalid secret key format');
      }

      // Generate public key from secret key (you might want to use nostr-tools here)
      // For now, we'll create a simple user object
      const userData: User = {
        id: `nostr_${Date.now()}`,
        nostr_secret_key: secretKey,
        nostr_pubkey: 'npub1...', // This should be derived from the secret key
      };

      setUser(userData);
      localStorage.setItem('openbunker_session', JSON.stringify(userData));
    } catch (error) {
      console.error('Secret key authentication error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithOpenBunker = async (): Promise<string> => {
    try {
      setLoading(true);
      
      // Get OpenBunker authentication URL
      const response = await fetch('/api/auth/openbunker-url', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to get OpenBunker authentication URL');
      }

      const { authUrl } = await response.json();
      return authUrl;
    } catch (error) {
      console.error('OpenBunker authentication error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkOpenBunkerCallback = async (secretKey: string) => {
    try {
      setLoading(true);
      
      // Validate the secret key
      if (!secretKey.startsWith('nsec1')) {
        throw new Error('Invalid secret key format');
      }

      // Create user object with the received secret key
      const userData: User = {
        id: `openbunker_${Date.now()}`,
        nostr_secret_key: secretKey,
        nostr_pubkey: 'npub1...', // This should be derived from the secret key
      };

      setUser(userData);
      localStorage.setItem('openbunker_session', JSON.stringify(userData));
    } catch (error) {
      console.error('OpenBunker callback error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('openbunker_session');
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    authenticateWithSecretKey,
    authenticateWithOpenBunker,
    checkOpenBunkerCallback,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 
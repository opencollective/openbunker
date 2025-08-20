"use client";

import { createClient } from "@/lib/supabase";
import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  currentSession: Session | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  authenticateWithOpenBunker: () => Promise<string>;
  checkOpenBunkerCallback: (secretKey: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  // Lazy initialization of Supabase client to avoid build-time issues
  const getSupabase = () => {
    try {
      return createClient();
    } catch (error) {
      console.warn("Supabase client not available:", error);
      return null;
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCurrentSession(session);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setCurrentSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string) => {
    try {
      setLoading(true);
      // Send verification code to email
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to send verification code");
      }

      console.log("Verification code sent to:", email);
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithOpenBunker = async (): Promise<string> => {
    try {
      setLoading(true);

      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase client not available");
      }
      const baseUrl = process.env.NEXT_PUBLIC_DEPLOY_URL || window.location.origin;
      const { error, data } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${baseUrl}`,
        },
      });

      // Validate redirect URL
      const redirectUrl = data?.url;
      const allowedDomains = [
        "localhost:3000",
        "vwlhjfwabbobhbopmmxa.supabase.co",
      ];

      const isValidRedirect = allowedDomains.some((domain) =>
        redirectUrl?.includes(domain),
      );

      if (!isValidRedirect) {
        throw new Error("Invalid redirect URL");
      }
      console.log("data", data);

      if (error || !data?.url) {
        console.error("Error signing in with Discord:", error?.message);
      }
      console.log("redirecting to", data?.url);
      return data?.url || "";
    } catch (error) {
      console.error("OpenBunker authentication error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkOpenBunkerCallback = async (secretKey: string) => {
    try {
      setLoading(true);

      // Validate the secret key
      if (!secretKey.startsWith("nsec1")) {
        throw new Error("Invalid secret key format");
      }

      // For now, we'll create a custom user object
      // In a real implementation, you might want to store this in a separate table
      // or handle it differently since Supabase auth doesn't directly support Nostr keys
      console.log("Nostr secret key received:", secretKey);

      // You could store additional user data in a separate table
      // or handle Nostr authentication separately from Supabase auth
    } catch (error) {
      console.error("OpenBunker callback error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error.message);
      }
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    currentSession,
    signIn,
    signOut,
    authenticateWithOpenBunker,
    checkOpenBunkerCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

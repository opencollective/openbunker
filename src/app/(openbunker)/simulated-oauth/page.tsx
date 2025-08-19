"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OpenBunkerAuthPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"initial" | "processing" | "complete">(
    "initial",
  );
  const router = useRouter();

  useEffect(() => {
    // Check if we have a Discord code in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const error = urlParams.get("error");

    if (error) {
      setError("Discord authentication failed. Please try again.");
      setLoading(false);
      return;
    }

    if (code) {
      handleDiscordCallback(code);
    } else {
      // Start Discord OAuth flow
      startDiscordOAuth();
    }
  }, []);

  const startDiscordOAuth = () => {
    // In development, fake the OAuth flow
    if (process.env.NODE_ENV === "development") {
      setStep("processing");
      // Simulate a delay to make it feel more realistic
      setTimeout(() => {
        // Generate a fake Discord code
        const fakeCode = "dev_" + Math.random().toString(36).substring(2, 15);
        handleDiscordCallback(fakeCode);
      }, 2000);
      return;
    }

    // Production Discord OAuth URL
    const clientId =
      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "your-discord-client-id";
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/openbunker-auth`,
    );
    const scope = encodeURIComponent("identify email");

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

    window.location.href = discordAuthUrl;
  };

  const handleDiscordCallback = async (code: string) => {
    try {
      setStep("processing");

      // Exchange Discord code for user info and generate Nostr key
      const response = await fetch("/api/auth/discord-callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete Discord authentication");
      }

      const { secretKey } = await response.json();

      setStep("complete");

      // Wait a moment to show completion, then handle popup callback
      setTimeout(() => {
        handlePopupCallback(secretKey);
      }, 1500);
    } catch (err) {
      console.error("Discord callback error:", err);
      setError("Failed to complete authentication. Please try again.");
      setLoading(false);
    }
  };

  const handlePopupCallback = (secretKey: string) => {
    // Check if we're in a popup window
    if (window.opener && !window.opener.closed) {
      // We're in a popup - call parent callback
      try {
        // Try to call a callback function on the parent window
        if (typeof window.opener.openBunkerCallback === "function") {
          window.opener.openBunkerCallback(secretKey);
        } else {
          // Fallback: post message to parent
          window.opener.postMessage(
            {
              type: "openbunker-auth-success",
              secretKey: secretKey,
            },
            window.location.origin,
          );
        }
        // Close the popup
        window.close();
      } catch (err) {
        console.error("Failed to communicate with parent window:", err);
        // Fallback to redirect
        const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(secretKey)}`;
        window.location.href = loginUrl;
      }
    } else {
      // Not in a popup - redirect to login page
      const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(secretKey)}`;
      window.location.href = loginUrl;
    }
  };

  // Show initial development mode message
  if (step === "initial" && process.env.NODE_ENV === "development") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-yellow-100 rounded-full p-4 mx-auto mb-6 w-16 h-16 flex items-center justify-center">
            <span className="text-2xl">🧪</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Development Mode
          </h2>
          <p className="text-gray-600 mb-6">
            OAuth flow will be simulated for testing purposes.
          </p>
          <button
            onClick={startDiscordOAuth}
            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-medium"
          >
            Start Simulated OAuth
          </button>
        </div>
      </div>
    );
  }

  if (loading && step === "initial") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to Discord...</p>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {process.env.NODE_ENV === "development"
              ? "Simulating Discord OAuth..."
              : "Completing authentication..."}
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-sm text-gray-500 mt-2">
              Development mode: Faking OAuth flow
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Authentication Complete!
          </h2>
          <p className="text-gray-600">
            {process.env.NODE_ENV === "development"
              ? "Simulated OAuth completed successfully."
              : "Discord OAuth completed successfully."}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {window.opener
              ? "Closing popup..."
              : "Redirecting back to login..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="text-center">
          <div className="bg-red-100 rounded-full p-4 mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Authentication Failed
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.close()}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return null;
}

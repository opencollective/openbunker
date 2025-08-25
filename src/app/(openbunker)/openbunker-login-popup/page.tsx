"use client";

import { useState } from "react";
import SessionSelector from "@/components/SessionSelector";
import KeySelector from "@/components/KeySelector";
import { Session } from "@supabase/supabase-js";
import { nip19 } from "nostr-tools";

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

type Step = "session" | "key";

export default function OpenBunkerLoginPopup() {
  const [currentStep, setCurrentStep] = useState<Step>("session");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedKey, setSelectedKey] = useState<UserKey | null>(null);

  const handleSessionSelected = (session: Session) => {
    setSelectedSession(session);
    setCurrentStep("key");
  };

  const handleKeySelected = (key: UserKey) => {
    setSelectedKey(key);
    const npub = key.key.npub;
    const hex = nip19.decode(npub).data;
    const token = "31231241";
    // Now we have both session and key, proceed with authentication
    handlePopupCallback(
      `bunker://${hex}?relay=${encodeURIComponent(process.env.NEXT_PUBLIC_BUNKER_RELAYS ?? "wss://relay.nsec.app")}&secret=${token}`,
    );
  };

  const handleBackToSession = () => {
    setCurrentStep("session");
    setSelectedKey(null);
  };

  const handlePopupCallback = (bunkerConnectionToken: string) => {
    // Check if we're in a popup window
    if (window.opener && !window.opener.closed) {
      // We're in a popup - communicate with parent via postMessage
      try {
        // Use postMessage as the primary communication method to avoid cross-origin issues
        window.opener.postMessage(
          {
            type: "openbunker-auth-success",
            secretKey: bunkerConnectionToken,
          },
          "*" // Allow any origin for cross-origin communication
        );
        
        // Close the popup
        window.close();
      } catch (err) {
        console.error("Failed to communicate with parent window:", err);
        // Fallback to redirect
        const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(bunkerConnectionToken)}`;
        window.location.href = loginUrl;
      }
    } else {
      console.log("Not in a popup - redirect to login page");
      // Not in a popup - redirect to login page
      const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(bunkerConnectionToken)}`;
      window.location.href = loginUrl;
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center space-x-4">
          <div
            className={`flex items-center ${currentStep === "session" ? "text-indigo-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === "session"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              1
            </div>
            <span className="ml-2 text-sm font-medium">Session</span>
          </div>
          <div className="w-8 h-1 bg-gray-200 rounded"></div>
          <div
            className={`flex items-center ${currentStep === "key" ? "text-indigo-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === "key"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              2
            </div>
            <span className="ml-2 text-sm font-medium">Key</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              OpenBunker
            </h1>
            <p className="text-gray-600">Authentication Setup</p>
          </div>

          {renderStepIndicator()}

          <div className="bg-white rounded-2xl shadow-xl p-6">
            {currentStep === "session" ? (
              <SessionSelector onSessionSelected={handleSessionSelected} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Choose Key
                  </h3>
                  <button
                    onClick={handleBackToSession}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to session
                  </button>
                </div>

                {selectedSession && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedSession.user.user_metadata?.full_name ||
                            selectedSession.user.user_metadata?.name ||
                            selectedSession.user.email?.split("@")[0] ||
                            "User"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {selectedSession.user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <KeySelector
                  onKeySelected={handleKeySelected}
                  selectedKeyId={selectedKey?.id}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              {currentStep === "session"
                ? "Select your Discord session to continue"
                : "Choose a Nostr key to complete authentication"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

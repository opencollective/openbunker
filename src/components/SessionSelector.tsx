"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { Session } from "@supabase/supabase-js";
import OpenBunkerLogin from "./OpenBunkerLogin";

interface SessionSelectorProps {
  onSessionSelected?: (session: Session) => void;
}

export default function SessionSelector({
  onSessionSelected,
}: SessionSelectorProps) {
  const { currentSession, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const handleUseCurrentSession = () => {
    if (currentSession && onSessionSelected) {
      onSessionSelected(currentSession);
    }
  };

  const handleAddNewSession = () => {
    setShowLogin(true);
  };

  const formatUserInfo = (session: Session) => {
    const user = session.user;
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User";
    const email = user.email || "No email";
    const provider = session.user.app_metadata?.provider || "Unknown";

    return { name, email, provider };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Add New Session</h3>
          <button
            onClick={() => setShowLogin(false)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to sessions
          </button>
        </div>
        <OpenBunkerLogin />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Active Sessions
          </h3>
          <p className="text-gray-600 mb-4">
            Sign in to get started with OpenBunker
          </p>
        </div>
        <OpenBunkerLogin />
      </div>
    );
  }

  const { name, email, provider } = formatUserInfo(currentSession);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose Session
        </h3>
        <p className="text-gray-600">
          Select an existing session or add a new one
        </p>
      </div>

      {/* Current Session */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Image
                src={
                  currentSession.user.user_metadata?.avatar_url ||
                  "/default-avatar.png"
                }
                alt="Profile"
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border-2 border-indigo-200"
                onError={(e) => {
                  e.currentTarget.src = "/default-avatar.png";
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{name}</h4>
              <p className="text-sm text-gray-600">{email}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Active
                </span>
                <span className="text-xs text-gray-500 capitalize">
                  {provider}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleUseCurrentSession}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Use This Session
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-indigo-200">
          <div className="flex justify-between text-xs text-gray-600">
            <span>
              Last active:{" "}
              {currentSession.user.last_sign_in_at
                ? new Date(
                    currentSession.user.last_sign_in_at,
                  ).toLocaleDateString()
                : "Unknown"}
            </span>
            <span>
              Created:{" "}
              {currentSession.user.created_at
                ? new Date(currentSession.user.created_at).toLocaleDateString()
                : "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Add New Session */}
      <div className="border-t border-gray-200 pt-6">
        <div className="text-center">
          <h4 className="text-md font-medium text-gray-900 mb-2">
            Need a Different Account?
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Sign in with a different Discord account
          </p>
          <button
            onClick={handleAddNewSession}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add New Session
          </button>
        </div>
      </div>

      {/* Session Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Session Information
        </h4>
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Session ID:</span>
            <span className="font-mono">
              {currentSession.access_token.substring(0, 20)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span>Expires:</span>
            <span>
              {new Date(currentSession.expires_at! * 1000).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Token Type:</span>
            <span>{currentSession.token_type}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

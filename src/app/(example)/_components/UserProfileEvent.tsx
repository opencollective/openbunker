"use client";

import { useState } from "react";
import Image from "next/image";
import { useNostr } from "@/app/(example)/_context/NostrContext";
import { Event } from "nostr-tools";

export default function UserProfileEvent() {
  const { userProfile, bunkerStatus, updateUserProfile, fetchUserProfile } =
    useNostr();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Parse profile data from event content
  const parseProfileData = (event: Event) => {
    try {
      return JSON.parse(event.content);
    } catch {
      return {};
    }
  };

  // Handle profile refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      await fetchUserProfile();
    } catch {
      setError("Failed to refresh profile");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initialize edit data when starting to edit
  const handleStartEdit = () => {
    if (userProfile) {
      setEditData(parseProfileData(userProfile));
    } else {
      setEditData({
        name: "",
        display_name: "",
        about: "",
        picture: "",
        banner: "",
        website: "",
        lud06: "",
        lud16: "",
        nip05: "",
      });
    }
    setIsEditing(true);
    setError(null);
  };

  // Handle profile update
  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      await updateUserProfile(editData);
      setIsEditing(false);
      await fetchUserProfile(); // Refresh the profile
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const canEdit = bunkerStatus === "connected";

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium">User Profile (Kind 0)</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh profile"
          >
            {isRefreshing ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>

          {canEdit && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {!userProfile && !isEditing ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-gray-400"
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
          <p className="text-gray-500 text-sm mb-4">No profile found</p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center px-3 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </>
              )}
            </button>
            {canEdit && (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Profile
              </button>
            )}
          </div>
        </div>
      ) : isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={editData.name || ""}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editData.display_name || ""}
                onChange={(e) =>
                  handleInputChange("display_name", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Display name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              About
            </label>
            <textarea
              value={editData.about || ""}
              onChange={(e) => handleInputChange("about", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Picture URL
              </label>
              <input
                type="url"
                value={editData.picture || ""}
                onChange={(e) => handleInputChange("picture", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banner URL
              </label>
              <input
                type="url"
                value={editData.banner || ""}
                onChange={(e) => handleInputChange("banner", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://example.com/banner.jpg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={editData.website || ""}
              onChange={(e) => handleInputChange("website", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="https://yourwebsite.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lightning Address (LUD06)
              </label>
              <input
                type="text"
                value={editData.lud06 || ""}
                onChange={(e) => handleInputChange("lud06", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="lnbc1..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lightning Address (LUD16)
              </label>
              <input
                type="text"
                value={editData.lud16 || ""}
                onChange={(e) => handleInputChange("lud16", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="user@domain.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NIP-05 Identifier
            </label>
            <input
              type="text"
              value={editData.nip05 || ""}
              onChange={(e) => handleInputChange("nip05", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="user@domain.com"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateProfile}
              disabled={isUpdating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isUpdating ? "Updating..." : "Update Profile"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {userProfile && (
            <>
              <div className="flex items-center space-x-4">
                {parseProfileData(userProfile).picture && (
                  <Image
                    src={parseProfileData(userProfile).picture}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {parseProfileData(userProfile).display_name ||
                      parseProfileData(userProfile).name ||
                      "Anonymous"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {parseProfileData(userProfile).name || "No name set"}
                  </p>
                </div>
              </div>

              {parseProfileData(userProfile).about && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">
                    About
                  </h4>
                  <p className="text-sm text-gray-600">
                    {parseProfileData(userProfile).about}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {parseProfileData(userProfile).website && (
                  <div>
                    <span className="font-medium text-gray-700">Website:</span>
                    <a
                      href={parseProfileData(userProfile).website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-indigo-600 hover:text-indigo-800"
                    >
                      {parseProfileData(userProfile).website}
                    </a>
                  </div>
                )}

                {parseProfileData(userProfile).nip05 && (
                  <div>
                    <span className="font-medium text-gray-700">NIP-05:</span>
                    <span className="ml-2 text-gray-600">
                      {parseProfileData(userProfile).nip05}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 pt-2 border-t">
                <p>Event ID: {userProfile.id.slice(0, 16)}...</p>
                <p>
                  Created:{" "}
                  {new Date(userProfile.created_at * 1000).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {!canEdit && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            Connect to a bunker to edit your profile
          </p>
        </div>
      )}
    </div>
  );
}

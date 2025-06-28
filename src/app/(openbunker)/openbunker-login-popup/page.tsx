'use client';

import SessionSelector from '@/components/SessionSelector';
import { Session } from '@supabase/supabase-js';

export default function OpenBunkerLoginPopup() {

  const handleSessionSelected = (session: Session) => {
    // In a real implementation, you might want to:
    // 1. Store the selected session in localStorage or state
    // 2. Send a message to the parent window
    // 3. Close the popup or redirect
    handlePopupCallback(`bunker://${session.user.email}`);
  };

  const handlePopupCallback = (secretKey: string) => {
    // Check if we're in a popup window
    if (window.opener && !window.opener.closed) {
      // We're in a popup - call parent callback
      try {
        // Try to call a callback function on the parent window
        if (typeof window.opener.openBunkerCallback === 'function') {
          window.opener.openBunkerCallback(secretKey);
        } else {
          // Fallback: post message to parent
          window.opener.postMessage({
            type: 'openbunker-auth-success',
            secretKey: secretKey
          }, window.location.origin);
        }
        // Close the popup
        window.close();
      } catch (err) {
        console.error('Failed to communicate with parent window:', err);
        // Fallback to redirect
        const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(secretKey)}`;
        window.location.href = loginUrl;
      }
    } else {
      console.log('Not in a popup - redirect to login page');
      // Not in a popup - redirect to login page
      const loginUrl = `${window.location.origin}/login?secret_key=${encodeURIComponent(secretKey)}`;
      window.location.href = loginUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              OpenBunker
            </h1>
            <p className="text-gray-600">
              Session Management
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <SessionSelector onSessionSelected={handleSessionSelected} />
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              This popup allows you to manage your OpenBunker sessions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 
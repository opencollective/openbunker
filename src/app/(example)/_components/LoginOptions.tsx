'use client';

import { OpenBunkerAuthButton } from '@/app/(example)/_components/OpenBunkerAuthButton';
import SecretKeyLogin from '@/app/(example)/_components/SecretKeyLogin';
import { useNostr } from '@/app/(example)/_context/NostrProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginOptions() {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const {
    configureBunkerConnectionWithBunkerToken,
    configureBunkerConnectionWithNostrConnect,
    popup,
    nostrStatus,
  } = useNostr();
  const router = useRouter();

  // Redirect to main page when authentication is successful
  useEffect(() => {
    console.log('LoginOptions: nostrStatus changed to:', nostrStatus);
    if (nostrStatus === 'connected') {
      console.log('LoginOptions: Redirecting to /example');
      router.push('/example');
    }
  }, [nostrStatus, router]);

  const handleOpenBunkerPopup = () => {
    configureBunkerConnectionWithBunkerToken();
  };

  const handleNostrConnectPopup = () => {
    configureBunkerConnectionWithNostrConnect();
  };

  if (showSecretKey) {
    return (
      <div>
        <button
          onClick={() => setShowSecretKey(false)}
          className="mb-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center"
        >
          ← Back to options
        </button>
        <SecretKeyLogin />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Choose Authentication Method
        </h2>
        <p className="text-gray-600">
          Select how you&apos;d like to authenticate with OpenBunker
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setShowSecretKey(true)}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-3"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <span>Authenticate with Secret Key</span>
        </button>

        <OpenBunkerAuthButton
          onClick={handleOpenBunkerPopup}
          text="Authenticate with OpenBunker (Bunker Token)"
          disabled={!!popup}
          isLoading={!!popup}
        />

        <OpenBunkerAuthButton
          onClick={handleNostrConnectPopup}
          text="Authenticate with OpenBunker (NostrConnect)"
          disabled={!!popup}
          isLoading={!!popup}
        />
      </div>

      {popup && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            A new window has opened for OpenBunker authentication.
          </p>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-500">
          <strong>Secret Key:</strong> Use your existing Nostr secret key for
          direct authentication
        </p>
        <p className="text-sm text-gray-500 mt-1">
          <strong>OpenBunker (Bunker Token):</strong> Use Discord OAuth to get a
          new Nostr key
        </p>
        <p className="text-sm text-gray-500 mt-1">
          <strong>OpenBunker (NostrConnect):</strong> Use NostrConnect protocol
          for authentication
        </p>
      </div>
    </div>
  );
}

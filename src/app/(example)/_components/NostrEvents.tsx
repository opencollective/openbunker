'use client';

import { useNostr } from '@/app/(example)/_context/NostrContext';

export default function NostrEvents() {
  const { events, isConnected, error, clearEvents } = useNostr();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium">
            {isConnected ? 'Connected to Nostr' : 'Disconnected'}
          </span>
        </div>

        {events.length > 0 && (
          <button
            onClick={clearEvents}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              {isConnected
                ? 'Waiting for Nostr events...'
                : 'Not connected to Nostr relays'}
            </p>
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={`${event.id}-${index}`}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                  Kind {event.kind}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(event.created_at * 1000).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-mono text-gray-600 break-all">
                  ID: {event.id.slice(0, 16)}...
                </p>
                <p className="text-sm font-mono text-gray-600 break-all">
                  Pubkey: {event.pubkey.slice(0, 16)}...
                </p>
                {event.content && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {event.content.length > 200
                        ? `${event.content.slice(0, 200)}...`
                        : event.content}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {events.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Showing {events.length} event{events.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

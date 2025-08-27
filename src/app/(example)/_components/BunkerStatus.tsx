'use client';

import { useNostr } from '@/app/(example)/_context/NostrContext';

export default function BunkerStatus() {
  const { bunkerStatus, bunkerError, bunkerConnectionToken, bunkerSigner } =
    useNostr();

  const getStatusColor = () => {
    switch (bunkerStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (bunkerStatus) {
      case 'connected':
        return 'Connected to Bunker';
      case 'connecting':
        return 'Connecting to Bunker...';
      case 'error':
        return 'Bunker Connection Error';
      default:
        return 'Not Connected';
    }
  };

  const getStatusIcon = () => {
    switch (bunkerStatus) {
      case 'connected':
        return (
          <svg
            className="w-5 h-5 text-white"
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
        );
      case 'connecting':
        return (
          <svg
            className="w-5 h-5 text-white animate-spin"
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
        );
      case 'error':
        return (
          <svg
            className="w-5 h-5 text-white"
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
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
            />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Bunker Status</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="text-sm font-medium text-gray-700">
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Status Indicator */}
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div
            className={`w-10 h-10 rounded-full ${getStatusColor()} flex items-center justify-center`}
          >
            {getStatusIcon()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {getStatusText()}
            </p>
            <p className="text-xs text-gray-500">
              {bunkerStatus === 'connected' && 'Ready to sign events'}
              {bunkerStatus === 'connecting' &&
                'Establishing secure connection...'}
              {bunkerStatus === 'error' && 'Connection failed'}
              {bunkerStatus === 'disconnected' && 'No bunker connection'}
            </p>
          </div>
        </div>

        {/* Connection Token */}
        {bunkerConnectionToken && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-900 mb-1">
              Connection Token
            </p>
            <p className="text-xs text-blue-700 font-mono break-all">
              {bunkerConnectionToken.slice(0, 20)}...
              {bunkerConnectionToken.slice(-20)}
            </p>
          </div>
        )}

        {/* Error Message */}
        {bunkerError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-900 mb-1">
              Error Details
            </p>
            <p className="text-xs text-red-700">{bunkerError}</p>
          </div>
        )}

        {/* Bunker Signer Info */}
        {bunkerSigner && bunkerStatus === 'connected' && (
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-xs font-medium text-green-900 mb-1">
              Bunker Signer
            </p>
            <p className="text-xs text-green-700">
              Active and ready for signing operations
            </p>
          </div>
        )}

        {/* Connection Details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-gray-500">Status</p>
            <p className="font-medium text-gray-900 capitalize">
              {bunkerStatus}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Signer</p>
            <p className="font-medium text-gray-900">
              {bunkerSigner ? 'Available' : 'Not Available'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// OpenBunker API integration for the example app
// This file provides a bridge between the example frontend and the OpenBunker backend

export const openBunkerUrl = '/openbunker-login-popup';

export interface OpenBunkerResponse {
  success: boolean;
  message: string;
  bunkerUrl?: string;
  bunkerConnectionToken?: string | null;
  error?: string;
}

export interface OpenBunkerAuthSuccessEvent {
  type: 'openbunker-auth-success';
  connectionMode: 'bunker' | 'nostrconnect';
  secretKey: string;
}

// Import types from the main types file
import type { OpenBunkerAuthMessage } from '@/types/openbunkerApiTypes';

// Function to parse URL parameters and extract auth messages
export function parseAuthMessageFromUrl(): OpenBunkerAuthMessage | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  const connectionMode = urlParams.get('connectionMode');
  const secretKey = urlParams.get('secretKey');
  const success = urlParams.get('success');
  const errorMessage = urlParams.get('errorMessage');

  if (type === 'openbunker-auth-success') {
    if (connectionMode === 'bunker' && secretKey) {
      return {
        type: 'openbunker-auth-success',
        connectionMode: 'bunker',
        secretKey: secretKey,
      };
    } else if (connectionMode === 'nostrconnect') {
      return {
        type: 'openbunker-auth-success',
        connectionMode: 'nostrconnect',
        success: success === 'true',
        errorMessage: errorMessage || undefined,
      };
    }
  }

  return null;
}

export const openBunkerApi = {
  async openBunkerPopupNostrConnect(
    connectionUri: string,
    setPopup: (_window: Window | null) => void
  ): Promise<void> {
    // Add query parameters for nostrconnect mode and token
    const url = new URL(openBunkerUrl, window.location.origin);
    url.searchParams.set('connectionMode', 'nostrconnect');
    url.searchParams.set('connectionToken', connectionUri);

    // Create a promise that resolves when the popup closes
    const popupPromise = new Promise<void>(resolve => {
      const popupWindow = window.open(
        url.toString(),
        'openbunker-login',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popupWindow) {
        resolve();
        return;
      }
      setPopup(popupWindow);

      // Check if popup is closed
      const checkClosed = setInterval(() => {
        if (popupWindow.closed) {
          clearInterval(checkClosed);
          setPopup(null);
          resolve();
        }
      }, 1000);
    });
    return await popupPromise;
  },

  async redirectWithBunkerToken(redirectUrl: string): Promise<void> {
    // Create URL with redirect parameter
    const url = new URL(openBunkerUrl, window.location.origin);
    url.searchParams.set('redirectUrl', redirectUrl);

    // Redirect to OpenBunker with redirect URL
    window.location.href = url.toString();
  },

  async redirectWithNostrConnect(
    connectionUri: string,
    redirectUrl: string
  ): Promise<void> {
    // Create URL with nostrconnect parameters and redirect URL
    const url = new URL(openBunkerUrl, window.location.origin);
    url.searchParams.set('connectionMode', 'nostrconnect');
    url.searchParams.set('connectionToken', connectionUri);
    url.searchParams.set('redirectUrl', redirectUrl);

    // Redirect to OpenBunker with nostrconnect and redirect URL
    window.location.href = url.toString();
  },

  async openBunkerPopupOpen(
    setPopup: (_window: Window | null) => void,
    openBunkerEventHandler?: (
      _event: MessageEvent<OpenBunkerAuthSuccessEvent>
    ) => Promise<void>
  ): Promise<void> {
    // Create a popup with the configured OpenBunker URL
    const popupWindow = window.open(
      openBunkerUrl,
      'openbunker-login',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    // Create a promise that resolves when the popup closes
    const popupPromise = new Promise<void>(resolve => {
      if (!popupWindow) {
        resolve();
        return;
      }
      setPopup(popupWindow);

      // Set up event handler if provided
      let messageHandler:
        | ((event: MessageEvent<OpenBunkerAuthSuccessEvent>) => void)
        | null = null;
      if (openBunkerEventHandler) {
        messageHandler = (event: MessageEvent) => {
          console.log('OpenBunker event:', event);
          // Handle messages from OpenBunker popup (cross-origin)
          if (event.data?.type === 'openbunker-auth-success') {
            openBunkerEventHandler(event);
          }
        };
        window.addEventListener('message', messageHandler);
      }

      // Check if popup is closed
      const checkClosed = setInterval(() => {
        if (popupWindow.closed) {
          clearInterval(checkClosed);
          setPopup(null);
          // Clean up event handler when popup closes
          if (messageHandler) {
            window.removeEventListener('message', messageHandler);
          }
          resolve();
        }
      }, 1000);
    });
    return await popupPromise;
  },
};

# OpenBunker Integration Guide

This document explains how to integrate with OpenBunker using NIP-46 (Nostr Remote Signing) and provides various choices of implementation based on the different authentication flows described in the spec.

## Implementation guidelines

### Key Management

- Local secret keys are generated per session for NIP-46 communication. It is advised to save local keys on the client in order to enable
- Every local secret key is associated with a session in Openbunker. A session needs to be created by sending a connect request or via nostrconnect

## Supported Authentication Flows

OpenBunker supports three different authentication flows, each with specific use cases and implementation details.

#### Step 0: Scope creation

Head over to Openbunker and create a scope. In the Scopes tab, create a new scope or get an existing scope's name. This will be needed for the configuration of the Openbunker login popup.

### 1. NostrConnect Flow (Recommended for Initial Connections)

The NostrConnect flow is the recommended approach for initial connections. It allows users to authenticate via Discord OAuth or OTP sign-in through OpenBunker with NIP-46 BunkerSigner.

#### Step 1: Open Popup Window

Create a popup window that opens the OpenBunker authentication page:

The popup communicates back to the parent window using the `postMessage` API, so we create a utility function that waits for the popup to close and execute an event handler on a `openbunker-auth-success` message.

```typescript
async openBunkerPopupOpen(
  popupUrl: string,
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
}
```

#### Step 2: Wait for connection with a nostrconnect created bunker

In the below code we build the URL to the Openbunker Login popup in nostrconnect mode and also create the BunkerSigner from the nostrconnect URI, which waits for a NIP-46 connect response to establish a connection.

```typescript
const openBunkerBaseUrl =
  'https://openbunker.opencollective.xyz/openbunker-login-popup';
// Add query parameters for scope and nostrconnect mode and token
const url = new URL(baseUrl, window.location.origin);
url.searchParams.set('scope', 'my-scope-slug');
url.searchParams.set('connectionMode', 'nostrconnect');
url.searchParams.set('connectionToken', connectionUri);

try {
  const localSecretKey = generateSecretKey();
  const secret = Math.random().toString(36).substring(2, 15);

  const connectionUri = createNostrConnectURI({
    clientPubkey: getPublicKey(localSecretKey),
    relays: ['wss://relay.nsec.app'],
    secret: secret,
    name: 'Community Requests',
  });

  const popupPromise = await openBunkerPopupOpen(connectionUri, () {});
  // Wait for both the bunker connection and popup to complete
  const [bunkerSigner] = await Promise.all([
    BunkerSigner.fromUri(localSecretKey, connectionUri),
    popupPromise,
  ]);
} catch (err) {
  console.error('Failed to complete OpenBunker authentication:', err);
}
```

The BunkerSigner automatically handles the NIP-46 protocol negotiation and establishes a secure connection for remote event signing.

### 2. Bunker Token Flow

The Bunker Token flow generates the bunker connection token on the Openbunker side.

#### Step 1: Open Popup Window

We skip Step 1 and reuse the same `openBunkerPopupOpen` function from the Nostrconnect flow.

#### Step 2: Receive Pre-Generated Token

The popup communicates back to the parent window using the `postMessage` API.
When the user completes Discord OAuth or OTP authentication, OpenBunker sends a bunker connection token. This token contains the necessary information to establish a NIP-46 connection.
The below code will create a popup and connect the bunker signer using a `bunker://` token (we leave the management of state and saving of the bunker information up to the implementer).

```typescript
export interface OpenBunkerAuthSuccessEvent {
  type: 'openbunker-auth-success';
  connectionMode: 'bunker' | 'nostrconnect';
  secretKey: string;
}

const handleOpenBunkerSuccess = async (
  openBunkerEvent: MessageEvent<OpenBunkerAuthSuccessEvent>
) => {
  try {
    const bunkerConnectionToken = openBunkerEvent.data.secretKey;
    const sk = generateSecretKey();
    // Parse bunker connection token to get bunker pointer
    const bunkerPointer = await parseBunkerInput(bunkerConnectionToken);

    // Create BunkerSigner instance
    const bunkerSigner = new BunkerSigner(localSecretKey, bunkerPointer);
    // Connect to bunker for remote signing
    await bunkerSigner.connect();
  } catch (err) {
    console.error('Failed to complete OpenBunker authentication:', err);
  }
};

const openBunkerBaseUrl =
  'https://openbunker.opencollective.xyz/openbunker-login-popup';
// Add query parameters for scope and nostrconnect mode and token
const url = new URL(baseUrl, window.location.origin);
url.searchParams.set('scope', 'my-scope-slug');
url.searchParams.set('connectionMode', 'nostrconnect');
url.searchParams.set('connectionToken', connectionUri);

// Open popup and handle the returned token
await openBunkerPopupOpen(url.toString(), handleOpenBunkerSuccess);
```

The BunkerSigner automatically handles the NIP-46 protocol negotiation and establishes a secure connection for remote event signing.

### 3. Bunker Email Flow

The Bunker Email flow is designed for scenarios where popup-based authentication is not suitable or when users prefer email-based verification.

#### Step 1: Submit Request to OpenBunker API

Send user details to the OpenBunker API to request an email-based authentication:

```typescript
// Submit to OpenBunker unauthenticated token endpoint
const openBunkerAPIURL =
  'https://openbunker.opencollective.xyz/api/openbunker-unauthenticated-token';
const authResponse = await fetch({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    name,
    scope,
  }),
});

if (!authResponse.ok) {
  throw new Error(`HTTP ${authResponse.status}: ${authResponse.statusText}`);
}

const authData = await authResponse.json();
```

#### Step 2: User Receives Email

The user receives an email with a verification code. This email is sent to the address provided in the request.
The user enters the verification code from the email into your application's interface.

#### Step 4: Build Secret from Email + Code

Generate the secret key using the email address and verification code combination:

```typescript
// The secret is built using email + verification code from email
function buildBunkerConnectionUrl(
  result: OpenBunkerResponse,
  secret: string,
  email: string
) {
  // Create a new bunker connection token with the secret
  if (!result.bunkerConnectionToken) {
    throw new Error('No bunker connection token available');
  }
  const url = new URL(result.bunkerConnectionToken);

  // FIXME this is a hack to get the secret and email into the bunker connection token
  const craftedSecret = secret + '+' + email;
  url.searchParams.set('secret', craftedSecret);
  return url.toString();
}
const secret = ... // This is gotten from your user via the interface
const bunkerConnectionTokenWithSecret = buildBunkerConnectionUrl(
  authData,
  secret,
  email
);

const bunkerSigner = new BunkerSigner(secret, bunkerPointer);
// Connect to bunker for remote signing
await bunkerSigner.connect();
```

#### Considerations for Email Flow

- The secret is not included in the bunker token returned by the API
- Secret is built using email + verification code from email, which is not standard and it would be better to extend NIP-46 to add such parameters to a NIP-46 connect request

## Flow Selection Guidelines

- **NostrConnect Flow**: Recommended for initial connections, provides seamless UX
- **Bunker Token Flow**: Use when you have pre-generated tokens or need token-based auth
- **Email Flow**: Use when popup windows are restricted or email verification within the app is preferred

# Queue Example - 6-Digit Code Flow

A minimal standalone example showing the "requests" flow where your app handles the 6-digit code input and submits events after successful authentication. **This is a fully working implementation** that uses the OpenBunker API and [nostr-tools](https://github.com/nbd-wtf/nostr-tools) v2.19.3 BunkerSigner.

## What This Demonstrates

- Email-based authentication with verification code
- Custom UI for the 6-digit code input (your app controls the UX)
- Complete bunker connection flow using nostr-tools
- Event signing with BunkerSigner

## Files

```bash
queue/
├── index.html   # Main HTML with email/code/success screens
├── style.css    # Styles for the UI
└── README.md    # This file
```

## How It Works

### Step 1: Request Verification Code

User enters their email. Your app calls the OpenBunker API:

```javascript
const response = await fetch(
  'https://openbunker.opencollective.xyz/api/openbunker-unauthenticated-token',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      scope: 'community-requests', // Your community/app identifier
    }),
  }
);

const data = await response.json();
// data.bunkerConnectionToken - store this for step 3
// data.success - true if code was sent
```

### Step 2: User Enters 6-Digit Code

Display 6 input boxes. The example includes:

- Auto-advance to next input on entry
- Backspace navigation
- Paste support for full code

```html
<div class="code-container">
  <input type="text" class="code-input" maxlength="1" inputmode="numeric" />
  <!-- ... 5 more inputs -->
</div>
```

### Step 3: Verify Code and Connect

When the user enters the 6-digit code, your app connects using BunkerSigner:

```javascript
import * as NostrTools from 'https://esm.sh/nostr-tools@2.19.3';
import {
  BunkerSigner,
  parseBunkerInput,
} from 'https://esm.sh/nostr-tools@2.19.3/nip46';

// Add the secret code to the bunker URL
const url = new URL(bunkerToken);
url.searchParams.set('secret', code);

// Generate a local private key for this session
const localPrivKey = NostrTools.generateSecretKey();
const bunkerPointer = await parseBunkerInput(url.toString());

// Create and connect the BunkerSigner
const signer = await BunkerSigner.fromBunker(localPrivKey, bunkerPointer, {
  onauth: async authUrl => {
    // If code is wrong, popup will open for authentication
    // Handle popup auth flow here
    await handlePopupAuth(authUrl);
    throw new Error('POPUP_AUTH_COMPLETE');
  },
});

await signer.connect();
const pubkey = await signer.getPublicKey();
```

**Note:** If the user enters an incorrect code, the `onauth` callback is triggered, which opens a popup for authentication. This provides a fallback authentication method.

### Step 4: Submit Events

Once authenticated, sign and submit Nostr events using the signer:

```javascript
const event = {
  kind: 1,
  content: 'Hello from OpenBunker Queue Example!',
  tags: [],
  created_at: Math.floor(Date.now() / 1000),
};

// The bunker signs this event with the user's key
const signedEvent = await signer.signEvent(event);

// Now you can publish signedEvent to Nostr relays
```

## Configuration

The example uses the production OpenBunker instance:

```javascript
const CONFIG = {
  OPENBUNKER_ORIGIN: 'https://openbunker.opencollective.xyz',
  OPENBUNKER_API_URL:
    'https://openbunker.opencollective.xyz/api/openbunker-unauthenticated-token',
};
```

**Note:** The example imports `nostr-tools@2.19.3` from esm.sh CDN using ESM imports at the top of the script. Both the main module and the nip46 sub-module are imported to access core utilities and `BunkerSigner`/`parseBunkerInput`.

## Running the Example

### Option 1: Open directly

Just open `index.html` in your browser.

**This example works directly in the browser!** The nostr-tools library is loaded from CDN, and the OpenBunker API has proper CORS headers.

### Option 2: Use a local server

```bash
# From the examples/queue directory
npx serve .
# or
python -m http.server 8000
```

## API Reference

### POST /api/openbunker-unauthenticated-token

Request a verification code for an email.

**Request:**

```json
{
  "email": "user@example.com",
  "scope": "community-requests"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Verification code sent",
  "bunkerConnectionToken": "bunker://...",
  "tokenId": "uuid"
}
```

### Bunker Connection

After receiving the `bunkerConnectionToken`, the example uses the NIP-46 BunkerSigner implementation from nostr-tools:

1. **Parse the bunker URI** - The token is a `bunker://` URL containing the remote signer's pubkey
2. **Add the secret** - The 6-digit code is added as the `secret` query parameter
3. **Create BunkerSigner** - Connects to the bunker using a local ephemeral key
4. **Handle auth popup** - If needed, the bunker may request OAuth authentication via popup
5. **Sign events** - Once connected, use `signer.signEvent()` to sign Nostr events

This implementation is based on the production code from [openletter](https://github.com/rabble/openletter), which successfully uses OpenBunker for email authentication.

See [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) for the full Nostr bunker protocol specification.

## Event Queue Pattern

The "queue" pattern allows you to:

1. Let users compose content before authenticating
2. Queue the event for submission
3. Process the queue after authentication succeeds

```javascript
// Before auth - queue the event
const pendingEvents = [];

pendingEvents.push({
  kind: 1,
  content: 'User wrote this before logging in',
  tags: [],
});

// After auth - process queue
for (const event of pendingEvents) {
  const signed = await bunkerSigner.signEvent(event);

  await publishToRelays(signed);
}

pendingEvents.length = 0;
```

## Customization

### Custom Scope

The `scope` parameter identifies your community or app:

```javascript
{
  body: JSON.stringify({
    email,
    scope: 'my-community-name',
  });
}
```

### Custom Code Input Style

Edit `style.css` to change the appearance of the code inputs:

```css
.code-input {
  width: 3rem;
  height: 3.5rem;
  font-size: 1.5rem;
  /* your styles */
}
```

### Error Handling

The example shows errors in a red box. Customize the error display:

```javascript
function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}
```

## Security Notes

- The 6-digit code expires after a short time
- Codes are single-use
- The `bunkerConnectionToken` should be kept in memory, not persisted
- Always use HTTPS in production

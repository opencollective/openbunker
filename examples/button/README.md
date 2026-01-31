# Button Example - Login with OpenBunker

A minimal standalone example showing the default "Login with OpenBunker" button flow with an optional email address input field. This example uses [nostr-tools](https://github.com/nbd-wtf/nostr-tools) v2.19.3 to decode the bunker URL and extract the user's npub.

## What This Demonstrates

- Simple popup-based authentication with OpenBunker
- Optional email pre-fill for faster onboarding
- Listening for authentication success via `postMessage`

## Files

```bash
button/
├── index.html   # Main HTML with the login button
├── style.css    # Styles for the UI
└── README.md    # This file
```

## How It Works

### 1. User Clicks "Login with OpenBunker"

The button opens a popup window pointing to the OpenBunker login page:

```javascript
const url = new URL(
  'https://openbunker.opencollective.xyz/openbunker-login-popup'
);

if (email) {
  url.searchParams.set('email', email);
}

window.open(url.toString(), 'openbunker-login', 'width=500,height=600');
```

### 2. User Authenticates in the Popup

The user completes authentication in the OpenBunker popup (social login, email, etc.)

### 3. Popup Sends Success Message

When authentication succeeds, OpenBunker sends a `postMessage` to the parent window:

```javascript
// OpenBunker sends this:
window.opener.postMessage(
  {
    type: 'openbunker-auth-success',
    npub: 'npub1...',
    // other data...
  },
  '*'
);
```

### 4. Your App Receives the Message

Listen for the message and update your UI:

```javascript
window.addEventListener('message', event => {
  // Optional: verify origin
  // if (event.origin !== 'https://openbunker.opencollective.xyz') return;

  if (event.data && event.data.type === 'openbunker-auth-success') {
    console.log('Authenticated!', event.data.npub);
    // Update your app state
  }
});
```

## Configuration

Edit the `CONFIG` object in `index.html`:

```javascript
const CONFIG = {
  OPENBUNKER_POPUP_URL:
    'https://openbunker.opencollective.xyz/openbunker-login-popup',
};
```

## Running the Example

### Option 1: Open directly

Just open `index.html` in your browser.

### Option 2: Use a local server

```bash
# From the examples/button directory
npx serve .
# or
python -m http.server 8000
```

Then visit `http://localhost:8000` (or `http://localhost:3000` for serve).

## Customization

### Pre-fill Email

Pass an email to speed up the signup process:

```javascript
url.searchParams.set('email', 'user@example.com');
```

### Custom Styling

Edit `style.css` to match your app's design.

### Redirect Instead of Popup

For mobile or when popups are blocked, use redirect flow:

```javascript
// Redirect to OpenBunker with a return URL
const url = new URL(
  'https://openbunker.opencollective.xyz/openbunker-login-popup'
);

url.searchParams.set('redirectUrl', window.location.href);

window.location.href = url.toString();
```

## Security Notes

- Consider verifying `event.origin` in the message handler
- The popup URL should always use HTTPS in production
- Store authentication tokens securely (not in localStorage for sensitive apps)

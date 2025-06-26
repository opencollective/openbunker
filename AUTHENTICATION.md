# OpenBunker Authentication System

This document explains the authentication system implemented in OpenBunker, which provides multiple ways for users to authenticate and get Nostr keys.

## Authentication Methods

### 1. Secret Key Authentication
Users can authenticate directly with their existing Nostr secret key (nsec1...). This method:
- Validates the secret key format
- Stores the key locally in the browser
- Uses the key to sign Nostr events

### 2. OpenBunker Authentication (Discord OAuth)
Users can authenticate through Discord OAuth to get a new Nostr key. This method:
- Redirects users to Discord for OAuth
- Exchanges the Discord code for user information
- Generates a new Nostr secret key
- Returns the key to the user

## Development Mode

When `NODE_ENV=development`, the Discord OAuth flow is automatically faked for easier testing:

- **No Discord App Required**: You don't need to set up a Discord application for development
- **Simulated Flow**: The OAuth process is simulated with fake user data
- **Real Nostr Keys**: Still generates real Nostr secret keys for testing
- **Visual Indicators**: Development mode is clearly indicated in the UI

### Development Mode Features
- Fake Discord user data is generated
- OAuth flow is simulated with realistic delays
- No popup windows (direct redirect)
- Clear development mode indicators in the UI

## Setup Instructions

### Environment Variables
Create a `.env.local` file with the following variables:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Discord OAuth Configuration (only needed for production)
NEXT_PUBLIC_DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

### Discord Application Setup (Production Only)
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 settings
4. Add redirect URI: `http://localhost:3000/openbunker-auth`
5. Copy the Client ID and Client Secret to your environment variables

## Pages and Components

### Pages
- `/login` - Main login page with authentication options
- `/example` - Application example showing user information
- `/openbunker-auth` - Discord OAuth flow handler

### Components
- `LoginOptions` - Main component for choosing authentication method
- `SecretKeyLogin` - Form for entering Nostr secret key
- `OpenBunkerLogin` - Button to start Discord OAuth flow

### API Endpoints
- `/api/auth/openbunker-url` - Returns OpenBunker authentication URL
- `/api/auth/discord-callback` - Handles Discord OAuth callback

## User Flow

### Secret Key Authentication
1. User visits `/login`
2. Clicks "Authenticate with Secret Key"
3. Enters their nsec1 secret key
4. Key is validated and stored locally
5. User is redirected to home page

### OpenBunker Authentication (Development)
1. User visits `/login`
2. Clicks "Authenticate with OpenBunker"
3. Sees development mode indicator
4. Redirects to OAuth simulation page
5. Simulated Discord OAuth generates new Nostr key
6. User is redirected back to login with the new key
7. Key is stored and user is redirected to home page

### OpenBunker Authentication (Production)
1. User visits `/login`
2. Clicks "Authenticate with OpenBunker"
3. Popup opens with Discord OAuth
4. User authorizes with Discord
5. Discord callback generates new Nostr key
6. User is redirected back to login with the new key
7. Key is stored and user is redirected to home page

## Security Notes

- Secret keys are stored locally in the browser's localStorage
- Keys are never sent to the server (except for OpenBunker flow)
- Discord OAuth uses secure token exchange
- All authentication is client-side for secret key method
- Development mode uses fake data and simulated flows

## Future Enhancements

- Add proper Nostr key generation using nostr-tools
- Implement database storage for user profiles
- Add more OAuth providers (GitHub, Google, etc.)
- Implement proper key derivation from Discord user data
- Add session management and token refresh 
# OpenBunker

A Discord-like login app for onboarding members to Nostr communities with real-time relay listening capabilities.

## Features

- **Multiple Authentication Methods**: 
  - Email-based authentication with 6-digit verification codes
  - Direct Nostr secret key authentication
  - Discord OAuth authentication via OpenBunker
- **Nostr Integration**: Real-time connection to Nostr relays
- **WebSocket Server**: Long-running process for real-time communication
- **Modern UI**: Beautiful Discord-inspired interface with Tailwind CSS
- **TypeScript**: Full type safety throughout the application
- **Application Example**: Demo page showing authentication integration

## Architecture

The application consists of two main parts:

1. **Next.js Frontend**: React-based web application with authentication and Nostr event display
2. **WebSocket Server**: Long-running Node.js process that handles real-time communication and Nostr relay connections

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create .env.local file
WS_PORT=3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social,wss://nostr.wine
NODE_ENV=development

# For Discord OAuth (optional)
NEXT_PUBLIC_DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Run the development servers:
```bash
# Run both Next.js and WebSocket servers
npm run dev:all

# Or run them separately:
npm run websocket  # WebSocket server on port 3001
npm run dev        # Next.js app on port 3000
```

### Development

- **Frontend**: http://localhost:3000
- **Login Page**: http://localhost:3000/login
- **Example Page**: http://localhost:3000/example
- **WebSocket Server**: ws://localhost:3001
- **API Routes**: http://localhost:3000/api/auth/*

## Authentication Methods

### 1. Email Authentication
Traditional email-based authentication with 6-digit verification codes.

### 2. Secret Key Authentication
Direct authentication using existing Nostr secret keys (nsec1...). Keys are stored locally and used to sign events.

### 3. OpenBunker Authentication
Discord OAuth flow that generates new Nostr keys for users. Perfect for onboarding new users to Nostr.

## Pages

- **Home Page** (`/`): Main dashboard with Nostr events and user profile
- **Login Page** (`/login`): Authentication options and forms
- **Example Page** (`/example`): Application example showing integration
- **OpenBunker Auth** (`/openbunker-auth`): Discord OAuth flow handler

## Nostr Integration

The app listens to Nostr relays for events of kind 24450 (community onboarding events). The WebSocket server acts as a bridge between the frontend and Nostr relays.

### Relay Configuration

Default relays:
- wss://relay.damus.io
- wss://nos.lol  
- wss://relay.snort.social
- wss://nostr.wine

### Event Types

- **Kind 24450**: Community onboarding events
- **Real-time**: Events are displayed as they arrive from relays

## Authentication Flow

### Email Authentication
1. User enters email address
2. System sends 6-digit verification code
3. User enters verification code
4. System validates code and creates user session
5. User is authenticated and can view Nostr events

### Secret Key Authentication
1. User visits `/login`
2. Clicks "Authenticate with Secret Key"
3. Enters their nsec1 secret key
4. Key is validated and stored locally
5. User is redirected to home page

### OpenBunker Authentication
1. User visits `/login`
2. Clicks "Authenticate with OpenBunker"
3. Popup opens with Discord OAuth
4. User authorizes with Discord
5. Discord callback generates new Nostr key
6. User is redirected back to login with the new key
7. Key is stored and user is redirected to home page

## API Endpoints

### POST /api/auth/send-code
Send verification code to email address.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Verification code sent successfully",
  "code": "123456" // Only in development
}
```

### POST /api/auth/verify-code
Verify the 6-digit code and authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "id": "user_1234567890",
  "email": "user@example.com",
  "name": "user",
  "created_at": "2024-01-01T00:00:00.000Z",
  "nostr_pubkey": "npub1..."
}
```

### GET /api/auth/openbunker-url
Get OpenBunker authentication URL for Discord OAuth.

**Response:**
```json
{
  "authUrl": "http://localhost:3000/openbunker-auth"
}
```

### POST /api/auth/discord-callback
Handle Discord OAuth callback and generate Nostr key.

**Request:**
```json
{
  "code": "discord_oauth_code"
}
```

**Response:**
```json
{
  "secretKey": "nsec1...",
  "user": {
    "id": "discord_user_id",
    "username": "username",
    "email": "user@example.com",
    "avatar": "avatar_url"
  }
}
```

## WebSocket Messages

### Client to Server

**Subscribe to Nostr events:**
```json
{
  "type": "subscribe_nostr",
  "filter": {
    "kinds": [24450],
    "p": ["npub1..."]
  }
}
```

**Send Nostr event:**
```json
{
  "type": "send_nostr_event",
  "event": {
    "kind": 24450,
    "content": "Hello Nostr!",
    "tags": []
  }
}
```

### Server to Client

**Connection established:**
```json
{
  "type": "connection",
  "message": "Connected to OpenBunker WebSocket server",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "nostrRelays": ["wss://relay.damus.io", ...]
}
```

**Nostr event received:**
```json
{
  "type": "nostr_event",
  "event": {
    "id": "event_123",
    "pubkey": "npub1...",
    "created_at": 1704067200,
    "kind": 24450,
    "content": "Event content",
    "sig": "signature"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Project Structure

```
openbunker/
├── src/
│   ├── app/
│   │   ├── api/auth/
│   │   │   ├── send-code/route.ts
│   │   │   ├── verify-code/route.ts
│   │   │   ├── openbunker-url/route.ts
│   │   │   └── discord-callback/route.ts
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── example/
│   │   │   └── page.tsx
│   │   ├── openbunker-auth/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   ├── LoginOptions.tsx
│   │   ├── SecretKeyLogin.tsx
│   │   ├── OpenBunkerLogin.tsx
│   │   ├── UserProfile.tsx
│   │   └── NostrEvents.tsx
│   └── contexts/
│       ├── AuthContext.tsx
│       └── NostrContext.tsx
├── server/
│   ├── websocket-server.js
│   └── nostr-listener.js
├── AUTHENTICATION.md
└── README.md
```

## Documentation

- [Authentication System Documentation](./AUTHENTICATION.md) - Detailed guide for the authentication system

## Production Deployment

### Environment Variables

Set these in your production environment:

```bash
WS_PORT=3001
NEXT_PUBLIC_WS_URL=wss://your-domain.com
NEXT_PUBLIC_NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol
NODE_ENV=production
```

### Build and Deploy

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Inspired by Discord's authentication flow
- Built with Next.js 15 and Tailwind CSS
- Nostr integration using nostr-tools
- WebSocket server for real-time communication


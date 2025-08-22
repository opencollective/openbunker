# OpenBunker Unauthenticated Token API

This document describes the OpenBunker Unauthenticated Token API that provides a simple way for new users to get authenticated with the OpenBunker system without going through the complex community request flow.

## Overview

The Unauthenticated Token API enables new users to quickly get set up with OpenBunker by providing their email and name. The system automatically generates a Nostr key pair and returns a bunker connection token that can be used immediately. For existing users, it provides a redirect to the login popup.

## API Endpoints

### 1. Create Unauthenticated Token

**POST** `/api/openbunker-unauthenticated-token`

Create a new Nostr key and connection token for a new user, or redirect existing users to sign in.

#### Request Body

```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

#### Response for New Users

```json
{
  "success": true,
  "message": "New user key created successfully",
  "bunkerConnectionToken": "bunker://abc123...?relay=wss://relay.nsec.app&secret=def456...",
  "npub": "npub1abc123...",
  "connectionToken": "def456...",
  "keyId": "npub1abc123...",
  "existingUser": false
}
```

#### Response for Existing Users

```json
{
  "success": false,
  "message": "User with this email already exists. Please sign in to continue.",
  "redirectUrl": "http://localhost:3000/openbunker-login-popup",
  "existingUser": true
}
```

### 2. Check User Existence

**GET** `/api/openbunker-unauthenticated-token?email={email}`

Check if a user with the given email already exists in the system.

#### Response for Existing Users

```json
{
  "exists": true,
  "npub": "npub1abc123...",
  "name": "User Name",
  "message": "User with this email already exists"
}
```

#### Response for New Users

```json
{
  "exists": false,
  "message": "No user found with this email"
}
```

## User Flow

### New Users

1. User provides email and name
2. System generates a new Nostr key pair
3. System creates a connection token
4. User receives a bunker connection token
5. User can immediately use the token to connect to OpenBunker

### Existing Users

1. User provides email
2. System detects existing user
3. System redirects user to login popup
4. User signs in with existing credentials

## Bunker Connection Token Format

The bunker connection token follows this format:
```
bunker://{hex_public_key}?relay={relay_url}&secret={connection_token}
```

Example:
```
bunker://abc123def456...?relay=wss://relay.nsec.app&secret=ghi789jkl012...
```

## Integration with Community Requests

This API is designed to be used by the community-requests frontend to:

1. **Check user status** before submitting requests
2. **Create new users** automatically when needed
3. **Redirect existing users** to proper authentication
4. **Provide immediate access** to new users via bunker connection tokens

## Environment Variables

```bash
# OpenBunker Frontend URL
NEXT_PUBLIC_OPENBunker_URL="http://localhost:3000"

# Nostr Relay Configuration
NEXT_PUBLIC_BUNKER_RELAYS="wss://relay.nsec.app"
```

## Security Considerations

- Connection tokens expire after 10 minutes
- Tokens are cryptographically secure (16 bytes)
- New keys are generated with proper entropy
- Existing user detection prevents duplicate key creation
- Proper error handling and validation

## Database Models Used

The API uses existing OpenBunker models:
- `Keys` - Stores Nostr key information
- `ConnectTokens` - Stores connection tokens with expiration

No new database models are required for this simplified approach.

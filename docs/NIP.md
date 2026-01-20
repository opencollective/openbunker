# Nostr Implementation Possibilities (NIPs) Documentation

This document describes all Nostr protocol implementations, NIPs (Nostr Implementation Possibilities), and Nostr-related functionality used in OpenBunker.

## Table of Contents

- [NIP-05 Resolution](#nip-05-resolution)
- [Kind: 0 Event Fetching](#kind-0-event-fetching)
- [Scope-Level Application Restrictions](#scope-level-application-restrictions)

---

## NIP-05 Resolution

**NIP**: [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md)  
**Implementation Date**: 2025-01-27  
**Location**: `src/utils/nip05Utils.ts`

### Purpose

Resolves application canonical URLs to Nostr pubkeys using the NIP-05 protocol. This enables OpenBunker to identify applications by their canonical URLs and fetch their Nostr public keys for profile retrieval.

### Implementation Details

#### Function: `resolveNip05(canonicalUrl: string): Promise<string | null>`

**Input**: Canonical URL (e.g., `https://app.example.com` or `app@example.com`)

**Process**:

1. Parse URL to extract domain and optional local-part
2. Construct NIP-05 query URL: `https://<domain>/.well-known/nostr.json?name=<local-part>`
3. Fetch JSON response with timeout (3 seconds)
4. Extract pubkey from response `names` mapping
5. Validate pubkey format (64-character hex string)

**Output**: Resolved pubkey in hex format, or `null` if resolution fails

**Error Handling**:

- Timeout after 3 seconds
- HTTP errors (404, 500, etc.)
- Invalid JSON response
- Missing or invalid pubkey format
- All errors are logged but don't throw exceptions

### Usage Example

```typescript
import { resolveNip05 } from '@/utils/nip05Utils';

const pubkey = await resolveNip05('https://app.example.com');
if (pubkey) {
  console.log('Resolved pubkey:', pubkey);
} else {
  console.log('Resolution failed');
}
```

### Notes

- Supports both URL format (`https://app.example.com`) and email format (`app@example.com`)

---

## Kind: 0 Event Fetching

**NIP**: Standard Nostr Profile Event (Kind 0)  
**Implementation Date**: 2025-01-27  
**Location**: `src/lib/nostr/appProfile.ts`

### Purpose

Fetches application profile information (name, icon, description) from Nostr relays by querying kind: 0 events. This enables OpenBunker to display application information in verification emails.

### Implementation Details

#### Function: `fetchAppProfile(pubkey: string, relays?: string[]): Promise<AppProfile | null>`

**Input**:

- `pubkey`: Application pubkey in hex format
- `relays`: Optional array of relay URLs (defaults to `['wss://relay.damus.io', 'wss://relay.nsec.app', 'wss://nos.lol']`)

**Process**:

1. Create SimplePool from nostr-tools
2. Query relays with filter: `{ kinds: [0], authors: [pubkey] }`
3. Get most recent kind: 0 event (highest `created_at`)
4. Parse event content as JSON to extract:
   - `name`: Application name
   - `picture` or `avatar`: Application icon URL
   - `about` or `description`: Application description

**Output**: `AppProfile` object with `pubkey`, `name`, `icon`, `description`, `fetchedAt`, or `null` if fetch fails

**Error Handling**:

- Timeout after 5 seconds
- Relay connection failures
- No events found
- Invalid JSON in event content
- All errors are logged but return `null`

#### Function: `getApplicationProfile(canonicalUrl: string, relays?: string[]): Promise<AppProfile | null>`

**Purpose**: Combines NIP-05 resolution and kind: 0 fetching into a single operation.

**Process**:

1. Resolve canonical URL to pubkey via NIP-05
2. If resolution fails, return fallback profile with URL as name
3. Fetch kind: 0 event from relays
4. If fetch fails, return fallback profile with pubkey

**Fallback Behavior**:

- Always returns an `AppProfile` object (never `null`)
- Uses canonical URL as name if profile fetch fails
- Ensures email sending is never blocked by profile fetch failures

### Usage Example

```typescript
import { getApplicationProfile } from '@/lib/nostr/appProfile';

const profile = await getApplicationProfile('https://app.example.com');
console.log('App name:', profile.name);
console.log('App icon:', profile.icon);
console.log('App description:', profile.description);
```

### Notes

- Default relays are public Nostr relays
- Profile fetching is non-blocking for email sending
- No caching is implemented; each request performs fresh resolution and fetching

---

## Scope-Level Application Restrictions

**Implementation Date**: 2025-01-27  
**Locations**:

- `src/lib/scopes/restrictions.ts` (Validation logic)
- `src/app/(openbunker)/api/scopes/[slug]/route.ts` (API endpoints)
- `src/app/(openbunker)/api/openbunker-unauthenticated-token/route.ts` (Connection request validation)

### Purpose

Allows scope owners to restrict which applications can request connections within their scope, providing enhanced security and control over community access.

### Implementation Details

#### Database Schema

**Table**: `Scopes`  
**Field**: `allowedApplications` (JSONB, nullable)

**Format**: Array of strings, e.g., `["npub1abc...", "https://app.example.com"]`

**Values**:

- `null` or `[]`: All applications allowed (default behavior)
- Populated array: Only listed applications allowed

**Identifier Types Supported**:

- Nostr pubkey in hex format (64 characters)
- Nostr pubkey in npub format (bech32, starts with "npub1")
- Canonical URL (starts with "http://" or "https://")

#### Function: `validateAppAllowed(appIdentifier: string, allowedApplications: string[] | null | undefined): Promise<boolean>`

**Input**:

- `appIdentifier`: Application identifier (pubkey or URL) from connection request
- `allowedApplications`: Array from scope configuration (can be `null`, `undefined`, or array)

**Process**:

1. If `allowedApplications` is `null` or empty: return `true` (allow all)
2. Validate and normalize requesting application identifier
3. For each allowed identifier:
   - Normalize to hex format if pubkey
   - Compare directly if URLs
   - Resolve URLs to pubkeys via NIP-05 if needed for comparison
4. Return `true` if match found, `false` otherwise

**Comparison Logic**:

- Pubkey vs Pubkey: Compare hex values (case-insensitive)
- URL vs URL: Compare canonical URLs directly
- URL vs Pubkey: Resolve URL to pubkey via NIP-05, then compare
- Pubkey vs URL: Resolve URL to pubkey via NIP-05, then compare

**Output**: `true` if application is allowed, `false` otherwise

### API Integration

#### Connection Request Validation

**Endpoint**: `POST /api/openbunker-unauthenticated-token`

**Process**:

1. Extract `appUrl` from request body (optional)
2. Fetch scope configuration from database
3. If `appUrl` provided, validate against scope restrictions
4. Return `403 Forbidden` if application not allowed
5. Continue with connection request if allowed

#### Scope Configuration

**Endpoints**:

- `GET /api/scopes/{slug}`: Returns scope with `allowedApplications` field
- `PATCH /api/scopes/{slug}`: Updates scope including `allowedApplications`
- `PUT /api/scopes`: Updates scope including `allowedApplications`

**Validation**:

- Validates each identifier format before saving
- Normalizes pubkeys to hex format
- Removes duplicates
- Stores in consistent format

### Usage Example

```typescript
import { validateAppAllowed } from '@/lib/scopes/restrictions';

const isAllowed = await validateAppAllowed('https://app.example.com', [
  'npub1abc...',
  'https://app.example.com',
]);

if (!isAllowed) {
  return { error: 'Application not allowed in this scope' };
}
```

### Notes

- Default behavior (null/empty array) allows all applications
- Validation is performed before processing connection requests
- NIP-05 resolution is used for URL-to-pubkey comparison
- Changes take effect immediately upon scope update

---

## Related Documentation

- [NIP-05 Specification](https://github.com/nostr-protocol/nips/blob/master/05.md)
- [Nostr Protocol Basics](https://nostr.com/)
- [nostr-tools Documentation](https://github.com/nbd-wtf/nostr-tools)

---

**Last Updated**: 2025-01-27  
**Maintainer**: OpenBunker Development Team

# Data Model: Application Information Handling

**Date**: 2025-01-27  
**Feature**: Application Information Handling  
**Phase**: Phase 1 - Design

## Database Schema Changes

### Modified Model: Scopes

**Change**: Add `allowedApplications` field to store list of allowed application identifiers.

```prisma
model Scopes {
  id        String   @id
  slug      String   @unique
  name      String
  description String
  owner     String   // User ID who owns this scope
  keyNpub   String   // Generated key for this scope
  allowedApplications Json?  // NEW: Array of allowed application pubkeys or URLs
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relation to the generated key
  key       Keys     @relation(fields: [keyNpub], references: [npub], onDelete: Cascade)

  @@index([slug])
  @@index([owner])
}
```

**Field Details**:

- **Type**: `Json?` (nullable JSON)
- **Default**: `null` (null means all applications allowed)
- **Format**: Array of strings, e.g., `["npub1abc...", "https://app.example.com"]`
- **Validation**:
  - If null or empty array: all applications allowed (default behavior)
  - If populated: only applications in the list are allowed
  - Each string can be:
    - Nostr pubkey in hex format (64 chars)
    - Nostr pubkey in npub format (starts with "npub1")
    - Canonical URL (starts with "http://" or "https://")

**Migration**:

- Add column with default null
- Existing scopes will have null (all applications allowed)
- No data migration needed

## Data Entities

### Application Profile (In-Memory)

**Purpose**: Represents fetched application information from Nostr.

**Fields**:

- `pubkey` (string): Application's Nostr pubkey in hex format
- `canonicalUrl` (string, optional): Original canonical URL used for resolution
- `name` (string, optional): Application name from kind: 0 event
- `icon` (string, optional): Application icon/avatar URL from kind: 0 event
- `description` (string, optional): Application description/about from kind: 0 event
- `fetchedAt` (number): Timestamp when profile was fetched (for caching)

**Storage**: Not persisted, cached in memory with TTL

### Scope Application Restrictions (Database)

**Purpose**: Stores scope-level application restrictions.

**Fields** (from Scopes model):

- `allowedApplications` (Json?, nullable): Array of allowed application identifiers

**Validation Rules**:

1. If `allowedApplications` is null: All applications allowed (default)
2. If `allowedApplications` is empty array `[]`: All applications allowed
3. If `allowedApplications` contains values: Only listed applications allowed
4. Each identifier must be:
   - Valid Nostr pubkey (hex or npub format), OR
   - Valid canonical URL (http/https)

**State Transitions**:

- Initial state: `null` (all applications allowed)
- Restriction added: Array populated with application identifiers
- Restriction removed: Set back to `null` or empty array
- Application added: Append to array
- Application removed: Remove from array

## Relationships

### Scopes → Application Restrictions

- **Type**: One-to-many (one scope can restrict many applications)
- **Storage**: JSON array in `allowedApplications` field
- **Validation**: Performed at API route level before processing connection requests

## Validation Rules

### Application Identifier Validation

1. **Pubkey Format**:
   - Hex: 64 character hexadecimal string (case-insensitive)
   - Npub: Bech32 encoded, starts with "npub1", decode to hex for comparison

2. **URL Format**:
   - Must start with "http://" or "https://"
   - Must be valid URL format
   - Domain must be resolvable (for NIP-05)

3. **Comparison Logic**:
   - Normalize all pubkeys to hex format for comparison
   - For URLs: Compare canonical URLs directly
   - Case-insensitive comparison for pubkeys

### Scope Restriction Validation

1. **Connection Request Validation**:
   - Extract application identifier from request (pubkey or URL)
   - If scope has `allowedApplications` null or empty: Allow
   - If scope has `allowedApplications` populated: Check if identifier is in list
   - If not in list: Reject with 403 Forbidden

2. **Configuration Validation**:
   - When updating `allowedApplications`:
     - Validate each identifier format
     - Remove duplicates
     - Normalize pubkeys to hex format
     - Store in consistent format

## Data Flow

### Application Profile Fetching

```
Connection Request
  ↓
Extract canonical URL
  ↓
Resolve NIP-05 → pubkey
  ↓
Fetch kind: 0 event from relays
  ↓
Parse profile data (name, icon, description)
  ↓
Use in email template
```

### Scope Restriction Validation

```
Connection Request
  ↓
Extract scope slug
  ↓
Query Scopes table for scope
  ↓
Check allowedApplications field
  ↓
If null/empty: Allow
If populated: Validate application identifier
  ↓
Allow or Reject (403)
```

## Caching Strategy

### Application Profile Cache

- **Key**: Canonical URL or pubkey (hex)
- **Value**: Application Profile object
- **TTL**: 30 minutes
- **Storage**: In-memory Map
- **Invalidation**: TTL expiration or manual refresh

### NIP-05 Resolution Cache

- **Key**: Canonical URL
- **Value**: Resolved pubkey (hex)
- **TTL**: 1 hour
- **Storage**: In-memory Map
- **Invalidation**: TTL expiration

## Migration Plan

1. **Create Migration**:

   ```sql
   ALTER TABLE "Scopes" ADD COLUMN "allowedApplications" JSONB;
   ```

2. **Update Prisma Schema**: Add field to Scopes model

3. **Generate Prisma Client**: Run `npx prisma generate`

4. **Test Migration**: Verify existing scopes have null value

5. **Deploy**: Run migration in production

## Notes

- Application profiles are not persisted to avoid stale data
- Cache is in-memory only (consider Redis for production scale)
- Scope restrictions are stored as JSON for flexibility
- Future enhancement: Separate table for application restrictions if needed

# Research: Application Information Handling

**Date**: 2025-01-27  
**Feature**: Application Information Handling  
**Phase**: Phase 0 - Research

## Research Questions

### 1. NIP-05 Resolution Implementation

**Question**: How to resolve application canonical URLs to Nostr pubkeys using NIP-05?

**Decision**: Use HTTP GET request to `https://<domain>/.well-known/nostr.json?name=<local-part>` following NIP-05 specification.

**Rationale**:

- NIP-05 is the standard protocol for mapping identifiers to Nostr pubkeys
- Simple HTTP-based resolution that doesn't require Nostr relay access
- Well-documented and widely supported

**Implementation Approach**:

1. Parse canonical URL to extract domain and local-part (if present)
2. Construct NIP-05 query URL: `https://<domain>/.well-known/nostr.json?name=<local-part>`
3. Fetch JSON response containing `names` mapping
4. Extract pubkey from response
5. Handle errors gracefully (timeout, 404, invalid format)

**Alternatives Considered**:

- Using NDK's built-in NIP-05 resolver: Not available in current NDK version
- Custom relay-based resolution: More complex, requires relay access, slower
- Caching resolved mappings: Will implement caching layer for performance

**References**:

- NIP-05: https://github.com/nostr-protocol/nips/blob/master/05.md
- nostr-tools library supports NIP-05 but may need custom implementation

### 2. Kind: 0 Event Fetching

**Question**: How to fetch application kind: 0 events from Nostr relays?

**Decision**: Use nostr-tools SimplePool to query relays for kind: 0 events filtered by pubkey.

**Rationale**:

- nostr-tools is already a dependency and provides SimplePool for relay queries
- Kind: 0 events are standard profile events, widely available
- SimplePool handles multiple relays and timeouts

**Implementation Approach**:

1. Use SimplePool from nostr-tools
2. Query relays with filter: `{ kinds: [0], authors: [pubkey] }`
3. Get most recent kind: 0 event (highest created_at)
4. Parse event content as JSON to extract name, picture (icon), about (description)
5. Handle errors gracefully (timeout, no events found, invalid JSON)

**Alternatives Considered**:

- Using NDK: More complex setup, requires NDK instance, overkill for simple queries
- Direct WebSocket to relays: More complex, requires manual connection management
- Caching fetched profiles: Will implement caching to reduce relay queries

**References**:

- nostr-tools SimplePool: https://github.com/nbd-wtf/nostr-tools
- Kind: 0 event specification: Standard Nostr profile event

### 3. Error Handling Strategy

**Question**: How to handle NIP-05 resolution and kind: 0 fetch failures without blocking email sending?

**Decision**: Implement timeout-based error handling with fallback to default values.

**Rationale**:

- Email verification should not be delayed by external service failures
- Users need to receive verification codes promptly
- Fallback values maintain user experience

**Implementation Approach**:

1. Set timeouts: NIP-05 resolution (3s), kind: 0 fetch (5s)
2. Use try-catch blocks around async operations
3. On failure, use fallback values:
   - Application name: Canonical URL or "Unknown Application"
   - Application icon: None or default icon
   - Application description: None
4. Log errors for debugging but don't fail the request
5. Continue with email sending using available information

**Alternatives Considered**:

- Retry logic: Adds complexity and delay, not worth it for non-critical data
- Queue for later processing: Over-engineered for this use case
- Fail fast: Poor user experience, blocks legitimate connections

### 4. Caching Strategy

**Question**: Should we cache resolved NIP-05 mappings and fetched kind: 0 events?

**Decision**: Implement in-memory caching with TTL for performance optimization.

**Rationale**:

- Application profiles don't change frequently
- Reduces external API calls and relay queries
- Improves response time for repeated requests

**Implementation Approach**:

1. Use Map-based in-memory cache keyed by canonical URL or pubkey
2. Cache TTL: 1 hour for NIP-05 mappings, 30 minutes for kind: 0 events
3. Cache invalidation: Manual refresh or TTL expiration
4. Consider Redis for production scale (future enhancement)

**Alternatives Considered**:

- Database caching: Adds database load, slower than memory
- No caching: Acceptable but less performant
- Long TTL: Risk of stale data, not recommended

### 5. Scope Application Restrictions Storage

**Question**: How to store and validate scope-level application restrictions?

**Decision**: Add `allowedApplications` JSON field to Scopes table storing array of pubkeys or URLs.

**Rationale**:

- Simple schema change, no new tables needed
- JSON array allows flexible storage (pubkeys or URLs)
- Easy to query and validate
- Supports empty array (all allowed) or null (all allowed) for default behavior

**Implementation Approach**:

1. Add `allowedApplications` JSON field to Scopes model (nullable, default null)
2. Store array of strings (pubkeys in hex or npub format, or canonical URLs)
3. Validation logic:
   - If null or empty array: allow all applications
   - If populated: check if requesting application pubkey/URL is in list
4. Normalize pubkeys to hex format for comparison
5. Support both pubkey and URL matching

**Alternatives Considered**:

- Separate table: More normalized but adds complexity
- String field with comma-separated values: Less flexible, harder to query
- Boolean flag + separate allowlist table: Over-engineered for current needs

### 6. Testing Approach

**Question**: What testing strategy should be used?

**Decision**: Manual testing for MVP, with integration tests for critical paths.

**Rationale**:

- Feature involves external services (NIP-05, Nostr relays) that are hard to mock
- Email sending requires actual email service testing
- Manual testing sufficient for initial implementation
- Integration tests can be added for NIP-05 resolution and kind: 0 fetching

**Implementation Approach**:

1. Manual testing checklist for:
   - NIP-05 resolution with valid/invalid URLs
   - Kind: 0 event fetching with valid/invalid pubkeys
   - Email rendering with application information
   - Scope restriction validation
2. Integration tests for:
   - NIP-05 resolution utility function
   - Kind: 0 event fetching utility function
   - Scope restriction validation logic
3. Use test relays and test NIP-05 endpoints where possible

**Alternatives Considered**:

- Full unit test suite: Overkill for MVP, can add later
- E2E tests: Complex setup, manual testing sufficient initially

## Resolved Clarifications

All NEEDS CLARIFICATION items from Technical Context have been resolved:

- ✅ Testing approach: Manual + integration tests for critical paths
- ✅ NIP-05 resolution: HTTP GET to .well-known/nostr.json
- ✅ Kind: 0 fetching: nostr-tools SimplePool
- ✅ Error handling: Timeout-based with fallbacks
- ✅ Caching: In-memory with TTL
- ✅ Storage: JSON field in Scopes table

## Next Steps

Proceed to Phase 1: Design & Contracts

- Create data-model.md with schema changes
- Create API contracts for modified endpoints
- Create quickstart.md for testing the feature

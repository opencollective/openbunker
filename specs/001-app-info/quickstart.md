# Quickstart: Application Information Handling

**Date**: 2025-01-27  
**Feature**: Application Information Handling  
**Purpose**: Guide for testing and validating the feature implementation

## Prerequisites

1. OpenBunker development environment set up
2. Database migrations applied
3. Environment variables configured:
   - `RESEND_API_KEY` (for email sending)
   - `DATABASE_URL` (for Prisma)
   - Nostr relay URLs accessible

## Testing User Story 1: Application Information in Email

### Setup

1. Ensure you have a valid scope created
2. Have an application with:
   - Valid NIP-05 identifier (e.g., `app@example.com`)
   - Published kind: 0 event on accessible relays
   - Profile fields: name, picture (icon), about (description)

### Test Case 1: Successful Application Profile Display

**Steps**:

1. Make POST request to `/api/openbunker-unauthenticated-token`:

   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug",
     "appUrl": "https://app.example.com"
   }
   ```

2. Check email inbox for verification email

3. Verify email contains:
   - Application name from kind: 0 event
   - Application icon (if available)
   - Application description (if available)
   - Verification code

**Expected Result**: Email displays application information correctly

### Test Case 2: NIP-05 Resolution Failure

**Steps**:

1. Make POST request with invalid NIP-05 URL:

   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug",
     "appUrl": "https://invalid-domain-that-does-not-exist-12345.com"
   }
   ```

2. Check email inbox

**Expected Result**:

- Email is still sent (not blocked)
- Email shows fallback information (URL or "Unknown Application")
- No error in API response

### Test Case 3: Kind: 0 Event Not Found

**Steps**:

1. Make POST request with valid NIP-05 but no kind: 0 event:

   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug",
     "appUrl": "https://app-with-no-profile.example.com"
   }
   ```

2. Check email inbox

**Expected Result**:

- Email is still sent
- Email shows available information (name from NIP-05 or fallback)
- No icon or description displayed

### Test Case 4: Missing appUrl Parameter

**Steps**:

1. Make POST request without appUrl:
   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug"
   }
   ```

**Expected Result**:

- Request succeeds (appUrl is optional)
- Email sent without application information
- Email shows scope information only

## Testing User Story 2: Scope Application Restrictions

### Setup

1. Create or use existing scope
2. Ensure you're authenticated as scope owner

### Test Case 1: Allow All Applications (Default)

**Steps**:

1. Get scope details:

   ```bash
   GET /api/scopes/{slug}
   ```

2. Verify `allowedApplications` is `null` or `[]`

3. Make connection request from any application:
   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug",
     "appUrl": "https://any-app.example.com"
   }
   ```

**Expected Result**: Connection request succeeds

### Test Case 2: Restrict to Specific Applications

**Steps**:

1. Update scope with allowed applications:

   ```bash
   PATCH /api/scopes/{slug}
   {
     "allowedApplications": ["npub1abc123...", "https://allowed-app.example.com"]
   }
   ```

2. Verify update succeeded:

   ```bash
   GET /api/scopes/{slug}
   ```

3. Make connection request from allowed application:
   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug",
     "appUrl": "https://allowed-app.example.com"
   }
   ```

**Expected Result**: Connection request succeeds

4. Make connection request from disallowed application:
   ```json
   {
     "email": "test@example.com",
     "scope": "your-scope-slug",
     "appUrl": "https://disallowed-app.example.com"
   }
   ```

**Expected Result**:

- Request fails with 400 or 403
- Error message indicates application not allowed

### Test Case 3: Remove Restrictions

**Steps**:

1. Update scope to allow all:

   ```bash
   PATCH /api/scopes/{slug}
   {
     "allowedApplications": null
   }
   ```

2. Verify all applications can connect again

**Expected Result**: Connection requests from any application succeed

### Test Case 4: Invalid Application Identifier

**Steps**:

1. Try to update scope with invalid identifier:
   ```bash
   PATCH /api/scopes/{slug}
   {
     "allowedApplications": ["invalid-format"]
   }
   ```

**Expected Result**:

- Request fails with 400
- Error message indicates invalid format

## Manual Testing Checklist

### Application Information Display

- [ ] Email shows application name when available
- [ ] Email shows application icon when available
- [ ] Email shows application description when available
- [ ] Email still sends when NIP-05 resolution fails
- [ ] Email still sends when kind: 0 fetch fails
- [ ] Fallback information displays correctly
- [ ] Email formatting is correct with application info

### Scope Restrictions

- [ ] Default scope allows all applications
- [ ] Scope restriction configuration saves correctly
- [ ] Allowed applications can connect
- [ ] Disallowed applications are rejected
- [ ] Removing restrictions allows all again
- [ ] Invalid identifiers are rejected
- [ ] Scope owner can update restrictions
- [ ] Non-owners cannot update restrictions

### Error Handling

- [ ] NIP-05 timeout handled gracefully
- [ ] Kind: 0 fetch timeout handled gracefully
- [ ] Invalid NIP-05 format handled gracefully
- [ ] Network errors don't block email sending
- [ ] Error messages are user-friendly

### Performance

- [ ] NIP-05 resolution completes within 3 seconds
- [ ] Kind: 0 fetch completes within 5 seconds
- [ ] Email sending not delayed by profile fetching
- [ ] Caching reduces redundant queries

## Integration Test Scripts

### Test NIP-05 Resolution

```typescript
import { resolveNip05 } from '@/utils/nip05Utils';

// Test valid resolution
const pubkey = await resolveNip05('app@example.com');
console.assert(pubkey !== null, 'Should resolve valid NIP-05');

// Test invalid resolution
const invalid = await resolveNip05('invalid@does-not-exist.com');
console.assert(invalid === null, 'Should return null for invalid');
```

### Test Kind: 0 Fetching

```typescript
import { fetchAppProfile } from '@/lib/nostr/appProfile';

// Test valid profile fetch
const profile = await fetchAppProfile('pubkey-hex-here');
console.assert(profile?.name !== undefined, 'Should fetch profile');

// Test invalid pubkey
const invalid = await fetchAppProfile('invalid-pubkey');
console.assert(invalid === null, 'Should return null for invalid');
```

### Test Scope Restriction Validation

```typescript
import { validateAppAllowed } from '@/lib/scopes/restrictions';

// Test allowed application
const allowed = await validateAppAllowed('scope-slug', 'npub1abc...');
console.assert(allowed === true, 'Should allow listed app');

// Test disallowed application
const disallowed = await validateAppAllowed('scope-slug', 'npub1xyz...');
console.assert(disallowed === false, 'Should reject unlisted app');
```

## Troubleshooting

### Email Not Showing Application Info

- Check NIP-05 resolution logs
- Verify kind: 0 event exists on relays
- Check email template rendering
- Verify appUrl parameter is passed

### Scope Restrictions Not Working

- Verify allowedApplications field in database
- Check application identifier format (hex vs npub)
- Verify scope slug matches
- Check authentication/authorization

### Performance Issues

- Check cache hit rates
- Verify timeout values
- Monitor relay response times
- Check for memory leaks in cache

## Next Steps

After successful testing:

1. Document any issues found
2. Update implementation based on test results
3. Proceed to task breakdown (`/speckit.tasks`)

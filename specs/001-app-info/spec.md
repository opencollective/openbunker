# Feature Specification: Application Information Handling

**Feature Branch**: `001-app-info`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "Handling app information in Openbunker

Phase 1:

Upon sending connection requests via the API, with email verification, we should show application information in the email.

This means that the API request will send the required information about the app, which will be in the form of an application canonical URL (this will map to an application pub key thanks to NIP-05)

OpenBunker will then get the application information when a connection request is made, and will send the email using the kind: 0 of the application to format the email.

Phase 2:

When configuring a scope, there is a possibility to restrict the applications that are allowed in the scope"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Display Application Information in Email Verification (Priority: P1)

When a client application requests a connection token via the unauthenticated API endpoint with email verification, users receive an email that displays the application's name, icon, and other profile information. This helps users identify which application is requesting access to their OpenBunker identity.

**Why this priority**: This is the foundation for user awareness and trust. Users need to know which application is requesting access before they approve the connection. This is essential for security and user experience.

**Independent Test**: Can be fully tested by making a connection request with an application URL, verifying that the email contains the application's name and icon from its Nostr profile (kind: 0 event), and confirming the email is properly formatted.

**Acceptance Scenarios**:

1. **Given** a client application with a canonical URL that resolves to a Nostr pubkey via NIP-05, **When** the application makes a connection request via the unauthenticated API endpoint with email verification, **Then** the verification email MUST display the application's name from its kind: 0 event
2. **Given** an application with a kind: 0 event containing an icon/avatar, **When** a connection request is made, **Then** the verification email MUST display the application's icon
3. **Given** an application with a kind: 0 event containing a description or about field, **When** a connection request is made, **Then** the verification email SHOULD display the application's description or about information
4. **Given** an application URL that cannot be resolved via NIP-05 or a kind: 0 event that cannot be fetched, **When** a connection request is made, **Then** the system MUST still send the verification email with fallback information (e.g., the provided URL or a generic "Unknown Application" message)

---

### User Story 2 - Restrict Applications in Scope Configuration (Priority: P2)

Scope administrators can configure which applications are allowed to request connections within their scope. This allows communities to control which applications can access identities within their scope, providing an additional layer of security and control.

**Why this priority**: This enables scope owners to maintain control over their community's security by restricting access to trusted applications only. This is important for community governance and security.

**Independent Test**: Can be fully tested by configuring a scope with allowed applications, attempting a connection request from both allowed and disallowed applications, and verifying that only allowed applications can successfully create connections.

**Acceptance Scenarios**:

1. **Given** a scope exists with an owner, **When** the owner configures allowed applications for the scope, **Then** the system MUST store the list of allowed application pubkeys or URLs
2. **Given** a scope has a configured list of allowed applications, **When** an application that is not in the allowed list attempts to request a connection, **Then** the system MUST reject the connection request with an appropriate error message
3. **Given** a scope has a configured list of allowed applications, **When** an application that is in the allowed list requests a connection, **Then** the system MUST process the connection request normally
4. **Given** a scope has no allowed applications configured (empty list or null), **When** any application requests a connection, **Then** the system MUST allow the connection (default behavior: all applications allowed)
5. **Given** a scope owner updates the allowed applications list, **When** the update is saved, **Then** the system MUST immediately apply the new restrictions to future connection requests

### Edge Cases

- What happens when an application's NIP-05 resolution fails or times out?
- How does the system handle applications that change their kind: 0 profile after initial connection?
- What happens when a scope's allowed applications list includes invalid or non-existent application pubkeys?
- How does the system handle concurrent connection requests from the same application?
- What happens when a scope owner removes an application from the allowed list while users have active connections?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST accept an application canonical URL in connection requests via the unauthenticated API endpoint
- **FR-002**: System MUST resolve application canonical URLs to Nostr pubkeys using NIP-05 protocol
- **FR-003**: System MUST fetch application profile information (kind: 0 event) from Nostr relays when processing connection requests
- **FR-004**: System MUST include application name, icon, and description in verification emails sent to users
- **FR-005**: System MUST handle cases where NIP-05 resolution fails or kind: 0 event cannot be fetched gracefully with fallback information
- **FR-006**: System MUST allow scope owners to configure a list of allowed applications for their scope
- **FR-007**: System MUST validate that requesting applications are in the scope's allowed list before processing connection requests
- **FR-008**: System MUST allow scope owners to add or remove applications from the allowed list
- **FR-009**: System MUST apply scope-level application restrictions immediately upon configuration changes
- **FR-010**: System MUST document all Nostr protocol additions and NIP implementations in `docs/NIP.md` per constitution requirements

### Key Entities _(include if feature involves data)_

- **Application Profile**: Represents a client application's Nostr profile information, including pubkey (derived from canonical URL via NIP-05), name, icon/avatar, description/about, and other metadata from kind: 0 event
- **Scope Application Restrictions**: Represents scope-level configuration that restricts which applications can request connections, including scope identifier, list of allowed application pubkeys or URLs, and configuration metadata

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can identify the requesting application from the verification email in 100% of cases where application information is successfully fetched
- **SC-002**: Application profile information is successfully fetched and displayed in verification emails for 95% of valid application URLs
- **SC-003**: Scope-level application restrictions are enforced correctly, blocking 100% of disallowed applications and allowing 100% of allowed applications
- **SC-004**: Scope owners can configure application restrictions and see changes take effect within 5 seconds of saving the configuration
- **SC-005**: All Nostr protocol additions are documented in `docs/NIP.md` before feature completion

## Assumptions

- Application canonical URLs follow standard NIP-05 format and can be resolved to Nostr pubkeys
- Application kind: 0 events are available on standard Nostr relays
- Scope owners have appropriate permissions to configure application restrictions
- The system has access to Nostr relays for fetching kind: 0 events
- Application profile information (kind: 0) may change over time, and the system should handle this gracefully

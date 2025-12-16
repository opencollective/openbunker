# Tasks: Application Information Handling

**Input**: Design documents from `/specs/001-app-info/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include integration tests for critical paths as specified in research.md (NIP-05 resolution, kind: 0 fetching, scope restrictions).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `src/app/`, `src/lib/`, `src/utils/`, `src/components/` at repository root
- Paths follow Next.js App Router conventions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

**Note**: Project already exists, minimal setup needed

- [x] T001 [P] Verify project dependencies are installed (nostr-tools, @nostr-dev-kit/ndk, prisma, resend)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create database migration to add `allowedApplications` field to Scopes table in `prisma/migrations/YYYYMMDDHHMMSS_add_allowed_apps_to_scopes/migration.sql`
- [x] T003 Update Prisma schema to add `allowedApplications Json?` field to Scopes model in `prisma/schema.prisma`
- [x] T004 Run `npx prisma generate` to regenerate Prisma client with new schema
- [x] T005 [P] Create NIP-05 resolution utility module in `src/utils/nip05Utils.ts` with `resolveNip05()` function
- [x] T006 [P] Create application profile fetching module in `src/lib/nostr/appProfile.ts` with `fetchAppProfile()` function and caching logic
- [x] T007 Create application identifier validation utility in `src/utils/appIdentifier.ts` with functions to validate and normalize pubkeys/URLs

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Display Application Information in Email Verification (Priority: P1) 🎯 MVP

**Goal**: Users receive verification emails that display the requesting application's name, icon, and profile information fetched from Nostr kind: 0 events.

**Independent Test**: Make a connection request with an application URL, verify that the email contains the application's name and icon from its Nostr profile (kind: 0 event), and confirm the email is properly formatted.

### Integration Tests for User Story 1 (OPTIONAL - critical paths only) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Integration test for NIP-05 resolution in `src/utils/__tests__/nip05Utils.test.ts`
- [x] T009 [P] [US1] Integration test for kind: 0 event fetching in `src/lib/nostr/__tests__/appProfile.test.ts`

### Implementation for User Story 1

- [x] T010 [US1] Implement `resolveNip05()` function in `src/utils/nip05Utils.ts` with HTTP GET to `.well-known/nostr.json`, timeout handling (3s), and error handling
- [x] T011 [US1] Implement NIP-05 resolution cache with Map-based in-memory storage and 1-hour TTL in `src/utils/nip05Utils.ts`
- [x] T012 [US1] Implement `fetchAppProfile()` function in `src/lib/nostr/appProfile.ts` using nostr-tools SimplePool to query relays for kind: 0 events
- [x] T013 [US1] Implement application profile cache with Map-based in-memory storage and 30-minute TTL in `src/lib/nostr/appProfile.ts`
- [x] T014 [US1] Implement `getApplicationProfile()` helper function in `src/lib/nostr/appProfile.ts` that combines NIP-05 resolution and kind: 0 fetching with fallback handling
- [x] T015 [US1] Modify POST handler in `src/app/(openbunker)/api/openbunker-unauthenticated-token/route.ts` to accept optional `appUrl` parameter in request body
- [x] T016 [US1] Add application profile fetching logic to POST handler in `src/app/(openbunker)/api/openbunker-unauthenticated-token/route.ts` (call `getApplicationProfile()` if appUrl provided)
- [x] T017 [US1] Update `sendVerificationEmail()` function in `src/app/(openbunker)/api/openbunker-unauthenticated-token/route.ts` to accept application profile data and include name, icon, and description in email HTML template
- [x] T018 [US1] Add error handling in POST handler to ensure email sending continues even if application profile fetch fails (use fallback values)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Restrict Applications in Scope Configuration (Priority: P2)

**Goal**: Scope owners can configure which applications are allowed to request connections within their scope, providing enhanced security and control.

**Independent Test**: Configure a scope with allowed applications, attempt connection requests from both allowed and disallowed applications, and verify that only allowed applications can successfully create connections.

### Integration Tests for User Story 2 (OPTIONAL - critical paths only) ⚠️

- [ ] T019 [P] [US2] Integration test for scope restriction validation in `src/lib/scopes/__tests__/restrictions.test.ts`

### Implementation for User Story 2

- [x] T020 [US2] Create scope restriction validation utility in `src/lib/scopes/restrictions.ts` with `validateAppAllowed()` function that checks if application identifier is in scope's allowedApplications list
- [x] T021 [US2] Implement application identifier normalization in `src/lib/scopes/restrictions.ts` to convert npub to hex format and handle URL comparison
- [x] T022 [US2] Modify POST handler in `src/app/(openbunker)/api/openbunker-unauthenticated-token/route.ts` to validate application against scope restrictions before processing connection request (call `validateAppAllowed()`)
- [x] T023 [US2] Add error response (400/403) in POST handler when application is not allowed in scope
- [x] T024 [US2] Modify GET handler in `src/app/(openbunker)/api/scopes/[slug]/route.ts` to include `allowedApplications` field in response
- [x] T025 [US2] Modify PATCH handler in `src/app/(openbunker)/api/scopes/[slug]/route.ts` to accept `allowedApplications` field in request body
- [x] T026 [US2] Add validation logic in PATCH handler to validate application identifier formats (pubkeys and URLs) before saving
- [x] T027 [US2] Implement normalization of application identifiers in PATCH handler (convert npub to hex, remove duplicates, store in consistent format)
- [x] T028 [US2] Update scope settings UI component in `src/app/(openbunker)/scopes/page.tsx` to display and allow editing of `allowedApplications` field
- [x] T029 [US2] Add UI controls in `src/app/(openbunker)/scopes/page.tsx` for adding/removing applications from allowed list
- [x] T030 [US2] Add validation feedback in UI component for invalid application identifier formats

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T031 [P] Document NIP-05 resolution implementation in `docs/NIP.md`
- [x] T032 [P] Document kind: 0 event fetching implementation in `docs/NIP.md`
- [x] T033 [P] Document application profile caching strategy in `docs/NIP.md`
- [x] T034 [P] Document scope-level application restrictions in `docs/NIP.md`
- [x] T035 Code cleanup and refactoring (review error handling, logging, code organization)
- [x] T036 Add logging for application profile fetching operations (success/failure, cache hits/misses)
- [x] T037 Add logging for scope restriction validation operations
- [x] T038 Run quickstart.md validation tests to ensure all acceptance scenarios pass
- [ ] T039 Performance testing: Verify NIP-05 resolution completes within 3 seconds, kind: 0 fetch within 5 seconds
- [ ] T040 Security review: Verify application identifier validation prevents injection attacks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on US1, independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Utilities/modules before API routes
- API routes before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (T005, T006, T007)
- All tests for a user story marked [P] can run in parallel
- User Story 1 and User Story 2 can be worked on in parallel after Foundational phase
- Documentation tasks in Polish phase can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: T008 [P] [US1] Integration test for NIP-05 resolution
Task: T009 [P] [US1] Integration test for kind: 0 event fetching

# Launch foundational utilities together:
Task: T005 [P] Create NIP-05 resolution utility module
Task: T006 [P] Create application profile fetching module
Task: T007 [P] Create application identifier validation utility
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (application info in emails)
   - Developer B: User Story 2 (scope restrictions)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Application profile caching is in-memory only (consider Redis for production scale)
- Error handling must not block email sending - always use fallbacks
- Scope restrictions default to allowing all applications (null or empty array)

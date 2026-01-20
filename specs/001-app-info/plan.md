# Implementation Plan: Application Information Handling

**Branch**: `001-app-info` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-app-info/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature adds application information display in email verification and scope-level application restrictions. When client applications request connection tokens via the unauthenticated API, users will receive emails showing the application's name, icon, and profile information fetched from Nostr kind: 0 events. Additionally, scope owners can configure which applications are allowed to request connections within their scope, providing enhanced security and control.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**:

- Next.js 15.5.7 (App Router)
- nostr-tools ^2.16.2 (Nostr protocol operations)
- @nostr-dev-kit/ndk ^2.14.35 (NDK for relay operations)
- Prisma ^6.10.1 (ORM)
- Resend ^3.2.0 (Email sending)
- PostgreSQL via Supabase (Database)

**Storage**: PostgreSQL (Supabase) - Prisma ORM for data access  
**Testing**: Manual testing for MVP + integration tests for critical paths (NIP-05 resolution, kind: 0 fetching, scope restrictions)  
**Target Platform**: Node.js server (Next.js API routes) + Web frontend  
**Project Type**: Web application (Next.js frontend + API routes)  
**Performance Goals**:

- Email sending: < 2 seconds for verification email delivery
- NIP-05 resolution: < 3 seconds timeout
- Kind: 0 event fetching: < 5 seconds timeout
- Scope restriction validation: < 100ms

**Constraints**:

- Must handle NIP-05 resolution failures gracefully
- Must handle kind: 0 event fetch failures gracefully
- Must not block email sending if application info fetch fails
- Must support concurrent connection requests

**Scale/Scope**:

- Multiple scopes with different application restrictions
- Multiple concurrent connection requests
- Application profile caching to reduce relay queries

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**I. Code Modularity**: ✅ PASS

- Application profile fetching logic will be extracted into a reusable module (`src/utils/nip05Utils.ts` or `src/lib/nostr/appProfile.ts`)
- NIP-05 resolution will be a standalone utility function
- Kind: 0 event fetching will be modular and reusable
- Email template formatting will remain in the API route but use the fetched profile data
- Scope restriction validation will be extracted into a service module
- All modules maintain clear boundaries and minimal coupling

**II. Nostr Documentation**: ✅ PASS

- This feature adds NIP-05 resolution and kind: 0 event fetching
- Documentation will be added to `docs/NIP.md` covering:
  - NIP-05 resolution for application canonical URLs
  - Kind: 0 event fetching for application profiles
  - Integration with email verification flow
  - Scope-level application restrictions (if using Nostr-based identifiers)

### Post-Phase 1 Design Review

**I. Code Modularity**: ✅ PASS (Confirmed)

- Research phase confirmed modular approach:
  - `src/utils/nip05Utils.ts` for NIP-05 resolution
  - `src/lib/nostr/appProfile.ts` for kind: 0 fetching and profile management
  - Scope restriction validation extracted to service module
- All modules have clear single responsibilities
- Minimal coupling between modules
- Reusable across Next.js app and potential future daemon usage

**II. Nostr Documentation**: ✅ PASS (Confirmed)

- Research phase identified all Nostr protocol additions:
  - NIP-05 resolution implementation
  - Kind: 0 event fetching patterns
- Documentation plan created for `docs/NIP.md`
- All Nostr-related code will be documented before implementation

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── (openbunker)/
│       └── api/
│           ├── openbunker-unauthenticated-token/
│           │   └── route.ts                    # Modified: Add app URL param, fetch profile, update email
│           └── scopes/
│               └── [slug]/
│                   └── route.ts                # Modified: Add allowedApplications field
├── lib/
│   └── nostr/
│       └── appProfile.ts                       # New: NIP-05 resolution and kind: 0 fetching
├── utils/
│   └── nip05Utils.ts                           # New: NIP-05 resolution utilities
└── components/
    └── scopes/
        └── ScopeSettings.tsx                    # Modified: Add application restrictions UI

prisma/
└── migrations/
    └── YYYYMMDDHHMMSS_add_allowed_apps_to_scopes/
        └── migration.sql                        # New: Add allowedApplications field to Scopes

server/
└── (no changes - daemon server not affected)

docs/
└── NIP.md                                       # Modified: Document NIP-05 and kind: 0 usage
```

**Structure Decision**: Web application structure (Next.js App Router). The feature primarily affects:

- API routes in `src/app/(openbunker)/api/`
- New utility modules in `src/lib/nostr/` and `src/utils/`
- Database schema changes via Prisma migrations
- Documentation updates in `docs/NIP.md`

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all requirements comply with constitution principles.

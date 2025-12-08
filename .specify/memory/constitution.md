<!--
Sync Impact Report:
Version change: N/A → 1.0.0 (initial version)
Modified principles: N/A (new constitution)
Added sections:
  - Core Principles (Code Modularity, Nostr Documentation)
  - Development Standards
  - Governance
Templates requiring updates:
  ✅ plan-template.md (Constitution Check section aligns with principles)
  ✅ spec-template.md (no changes needed - template is generic)
  ✅ tasks-template.md (no changes needed - template is generic)
Follow-up TODOs: None
-->

# OpenBunker Constitution

## Core Principles

### I. Code Modularity (NON-NEGOTIABLE)

Code modularity is tantamount. All code MUST be organized into discrete, reusable modules with clear boundaries and responsibilities. Modules MUST be self-contained with minimal coupling and explicit dependencies. Shared functionality MUST be extracted into common modules rather than duplicated. The architecture MUST support independent development and testing of components.

**Rationale**: Modular code enables maintainability, testability, and scalability. It allows the Next.js application and daemon server to evolve independently while sharing common utilities and types.

### II. Nostr Documentation

Any addition to the use of Nostr protocols, NIPs (Nostr Implementation Possibilities), or Nostr-related functionality MUST be documented in `docs/NIP.md`. This includes new NIP implementations, protocol extensions, Nostr event handling patterns, and integration points with Nostr relays or clients.

**Rationale**: Nostr protocol usage requires clear documentation for maintainability and to ensure compliance with NIP specifications. Centralized documentation in `docs/NIP.md` provides a single source of truth for Nostr-related implementation decisions.

## Development Standards

### Architecture

- **Next.js Application**: Web interface and API routes following Next.js conventions
- **Daemon Server**: Independent server processes (bunker server, email notification server) that run separately from the Next.js application
- **Shared Code**: Common utilities, types, and Nostr-related code MUST be modular and reusable across both application and server components

### Code Organization

- Modules MUST have single, well-defined responsibilities
- Dependencies between modules MUST be explicit and minimal
- Shared code MUST be placed in appropriate common directories (e.g., `src/lib/`, `src/utils/`)
- Server-specific code MUST be isolated in the `server/` directory
- Application-specific code MUST be organized within `src/app/` following Next.js conventions

## Governance

This constitution supersedes all other development practices. All code contributions MUST comply with these principles.

**Amendment Procedure**: Changes to this constitution require:

1. Documentation of the rationale for the change
2. Update to the version number following semantic versioning (MAJOR.MINOR.PATCH)
3. Update to the Last Amended date
4. Review of dependent templates and documentation for consistency

**Compliance**: All pull requests and code reviews MUST verify compliance with these principles. Violations MUST be addressed before merge.

**Version**: 1.0.0 | **Ratified**: 2025-01-27 | **Last Amended**: 2025-01-27

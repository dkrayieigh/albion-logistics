# Documentation Guide

Use this guide to decide which document is authoritative for the current Albion Logistics ERP implementation.

## Current / Release Checkpoint

- [Current Status](./CURRENT_STATUS.md)
- [Current Limitations](./CURRENT_LIMITATIONS.md)
- [0.4.4 Release Notes](./RELEASE_NOTES_0.4.4.md)
- [Test Cases](./TEST_CASES.md)

The release notes are the current checkpoint for the published 0.4.4 release. They do not replace `CURRENT_STATUS.md` and do not imply that future migration targets are current production behavior.

## Core Specifications

- [Architecture](./ARCHITECTURE.md)
- [Business Rules](./BUSINESS_RULES.md)
- [Data Model](./DATA_MODEL.md)
- [Location Model](./LOCATION_MODEL.md)
- [Item ID Model](./ITEM_ID_MODEL.md)
- [Transaction Event Model](./TRANSACTION_EVENT_MODEL.md)
- [Event Catalog](./EVENT_CATALOG.md)

Core specifications describe approved rules and target boundaries. When they conflict with current source or current regression tests, treat the conflict as an implementation gap unless a newer user-confirmed requirement says otherwise.

## Focused Workflow Docs

- [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md)
- [Special Material Inventory](./SPECIAL_MATERIAL_INVENTORY.md)
- [Sale Valuation Workflow](./SALE_VALUATION_WORKFLOW.md)
- [Crafting Hotfix Smoke Checklist](./CRAFTING_HOTFIX_SMOKE_CHECKLIST.md)
- [AI Guide](./AI_GUIDE.md)

## Historical / Archived Docs

- [Crafting Incident Recovery Plan](../archive/CRAFTING_INCIDENT_RECOVERY.md) — archived v0.4.3 incident-response and release-recovery record; not current project status.

## Planning / Migration / Handoff

- [Roadmap](./ROADMAP.md)
- [Migration Plan](./MIGRATION_PLAN.md)
- [Implementation Gap](./IMPLEMENTATION_GAP.md)
- [Project Handoff](./PROJECT_HANDOFF.md)
- [Adapter API](./ADAPTER_API.md)
- [Adapter Test Plan](./ADAPTER_TEST_PLAN.md)

Planning and migration documents are useful for future work. They should not be read as current production truth unless they are explicitly labeled current and match the latest source, regression tests, confirmed bug reports, and user-confirmed release facts.

Current planning entry:

- [Roadmap](./ROADMAP.md) is the active sequence authority.
- Completed checkpoint: Phase-1 refactor planning and inventory.
- Completed checkpoint: Inventory Transfer bounded service extraction.
- Completed checkpoint: Incremental quality tooling planning and boundary.
- Completed checkpoint: Inventory Transfer exact-file ESLint coverage.
- Completed checkpoint: Custom warehouse boundary specification and inventory.
- Completed checkpoint: Custom warehouse deletion UX contract regression and fix.
- Completed checkpoint: Special material inventory contract reconciliation.
- Completed checkpoint: Tests-first special-material pure contract.
- Completed checkpoint: Special Material exact-file ESLint coverage.
- Current active checkpoint: Special material identity catalog review.
- [Implementation Gap](./IMPLEMENTATION_GAP.md) remains the current coupling / gap inventory source.
- [Architecture](./ARCHITECTURE.md) records target boundaries and current-master service boundaries where explicitly labeled.
- Inventory Transfer bounded service extraction is current master post-release behavior, distinct from the published v0.4.4 artifact.
- Inventory Transfer exact-file ESLint coverage is current master post-release tooling behavior, distinct from the published v0.4.4 artifact.
- Exact-file ESLint coverage does not mean repo-wide lint or `checkJs` is complete.
- Custom warehouse deletion UX contract work is completed current-master behavior; it does not mean Location migration, inactive-location UI, custom crafting profile, schema migration, version metadata, or release artifacts have changed.
- Special Material pure helper work is completed as current-master pure service/test coverage, but it is not formal inventory production integration.
- Special Material active work is identity catalog review. It does not mean production catalog, resolver, schema/storage work, writer/backup/UI integration, Crafting integration, Stable Item ID migration, or release work has started.

## Reading Order For Production Work

1. Current Status.
2. Current Limitations.
3. 0.4.4 Release Notes when reviewing released 0.4.4 behavior.
4. Test Cases and active regression tests.
5. Core specifications.
6. Focused workflow docs.
7. Planning / migration / handoff docs.

## Documentation Rules

- Do not describe future migration targets as current production behavior.
- Do not keep stale current-behavior claims after production integration has landed.
- Keep legacy-compatible behavior, presentation-only mapping, migration boundaries, and future targets separate.
- A docs-only release checkpoint must not imply source, tests, package metadata, Tauri config, tags, or artifacts changed.
- Docs consolidation closeout is complete.
- Phase-1 refactor planning, Inventory Transfer bounded service extraction, Incremental quality tooling planning, Inventory Transfer exact-file ESLint coverage, Custom warehouse boundary specification and inventory, Custom warehouse deletion UX contract regression and fix, Special material inventory contract reconciliation, Tests-first special-material pure contract, and Special Material exact-file ESLint coverage are completed checkpoints.
- Special material identity catalog review is the current active checkpoint; it does not start production catalog, resolver, schema/storage changes, migration, backup/UI integration, Crafting integration, Stable Item ID migration, 0.4.5 implementation, or release work.

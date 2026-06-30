# Documentation Guide

Use this guide to decide which document is authoritative for the current Albion Logistics ERP implementation.

## Current / Release Checkpoint

- [Current Status](./CURRENT_STATUS.md)
- [Current Limitations](./CURRENT_LIMITATIONS.md)
- [0.4.4 Release Notes](./RELEASE_NOTES_0.4.4.md)
- [Test Cases](./TEST_CASES.md)

The release notes are a current checkpoint for the 0.4.4 release-candidate state. They do not replace `CURRENT_STATUS.md`, do not create a tag, and do not claim that build artifacts or GitHub Release publication are complete.

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
- [Crafting Incident Recovery](./CRAFTING_INCIDENT_RECOVERY.md)
- [Crafting Hotfix Smoke Checklist](./CRAFTING_HOTFIX_SMOKE_CHECKLIST.md)
- [AI Guide](./AI_GUIDE.md)

## Planning / Migration / Handoff

- [Roadmap](./ROADMAP.md)
- [Migration Plan](./MIGRATION_PLAN.md)
- [Implementation Gap](./IMPLEMENTATION_GAP.md)
- [Project Handoff](./PROJECT_HANDOFF.md)
- [Adapter API](./ADAPTER_API.md)
- [Adapter Test Plan](./ADAPTER_TEST_PLAN.md)

Planning and migration documents are useful for future work. They should not be read as current production truth unless they are explicitly labeled current and match the latest source, regression tests, confirmed bug reports, and user-confirmed release facts.

## Reading Order For Production Work

1. Current Status.
2. Current Limitations.
3. 0.4.4 Release Notes when reviewing release-candidate state.
4. Test Cases and active regression tests.
5. Core specifications.
6. Focused workflow docs.
7. Planning / migration / handoff docs.

## Documentation Rules

- Do not describe future migration targets as current production behavior.
- Do not keep stale current-behavior claims after production integration has landed.
- Keep legacy-compatible behavior, presentation-only mapping, migration boundaries, and future targets separate.
- A docs-only release checkpoint must not imply source, tests, package metadata, Tauri config, tags, or artifacts changed.

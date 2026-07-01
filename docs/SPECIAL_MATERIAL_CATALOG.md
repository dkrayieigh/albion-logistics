# Special Material Identity Catalog Candidate

Status: Candidate
Authority: Review input only
Current implementation: No production catalog
Active checkpoint: Special material identity catalog review
Last reviewed: 2026-07-01

本文件只盤點 current `src/data/albion_db.js` recipe metadata 中可見的 Artifact / Alchemy 名稱，作為 Spec Lead review input。

本文件不代表 production source catalog 已建立，不代表 runtime resolver 已建立，不修改 recipe metadata，也不得作為 storage、writer、Crafting、backup 或 UI 的實作依據。

## Catalog Evidence Source

Candidate source fields:

- `artifactName`
- `alchemyName`
- `recipe.id`
- `recipe.name`
- `recipe.enName`
- `artifactQty`

Alchemy Tier requirement currently comes from `getAlchemyRequirement()` in `src/components/crafting.js` and is not encoded as a catalog row.

## Extraction Boundary

Read-only candidate extraction may inspect `ALBION_DB`; it must not modify `src/data/albion_db.js`.

Example inspection command:

```bash
node --input-type=module -e "import('./src/data/albion_db.js').then(({ALBION_DB}) => { /* read-only extraction */ })"
```

Extraction should record:

- every unique `artifactName`
- every unique `alchemyName`
- source `recipe.id` references
- recipe Chinese / English names
- duplicate raw names
- bilingual raw strings
- one material referenced by multiple recipes
- conflicting or unclear source metadata

## Current Candidate Inventory Summary

Read-only extraction from current `ALBION_DB` found:

- Recipes inspected: 235
- Unique Special Material candidates: 153
- Artifact candidates: 146
- Alchemy candidates: 7

These numbers are review evidence only. They are not production catalog counts and should be regenerated if recipe metadata changes.

## Catalog Entry Candidate Shape

```js
{
  stableId: 'ARTIFACT_EXPLICIT_KEY',
  category: 'artifact',
  zhName: '...',
  enName: '...',
  sourceRecipeIds: ['...'],
  aliases: [],
  reviewStatus: 'candidate'
}
```

```js
{
  stableId: 'ALCHEMY_EXPLICIT_KEY',
  category: 'alchemy',
  zhName: '...',
  enName: '...',
  sourceRecipeIds: ['...'],
  aliases: [],
  reviewStatus: 'candidate'
}
```

Tier is not part of the catalog entry. Runtime identity remains:

```js
{
  stableId,
  category,
  tier
}
```

## Stable ID Candidate Rule

- Artifact prefix: `ARTIFACT_`
- Alchemy prefix: `ALCHEMY_`
- Use explicit reviewed ASCII snake case.
- Do not derive IDs from runtime slugify.
- Do not derive IDs from Tier.
- Do not derive IDs from category alone.
- Do not use recipe display name directly as identity.
- Do not claim these IDs are official Albion canonical IDs.
- If one material is referenced by multiple recipes, it should normally use one candidate stable ID.

## Candidate Stable ID Inventory

This table is an initial review sample plus all currently known Alchemy candidates. It is not a complete approved production catalog.

| Candidate Stable ID | Category | Chinese Name | English Name | Source Recipe IDs | Review Status | Notes |
| ------------------- | -------- | ------------ | ------------ | ----------------- | ------------- | ----- |
| `ALCHEMY_IMPS_HORN` | alchemy | 小惡魔角 | Imp's Horn | Hellspawn Staff | candidate | Current raw `alchemyName` from recipe metadata. |
| `ALCHEMY_WEREWOLF_FANGS` | alchemy | 狼人獠牙 | Werewolf Fangs | Bloodmoon Staff | candidate | Current raw `alchemyName` from recipe metadata. |
| `ALCHEMY_RUNESTONE_TOOTH` | alchemy | 符文牙齒 | Runestone Tooth | Earthrune Staff | candidate | Current raw `alchemyName` from recipe metadata. |
| `ALCHEMY_SHADOW_CLAWS` | alchemy | 暗影之爪 | Shadow Claws | Prowling Staff | candidate | Current raw `alchemyName` from recipe metadata. |
| `ALCHEMY_DAWNFEATHER` | alchemy | 黎明羽毛 | Dawnfeather | Lightcaller | candidate | Current raw `alchemyName` from recipe metadata. |
| `ALCHEMY_SYLVIAN_ROOT` | alchemy | 樹人之根 | Sylvian Root | Rootbound Staff | candidate | Current raw `alchemyName` from recipe metadata. |
| `ALCHEMY_SPIRIT_PAWS` | alchemy | 靈性之爪 | Spirit Paws | Primal Staff | candidate | Current raw `alchemyName` from recipe metadata. |
| `ARTIFACT_BLOODFORGED_BLADE` | artifact | 血鑄之刃 | Bloodforged Blade | Clarent Blade | candidate | Sample artifact candidate. |
| `ARTIFACT_DEMONIC_BLADE` | artifact | 惡魔之刃 | Demonic Blade | Carving Sword | candidate | Sample artifact candidate. |
| `ARTIFACT_CURSED_BLADES` | artifact | 詛咒碎刃 | Cursed Blades | Galatine Pair | candidate | Sample artifact candidate. |
| `ARTIFACT_REMNANTS_OF_THE_OLD_KING` | artifact | 先王遺物 | Remnants of the Old King | Kingmaker | candidate | Sample artifact candidate. |
| `ARTIFACT_INFINITE_CRYSTAL` | artifact | 無限水晶 | Infinite Crystal | Infinity Blade | candidate | Sample artifact candidate. |
| `ARTIFACT_DAWNBIRD_REMNANT` | artifact | 黎明之鷹遺骸 | Dawnbird Remnant | Lightcaller | candidate | Artifact appears alongside Alchemy on shapeshifter-related recipes. |
| `ARTIFACT_HELLFIRE_IMP_REMNANT` | artifact | 煉獄小惡魔遺骸 | Hellfire Imp Remnant | Hellspawn Staff | candidate | Artifact appears alongside Alchemy on shapeshifter-related recipes. |
| `ARTIFACT_RUNESTONE_GOLEM_REMNANT` | artifact | 符文石魔像遺骸 | Runestone Golem Remnant | Earthrune Staff | candidate | Artifact appears alongside Alchemy on shapeshifter-related recipes. |

## Unresolved

Do not silently resolve these during implementation:

- Bilingual raw-name parsing may be ambiguous.
- Chinese-only or English-only display strings may need manual review.
- Candidate key collisions must be checked before any production catalog.
- Recipe metadata may contain duplicate or conflicting material names.
- Alchemy material kind must be separate from Tier.
- Source of truth for the future catalog is undecided.

Review record template:

```text
Raw value:
Source recipe IDs:
Conflict:
Required Spec Lead decision:
```

## Review Questions

1. Are candidate stable IDs acceptable?
2. Which Chinese / English names are canonical display names?
3. Are any current raw recipe names wrong or duplicate?
4. Should Alchemy stable IDs identify material kind only, with Tier supplied by runtime identity?
5. Should the future catalog source live under `src/data` or a domain module?
6. What review process approves a candidate row as a production assignment?

No answer in this document authorizes catalog source, resolver tests, storage, writer, backup, UI, Crafting integration, or Stable Item ID migration.

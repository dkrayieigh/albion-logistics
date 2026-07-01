# 0.5.0 Crafting Domain Model

Status: Approved target specification
Authority: Spec Lead decision record
Current implementation: Pure foundations only; production integration not implemented
Target release: 0.5.0
Last reviewed: 2026-07-01

0.4.4 is primarily a crafting planning and manual-accounting release.

0.5.0 upgrades Albion Logistics into an ERP that can execute crafting: select a production location, calculate production bonuses, consume inventory, create location-based products, calculate cost, and record the operation.

This document is a target architecture and business-rule decision record. It does not implement calculators, writers, storage, backup, UI, transaction payload changes, version metadata, build identity, migration, or release artifacts.

## Approved Decisions

### Decision 0.5.0-001: Version Strategy

Decision:
0.4.5 will not be published as a formal release. The next planned public feature release is 0.5.0.

Reason:
The current work is foundational and does not yet provide a complete user-facing crafting execution workflow.

Rejected:
Publishing an incomplete Custom Warehouse or Special Material feature as 0.4.5.

Boundary:

- Current package/app version remains `0.4.4`.
- Do not create a `v0.4.5` tag, installer, or GitHub Release.
- Current master is not a released 0.4.5 build.
- Version metadata may change only in a future 0.5.0 release-preparation task.

### Decision 0.5.0-002: Location Registry And Production Profile Separation

Decision:
Location identity and production configuration are separate models.

Location Registry:

```js
{
  locationId,
  displayName,
  type,
  active
}
```

Production Profile:

```js
{
  locationId,
  facilityType,
  region,
  regionQuality
}
```

Allowed `facilityType` values:

```text
royal-city
hideout
```

Rules:

- Location Registry stores identity and display state.
- Production Profile stores crafting-region configuration.
- System cities may have profiles.
- Custom locations may have profiles.
- A custom location without a profile is a warehouse only.
- A custom location without a profile is not a valid craft location.
- Profile identity is keyed by `locationId`.
- Rename must not change profile identity.
- Do not derive `region` or `regionQuality` from display name.
- Do not store profile fields directly inside the Location Registry entry.

#### Production Profile Validation Matrix

`locationId` validation:

- Must be a non-empty trimmed string.
- Pure profile validation checks only shape and value rules.
- Pure profile validation does not check whether `locationId` exists in Location Registry.
- Pure profile validation does not check whether a custom location is active.
- Registry existence and active checks belong to a future integration adapter.

`facilityType` must be one of:

```text
royal-city
hideout
```

`region` must be an exact enum value:

```text
SWAMP
FOREST
MOUNTAIN
HIGHLAND
STEPPE
CENTER
MISTS
```

Lowercase region values are invalid.

| `facilityType` | `region`                   | `regionQuality`         |
| -------------- | -------------------------- | ----------------------- |
| `royal-city`   | Required exact region enum | Must be exactly `null`  |
| `hideout`      | Required exact region enum | Required integer `1..6` |

Rules:

- Royal city `regionQuality` omitted, `undefined`, or numeric values are invalid.
- Hideout `regionQuality` `null`, omitted, string, decimal, or out of range is invalid.
- Production Profile must not store LPB, RRR, Focus, Daily, or Power values.
- Whether `thetford` is always `SWAMP`, whether a `locationId` is system/custom, and whether registry entry is active are profile catalog / integration responsibilities.

### Decision 0.5.0-003: Event-only Crafting Parameters

Craft completion receives dynamic event-only parameters:

```js
{
  locationId,
  hideoutPowerLevel,
  focusEnabled,
  dailyBonusPercent
}
```

Rules:

- `hideoutPowerLevel` is an integer enum `1..9`.
- Do not pass raw bonus ratios such as `0.13` or `0.26` from UI/domain input.
- `focusEnabled` is boolean.
- `dailyBonusPercent` is normally `0`, `10`, or `20`.
- Royal city crafting ignores hideout power.
- Event parameters are recorded as craft event metadata.
- Event parameters do not mutate Location Registry.
- Event parameters do not mutate Production Profile.
- Do not store LPB or RRR inside Location Registry or Production Profile.

Legacy-compatible naming such as `hideoutPower` and `dailyBonus` remains current implementation context only. Future target naming is `hideoutPowerLevel` and `dailyBonusPercent`.

#### Crafting Event Validation Matrix

`locationId` validation:

- Must be a non-empty trimmed string.
- Must exactly match the selected Production Profile `locationId`.

`focusEnabled` validation:

- Must be boolean.

`dailyBonusPercent` validation:

- Must be exactly one of:
- Must be exactly `0`, `10`, or `20`.

```text
0
10
20
```

Do not describe this as "normally", "usually", or "for example" in executable contract text.

| `facilityType` | `hideoutPowerLevel`     |
| -------------- | ----------------------- |
| `royal-city`   | Must be exactly `null`  |
| `hideout`      | Required integer `1..9` |

Royal city rules:

- Omitted or `undefined` power is invalid.
- `0` is invalid.
- Any integer `1..9` is invalid.
- Calculator must not silently ignore power-like values.

Hideout rules:

- `null` is invalid.
- Omitted power is invalid.
- `0`, `10`, decimal, or string values are invalid.
- Only integer `1..9` is valid.

### Decision 0.5.0-004: Product Inventory Remains Location-Based

Decision:
Product Inventory remains location-based.

Reason:
Crafted products physically exist at the selected production location and must be movable through logistics.

Rejected:
Account-total Product Inventory.

Rules:

- Crafting output writes product quantity to the selected production location.
- Sale consumes product quantity from a selected location.
- Product inventory remains eligible for logistics transfer.
- Dashboard valuation must account for product location quantities.
- Ledger / craft record stores the production location.
- There is no account-total product inventory target for 0.5.0.
- Do not create an `AccountTotal` fake location.

Any older Account-total Product Inventory proposal is superseded and must be labeled rejected / historical context.

### Decision 0.5.0-005: Special Material Inventory

Special Material inventory uses:

```text
account-total totalQty
account-wide globalAvgCost
no location bucket
no transfer
no RRR
fixed crafting deduction
```

Rules:

- Artifact requirement comes from recipe metadata.
- Alchemy requirement comes from Tier requirement logic.
- Special Material is not affected by LPB, Focus, Daily Bonus, Hideout Power, or RRR.
- Special Material does not use manual consumption override.
- Special Material purchase updates its own `globalAvgCost`.
- Quantity and cost basis updates are explicit operations.

Current master includes pure catalog/resolver and pure inventory service foundations, but production integration remains incomplete.

### Decision 0.5.0-006: Development Build Identification

Package and Tauri release version remain:

```text
0.4.4
```

Future development-master build display should identify itself as unreleased:

```text
0.4.4-dev+<short-sha>
Development master
Not a released build
```

Rules:

- Display short commit SHA when available.
- Display development/unreleased state clearly.
- Do not confuse development master with a release build.
- Development identifier is not a storage schema version.
- Development identifier must not change backup compatibility semantics.
- If SHA is unavailable, display `Development master - commit unavailable`.
- This is a future low/medium risk build/source task.
- Do not create a 0.4.5 identifier.

## LPB And RRR Contract

Domain API inputs use LPB percent points:

```js
18 // means +18% LPB
33 // means +33% LPB
59 // focus adds +59 LPB
```

Do not use decimal bonus ratios as domain input:

```js
0.18
0.33
0.59
```

RRR is a decimal ratio:

```js
0.152542...
```

UI may display it as:

```text
15.3%
```

RRR formula:

```js
rrr = 1 - 1 / (1 + totalLpbPercent / 100)
```

Rules:

- Domain layer must not round RRR.
- UI may round display only.
- Material consumption must use the unrounded RRR.
- `totalLpbPercent` must be finite and non-negative.

### Royal City LPB

Non-specialized recipe:

```text
locationBaseLpb = 18
specializationLpb = 0
```

Matching specialized recipe:

```text
locationBaseLpb = 18
specializationLpb = 15
```

Focus:

```text
focusEnabled === true  -> focusLpb = 59
focusEnabled === false -> focusLpb = 0
```

Daily activity:

```text
dailyBonusPercent = 0  -> dailyLpb = 0
dailyBonusPercent = 10 -> dailyLpb = 10
dailyBonusPercent = 20 -> dailyLpb = 20
```

### Hideout General LPB

Use this table for non-specialized recipes:

| Power Level | General LPB |
| ----------: | ----------: |
|           1 |           0 |
|           2 |           6 |
|           3 |          11 |
|           4 |          15 |
|           5 |          18 |
|           6 |          20 |
|           7 |          22 |
|           8 |          24 |
|           9 |          26 |

### Hideout Specialized LPB Matrix

When recipe category matches hideout region specialization, use matrix lookup before focus and daily additions:

| Region Quality \ Power |  1 |     2 |    3 |     4 |  5 |     6 |    7 |     8 |  9 |
| ---------------------: | -: | ----: | ---: | ----: | -: | ----: | ---: | ----: | -: |
|                      1 |  1 | 10.75 | 19.5 | 27.25 | 34 | 39.75 | 45.5 | 51.25 | 57 |
|                      2 |  6 | 15.75 | 24.5 | 32.25 | 39 | 44.75 | 50.5 | 56.25 | 62 |
|                      3 | 11 | 20.75 | 29.5 | 37.25 | 44 | 49.75 | 55.5 | 61.25 | 67 |
|                      4 | 16 | 25.75 | 34.5 | 42.25 | 49 | 54.75 | 60.5 | 66.25 | 72 |
|                      5 | 21 | 30.75 | 39.5 | 47.25 | 54 | 59.75 | 65.5 | 71.25 | 77 |
|                      6 | 26 | 35.75 | 44.5 | 52.25 | 59 | 64.75 | 70.5 | 76.25 | 82 |

Breakdown:

```js
locationBaseLpb = GENERAL_POWER_TABLE[powerLevel]
specializationProfileLpb =
  specialized
    ? SPECIALIZED_MATRIX[regionQuality][powerLevel] - locationBaseLpb
    : 0

focusLpb = focusEnabled ? 59 : 0
dailyLpb = dailyBonusPercent

totalLpb =
  locationBaseLpb +
  specializationProfileLpb +
  focusLpb +
  dailyLpb
```

Do not expose ambiguous fields such as `regionQualityBonus`, `regionSpecializationBonus`, or `hideoutPowerBonus` as primary domain output. Domain result should return lookup-derived breakdown fields.

## Region Specialization

The 0.5.0 target region categories are:

```text
SWAMP
FOREST
MOUNTAIN
HIGHLAND
STEPPE
CENTER
MISTS
```

Region category mapping is a 0.5.0 target. Current `BONUSES` / `constants.js` behavior is not sufficient as a final production profile model. Pure calculator tests must cover matching and non-matching region categories.

Canonical region specialization mapping:

| Region     | Exact recipe categories                                               |
| ---------- | --------------------------------------------------------------------- |
| `SWAMP`    | `MACE`, `NATURE_STAFF`, `FIRE_STAFF`, `LEATHER_ARMOR`, `CLOTH_HELMET` |
| `FOREST`   | `SWORD`, `BOW`, `ARCANE_STAFF`, `LEATHER_HELMET`, `LEATHER_SHOES`     |
| `MOUNTAIN` | `HAMMER`, `SPEAR`, `HOLY_STAFF`, `PLATE_HELMET`, `CLOTH_ARMOR`        |
| `HIGHLAND` | `AXE`, `QUARTERSTAFF`, `FROST_STAFF`, `PLATE_SHOES`, `OFF_HAND`       |
| `STEPPE`   | `CROSSBOW`, `DAGGER`, `CURSED_STAFF`, `PLATE_ARMOR`, `CLOTH_SHOES`    |
| `CENTER`   | `WAR_GLOVES`, `SHAPESHIFTER_STAFF`                                    |
| `MISTS`    | `CAPE`                                                                |

Rules:

- Category comparison is exact match.
- Do not use case folding.
- Do not use alias or fuzzy matching.
- Do not infer recipe category from UI display name.
- Do not rely on current `constants.js` as the canonical mapping.
- Missing region mapping or missing category is invalid input, not "non-specialized".
- Non-specialized means profile region exists and recipe category is valid, but the category is not listed for that region.

## Material Consumption And Manual Override

Regional material consumption is batch-level:

```js
grossQuantity = baseQuantity * craftQuantity
calculatedReturnedQuantity = Math.floor(grossQuantity * rrr)
calculatedConsumedQuantity = grossQuantity - calculatedReturnedQuantity
returnedQuantity = Math.floor(grossQuantity * rrr)
consumedQuantity = grossQuantity - returnedQuantity
```

Do not use:

```js
Math.ceil(grossQuantity * (1 - rrr))
```

Rules:

- One queue row is one batch.
- Do not sum per-craft ceil results for a batch.
- `baseQuantity` and `craftQuantity` must be positive integers.
- Returned and consumed quantities must be non-negative integers.
- Product output is not reduced by RRR.

Manual override model:

```js
{
  overrideEnabled: true,
  overrideConsumedQuantity: 17
}
```

Result shape:

```js
{
  calculatedConsumedQuantity,
  appliedConsumedQuantity,
  consumptionSource: 'calculated' | 'manual-override'
}
```

Rules:

- Override is optional.
- Override applies per material line.
- Override is not copied silently across queue rows.
- Override quantity must be a non-negative integer.
- Blank or invalid override blocks before mutation.
- Craft record / Ledger must preserve `appliedConsumedQuantity`.
- Craft record must preserve calculated and applied values.
- Special Material does not allow manual override.
- Current `actualMainQty` and `actualSubQty` are legacy-compatible current behavior.

## Craft Completion Bounded Modules

The 0.5.0 implementation path should use bounded pure modules before production integration.

### Layer 1: Requirement Resolver

```js
resolveCraftRequirements({
  recipe,
  itemLevel,
  craftQuantity
})
```

Scope:

- recipe validation
- regional material gross requirement
- Artifact requirement
- Alchemy requirement
- product output quantity
- no inventory access
- no cash access
- no transaction write

### Layer 2A: Production Bonus Calculator

```js
calculateProductionBonus({
  profile,
  recipeCategory,
  eventParameters
})
```

Scope:

- profile validation
- region specialization matching
- LPB lookup
- focus and daily additions
- RRR calculation
- structured breakdown output

### Layer 2B: Regional Material Consumption

```js
calculateRegionalMaterialConsumption({
  baseQuantity,
  craftQuantity,
  rrr,
  override
})
```

Scope:

- batch calculation
- override validation
- calculated / applied result
- no inventory mutation

### Layer 2C: Craft Completion Calculator

```js
calculateCraftCompletion({
  requirements,
  productionBonus,
  regionalMaterialCosts,
  specialMaterialCosts,
  usageFee
})
```

Scope:

- product batch total
- product unit cost
- cost breakdown
- no transaction write
- no save
- no queue mutation

### Layer 3: Operation Composer

```js
prepareCraftCompletionOperation({
  calculation,
  inventories,
  cash,
  targetLocationId
})
```

Scope:

- validate inventory and cost basis
- produce next regional inventory
- produce next product inventory
- produce next special material inventory
- produce next cash
- produce legacy transaction drafts
- return atomic operation result

### Integration Adapter

Component integration remains separate:

- DOM input
- toast
- state assignment
- queue removal
- `saveState()`
- UI refresh

Do not hide these side effects inside pure modules.

## Pure API Validation / Result Contract

The following result contracts are target-only for the next tests-first checkpoint. They do not mean implementation exists.

### `calculateProductionBonus`

Success:

```js
{
  ok: true,
  status: 'calculated',
  components: {
    locationBaseLpb,
    specializationProfileLpb,
    focusLpb,
    dailyLpb
  },
  totalLpbPercent,
  rrr,
  errors: []
}
```

Failure:

```js
{
  ok: false,
  status: 'invalid-production-bonus',
  components: null,
  totalLpbPercent: null,
  rrr: null,
  errors: [errorCode]
}
```

Error priority:

```text
INVALID_PROFILE
INVALID_RECIPE_CATEGORY
INVALID_EVENT_PARAMETERS
LOCATION_MISMATCH
```

Return one primary error per validation failure.

### `calculateRegionalMaterialConsumption`

Success:

```js
{
  ok: true,
  status: 'calculated',
  grossQuantity,
  calculatedReturnedQuantity,
  calculatedConsumedQuantity,
  appliedConsumedQuantity,
  consumptionSource: 'calculated' | 'manual-override',
  errors: []
}
```

Failure:

```js
{
  ok: false,
  status: 'invalid-consumption',
  grossQuantity: null,
  calculatedReturnedQuantity: null,
  calculatedConsumedQuantity: null,
  appliedConsumedQuantity: null,
  consumptionSource: null,
  errors: [errorCode]
}
```

Error priority:

```text
INVALID_BASE_QUANTITY
INVALID_CRAFT_QUANTITY
INVALID_RRR
INVALID_OVERRIDE
```

Return one primary error per validation failure.

Input validation:

- `baseQuantity`: positive integer.
- `craftQuantity`: positive integer.
- `rrr`: finite number where `0 <= rrr < 1`.
- `override` may be missing or `overrideEnabled: false`.
- When `overrideEnabled: false`, ignore override quantity.
- When `overrideEnabled: true`, quantity must be a non-negative integer.
- If override object is provided, `overrideEnabled` must be boolean.

## Special Material Closeout

Current-master completed pure boundaries:

- `src/data/specialMaterialCatalog.js`
- `src/services/specialMaterialIdentityResolver.js`
- `src/services/specialMaterialInventoryService.js`
- `tests/special-material-catalog.test.js`
- `tests/special-material-identity-resolver.test.js`
- `tests/special-material-inventory-service.test.js`

Covered:

- 153 row catalog
- 146 Artifact rows
- 7 Alchemy rows
- pure resolver
- `ALBION_DB` raw-name parity
- Blueflame explicit stable ID
- Imp's Horn explicit stable ID
- inventory service interoperability
- exact-file ESLint coverage

Not covered:

- production integration
- state/storage writer
- cash/transaction writer
- backup/import/export
- Crafting UI integration

Completed checkpoints:

- Special material identity catalog review
- Tests-first pure catalog/resolver contract

Do not keep these checkpoints active.

## Current / Future Boundary

Current legacy behavior:

- Package/app version remains `0.4.4`.
- Current Crafting still uses legacy-compatible component flow.
- Manual Artifact / Alchemy cost inputs remain current production behavior.
- Current `actualMainQty` / `actualSubQty` remain legacy-compatible accounting input.
- Product inventory is currently location-based and remains the 0.5.0 target.

Completed pure boundaries:

- Special Material catalog.
- Special Material identity resolver.
- Special Material inventory service.
- Inventory transfer service.

Target-only behavior:

- Production Profile storage.
- Production Bonus calculator.
- Event-only craft parameters.
- Batch material consumption calculator.
- Manual override domain model.
- Craft requirement resolver.
- Craft completion calculator.
- Operation composer.
- Development build identifier.

High-risk production work still blocked:

- state/storage integration
- backup integration
- cash/transaction integration
- UI integration
- production writer switch
- migration / fallback removal
- version metadata

## Active Checkpoint

Next active checkpoint:

```text
Tests-first production bonus, profile validation, and material consumption contract
```

This checkpoint is pure/domain-only unless separately approved. It must not begin production integration.

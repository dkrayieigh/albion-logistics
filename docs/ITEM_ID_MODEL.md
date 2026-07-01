# Albion Logistics ERP Item ID Model

## 文件定位

本文件定義 item identifier 的 migration boundary。它不是 current implementation 的宣告，也不是要求立即 migration。

目的：

- 區分 current implementation、future spec 與 migration boundary。
- 防止未來把 Stable ID 規格誤寫成目前已完成行為。
- 作為日後建立 item adapter、mapping 與 regression tests 的邊界文件。

## Current Implementation

目前系統仍支援 legacy 中文 item key。

已知 current behavior：

- inventory key 仍可能使用中文顯示名稱加階級字串，例如 `鋼條_6.2`、`布料_6.1`。
- `laborerInventory` 仍可能使用中文物品名稱作為第一層 key。
- 部分 current code 仍可能透過拆解 `itemKey` 取得物品名稱與階級。
- regression tests 目前保護 legacy 中文 item key 與 `qtyByCity` 在核心流程中仍可使用。

這些 current behavior 是 legacy-compatible behavior，不代表 target model。

## Future Target

future target 是 Stable ID item model。

目標方向：

- inventory key 使用 `${StableId}_${itemLevel}`。
- `StableId` 應為穩定、語言無關的 item identifier，例如 `METALBAR` 或 future canonical recipe id。
- `itemLevel` 表示階級與附魔等級，格式為字串，例如 `"4.0"`、`"6.2"`、`"8.4"`。
- UI 顯示名稱不得作為長期 storage key。

此 target 尚未完成 migration。

## itemLevel Boundary

`itemLevel` 的目標格式：

- 型別：String。
- 格式：`"{tier}.{enchantment}"`。
- 範例：`"4.0"`、`"6.1"`、`"8.4"`。

Migration boundary：

- future payload 應明確提供 `itemLevel`。
- 不應依賴從 `itemKey` 字串拆解推導 `itemLevel`。
- current implementation 仍可能存在 legacy `quality` 欄位；不得把它誤寫成已完成的 `itemLevel` migration。

## itemKey Split Boundary

future boundary 禁止透過拆解 `itemKey` 反推出 `stableId` 或 `itemLevel`。

原因：

- Stable ID 本身可能包含底線。
- 顯示名稱、舊中文 key 與 future Stable ID 混用時，字串拆解容易誤判。
- 事件 payload 與 adapter 應明確提供 item identity。

Current implementation note：

- 目前 code 仍可能拆解 `itemKey`。
- 因此「禁止拆解 itemKey」是 migration boundary，不是 current implementation。

## Migration Preconditions

開始 Item ID migration 前必須具備：

- Legacy 中文 key ↔ Stable ID mapping。
- Item identity adapter，能同時讀取 legacy 中文 key 與 future Stable ID。
- Regression tests 覆蓋 legacy key 讀取、Stable ID 讀取、mapping 缺失、mapping 衝突。
- Backup validation，確認遷移前後庫存總量、`globalAvgCost` 與交易關聯不變。
- Rollback strategy，保留原始 backup 並可回復 legacy storage。

## Adapter-First Rule

不得直接全域替換 storage key。

正確順序：

1. 建立 read adapter。
2. 讓新程式碼透過 adapter 讀取 item identity。
3. 建立 mapping 與測試。
4. 驗證 backup / rollback。
5. 最後才規劃 storage key migration。

## 不得寫成 Current Implementation

以下內容不得寫成目前已完成：

- 系統已全面使用 Stable ID。
- inventory key 已全面是 `${StableId}_${itemLevel}`。
- `laborerInventory` 已全面使用 Stable ID。
- current code 已不再拆解 `itemKey`。
- legacy 中文 item key 已可移除。
- `quality` / legacy transaction 欄位已全面遷移為 `itemLevel`。
- 所有 backup 已完成 Stable ID migration。

## Future Inventory-Class Item Identity（Planning Boundary）

本節定義 future item identity 的分類方向，不代表目前 `src`、storage key、backup 或 transaction payload 已完成。具體 Stable ID 字串格式尚未確認；本節只定義 identity 維度與 current compatibility key 的差異。

### Future Identity Dimensions

- Material item：一般材料使用 material item identity + `itemLevel`；`itemLevel` 包含 tier/enchant，例如 T4.0～T8.4。
- Product item：成品使用 stable product ID + `itemLevel`；0.5.0 selected target keeps product inventory location-based, so product storage must retain a location dimension.
- Artifact item：神器使用 stable artifact ID + tier；artifact 不存在 enchant dimension。
- Alchemy item：煉金材料使用 stable alchemy ID + tier；alchemy 不存在 enchant dimension。

### Current Compatibility Key Difference

- Current compatibility key 仍可能是中文品名、legacy `itemKey` 或顯示名稱組合。
- Future target 會把物品 identity 與顯示名稱分離，並讓 resolver 負責中文 legacy key、英文顯示名稱與 Stable ID 之間的對照。
- Product future storage 不應依 city / `locationId` 建立庫存 bucket；製作與販售城市只應保留為事件 metadata。
- Artifact / alchemy 只需 tier，不得為特殊材料新增不存在的 enchant 維度。

### Not Current Implementation

以下內容不得寫成 current implementation：

- Stable product ID catalog 已完成。
- Artifact / alchemy Stable ID catalog 已完成。
- Product account-total storage is a rejected / superseded proposal for 0.5.0; product inventory remains location-based.
- Artifact / alchemy storage 已完成。
- Legacy 中文 item key 已被取代。
- Concrete Stable ID 字串格式已定案。

## v0.4.4 Shared Item Picker Boundary

本節只描述 current UI selection behavior，不代表 Stable ID migration 已完成。

- Crafting 與 Planner 共用 Item Picker。
- Shared picker uses `RECIPES` as the recipe/product selection source。
- Planner 不直接以 `ALBION_DB` 作為產品選擇來源。
- Shared picker 可以改善選擇一致性，但不改 storage key、transaction payload 或 item identity model。
- Current compatibility key 仍可能是 legacy 中文 item key 或 recipe display name。
- Stable Item ID catalog、Stable product ID、artifact/alchemy Stable ID 仍是 future target。

## Special Material Identity Boundary

Artifact / Alchemy identity proposal is documented in `SPECIAL_MATERIAL_INVENTORY.md` and the candidate inventory is tracked in `SPECIAL_MATERIAL_CATALOG.md`.

- Artifact identity must not depend on display name parsing。
- Alchemy identity must include concrete material kind and Tier；it must not collapse into a generic `alchemy` key。
- Future metadata should distinguish stable id、Chinese name、English name、category and tier。
- Temporary examples such as `artifact:<normalized-key>` or `alchemy:<tier>:<normalized-key>` are proposal only, not current implementation and not final ID format。
- Current code may still use recipe metadata such as `artifactName`、`artifactQty` and `alchemyName`。
- Pure service currently validates identity shape only；it does not provide a catalog implementation。
- Current runtime has no production special-material catalog source。
- Current runtime does not resolve recipe metadata into stable identity。
- Display name is not identity。
- Runtime slug is not identity。
- Exact stable ID assignment remains under catalog review。

Candidate stable ID pattern:

```text
ARTIFACT_<EXPLICIT_ASCII_KEY>
ALCHEMY_<EXPLICIT_ASCII_KEY>
```

Rules:

- IDs must be manually reviewed catalog constants.
- Runtime must not derive IDs by slugifying recipe display names.
- Tier is not part of `stableId`; Tier belongs to runtime identity `{ stableId, category, tier }`.
- `category` remains a separate identity field.
- Stable ID must not change because display text is renamed.
- The current pattern is a catalog candidate, not an approved production assignment.

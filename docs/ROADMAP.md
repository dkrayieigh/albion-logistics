# Albion Logistics ERP Roadmap

## 文件定位

本文件只描述目前 Spec Lead 指定的 active roadmap。Paused / Backlog 項目不代表取消；approved target 不代表 implementation authorization。

## Active Roadmap

### Active Checkpoint：Docs consolidation closeout

目標：

- 確保 active planning 文件不保留過時 current claims。
- 區分 historical plan、completed release baseline、current execution plan 與 future target。
- 統一 current、legacy-compatible、test-covered、future、migration boundary 的語義。
- 不啟動 Phase-1 source refactor 或其他 production implementation。
- 保留 confirmed business rules、regression expectations、confirmed bug reports 與 user-confirmed specification 的優先權。

不包含：

- production code 修改。
- migration implementation。
- release/version metadata 修改。
- service / adapter implementation。
- storage schema、backup format 或 transaction payload 修改。

### Completed Baseline：v0.4.4 backup/reset/release stabilization

以下 phase 已屬 completed baseline，不再是 active execution phase：

- Backup/reset contract.
- Tests-first backup regression.
- Pure backup envelope / classification / export service.
- Production v2 export integration.
- Validated atomic v2 import.
- Scoped Factory Reset.
- Manual smoke / rollback / release procedure.
- v0.4.4 release publication.

Completed baseline 只描述已完成的 v0.4.4 範圍，不授權新的 migration、schema switch、service extraction 或 release metadata 修改。

## Approved Next Order

Docs consolidation closeout 完成後，下一個已排序但尚未啟動的 checkpoint 順序：

1. Phase-1 refactor closeout.
2. Incremental quality tooling.
3. Custom warehouse boundary specification / completion.
4. Tests-first special-material pure contract.

此清單是 approved sequence，不代表任何一項已是 active workstream。

## Phase-1 Refactor Boundary

目標是先抽出可測、可回滾的小型 service boundary，不改使用者可見行為、不改 storage schema、不改 backup format、不改 transaction payload。

候選範圍：

- Inventory purchase / WAC service boundary.
- Inventory transfer service boundary.
- Crafting completion service boundary.
- Shared location validation.
- Selectors / query boundary.
- Structured service result.
- Component 保留 DOM / input / presentation responsibility.

不包含：

- Stable Item ID migration.
- Canonical transaction migration.
- `qtyByLocation` writer/storage migration.
- Legacy fallback removal.
- Special Material production inventory.
- Vite / CSP / SQLite.
- 一次性重寫 `state.js`。

## Historical v0.4.4 Plan：Backup/reset contract

目標：

- 定義 new-schema backup lifecycle。
- 定義 scoped Factory Reset 的 owned-key boundary。
- 定義 legacy backup policy、rollback 與 manual smoke expectations。
- Contract reviewed: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md)。

不包含：

- production export/import 接線。
- reset implementation。
- storage key/schema 修改。

### Historical Phase：Tests-first local regression

目標：

- Tests are written first locally.
- Initial red tests may exist only in the local working tree.
- Red tests must not be committed or pushed independently.
- Immediate scope is limited to envelope, classification, parsing, and repository-based export source.

不包含：

- production service。
- pure module-only merge。
- UI。
- writer/storage switch。
- import storage mutation。
- rollback implementation。
- scoped Factory Reset。

### Historical Phase：Minimum pure backup envelope / classification / export service

目標：

- Minimum pure codec/export service is implemented in the same working checkpoint as Phase 3 tests.
- Phase 3 and Phase 4 together form the first mergeable checkpoint.
- Targeted and full discovered test suites must all pass.
- Do not use `test.todo`, skip, or placeholder behavior to keep the suite green.
- Scope remains limited to envelope, classification, parsing, and repository-based export source.

不包含：

- production UI integration。
- automatic legacy migration。
- transaction payload migration。
- `app.js` / `state.js` / production integration。
- import storage mutation。
- rollback implementation。
- scoped Factory Reset。

### Historical Phase：Export integration

目標：

- 將 validated v2 export path 接入 production。
- 保留 legacy backup policy。
- 建立 manual smoke / rollback procedure。

### Historical Phase：Validated atomic import

目標：

- 將 validated v2 import path 接入 production。
- invalid input 必須 zero mutation。
- write failure 必須 rollback。

### Historical Phase：Scoped Factory Reset

目標：

- Reset only owned Albion Logistics storage keys。
- Preserve unrelated `localStorage` keys。
- 明確區分 active v2 與 explicit legacy mode。

### Historical Phase：Manual smoke / rollback / release procedure

目標：

- 完成 backup/reset manual smoke。
- 完成 rollback procedure。
- 確認 release checklist。

### Historical Phase：Selected bounded service implementation

目標：

- 只在 docs、tests、pure service 與 smoke gates 完成後，才選擇下一個 bounded service implementation。
- 不得一次接入 export/import/reset 全 production path。

## Later / Paused

以下項目目前不是 active workstream：

- Special-material implementation。
- Custom-location crafting profile。
- Stable Item ID migration。
- Canonical transaction migration。
- Account-total product inventory。
- Location service extraction。
- Vite。
- Progressive type checking。
- CSP。
- SQLite。

Later backlog 不等於 active。任何 backlog 項目都需要獨立 approval、tests 與 implementation boundary。

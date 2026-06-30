# Current Status

Status: Current
Authority: Current implementation summary
Last reviewed: 2026-06-30
Last verified against commit: `68c21acb1274bee0d27e65727f2b506332181502`

`Last verified against commit` 只表示最後核對點。需要最新狀態時仍應檢查 repo、latest CI run 與目前工作樹；docs-only commit 不需要把此欄位更新成自身 SHA。

本文件是目前 repo 狀態的快速入口。它整理 current implementation、test-covered behavior、active limitations 與 active workstreams；不取代 business rules、target specification、migration plan 或 regression tests。

## Production Runtime

- Desktop shell：Tauri 2。
- Frontend：Vanilla JavaScript / ES modules / HTML / CSS。
- Production `frontendDist` 指向 `src`。
- Package version：`0.4.4`。
- App title：`Albion Logistics v0.4.4`。
- CI workflow：Windows + Node 22，執行 `npm ci`、`npm test`、`npm run lint`、`npm run format:check`。
- Active new-schema storage key：`albion-logistics-v2-state`。
- Production startup/read-write cutover 已存在：ready / initialize / blocked path 已接入 app startup。
- Ready startup 讀取 new key，投影 canonical state 到 runtime state，hydrate defaults，並讓 active-runtime `saveState()` 寫回 new key。
- Missing storage + user confirmation 會建立 clean canonical state 並寫入 new key。
- Missing storage + user cancellation 會明確進入 legacy mode。
- Invalid/error startup 會 blocked；不建立空資料，不 silent fallback。
- Explicit legacy mode 仍可用，並使用 legacy localStorage path。

## Stable / Test-covered Areas

GitHub Actions 目前會自動探索並執行所有 `tests/**/*.test.js`。

最近確認的 CI 狀態：

- all discovered tests pass
- ESLint pass
- Prettier check pass

精確 test count 屬時間性 snapshot，應以 latest CI run 為準，不得寫成長期固定 current state。

主要 test-covered scope：

- core cost / WAC regression。
- crafting material consumption 與 actual-consumption safety。
- purchase / sale safety。
- inventory transfer。
- ledger data safety。
- backup legacy regression。
- quotation / sale valuation calculation。
- custom location stable-ID add / rename / remove behavior。
- new-schema codec、repository、runtime projection 與 production startup cutover。
- browser storage backend、browser repository composition、startup loader / decision boundary。
- runtime compatibility bridge。
- tooling CI：test / lint / format-check。

## Current Implementation Highlights

- 最新 `src` 與 regression tests 用於確認 current behavior。
- `src` 是 compatibility baseline，但不是絕對真理；confirmed business rules、regression expectations、confirmed bug reports 或 user-confirmed specification 可證明 current `src` 存在 bug 或落差。
- Crafting Planner / quotation 是 read-only planning path；不寫 inventory、cash、transactions 或 storage。
- `RECIPES` 是 Crafting 與 Planner 的 shared Item Picker source。
- Ledger English category / item display 是 presentation mapping；不重寫 stored transaction payload。
- Custom location add / rename / remove 已使用 stable custom location ID lifecycle；backup/reset/migration 邊界仍需另外處理。
- Production new-schema runtime path 已接入 startup/read-write；backup import/export 仍是 legacy-only。
- Runtime compatibility bridge 支援 `qtyByLocation` / `qtyByCity` projection，但這不代表所有 writer、backup、migration 都已完成。

## Active Limitations

- New-schema backup import/export 尚未完成。
- Factory Reset scope 尚未收斂，仍需避免 broad `localStorage.clear()`。
- Formal special-material inventory 尚未實作，且 implementation status 已凍結為 Paused。
- Account-total product inventory 尚未實作。
- Custom-location crafting profile 尚未定義。
- Canonical transaction migration 尚未開始。
- Stable Item ID migration 尚未開始。
- Legacy fallback 尚未移除。
- Ledger English mapping 是 presentation layer，不是 payload migration。
- Cost adjustment canonical event 與 cash-impact / valuation-impact 邊界尚未修正。
- CSP 仍為 `null`。
- Vite 尚未導入。
- SQLite 尚未導入。
- UI manual smoke checklist 尚未完成。

詳細限制請見 [Current Limitations](./CURRENT_LIMITATIONS.md) 與 [Implementation Gap](./IMPLEMENTATION_GAP.md)。

## Active Workstreams

目前 active workstreams 只保留兩項：

1. Docs consolidation closeout。
2. New-schema data safety stabilization。

Docs consolidation closeout 已完成的部分：

- `docs/README.md` 導覽入口。
- `docs/CURRENT_STATUS.md` current summary。
- 文件定位分類與閱讀順序。

Docs consolidation closeout 尚未完成的部分：

- planning / historical 文件整理。
- 過時狀態文字改寫或移入 archive。
- active-only `CURRENT_LIMITATIONS.md` 重整。
- broken-link-safe archive relocation。

New-schema data safety stabilization 聚焦：

- new-schema backup lifecycle。
- Factory Reset scope。
- active contract: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md)。
- backup/reset 的 docs -> tests -> pure service -> production integration 順序。

## Paused / Backlog Workstreams

Paused 不代表取消；approved target 不代表 implementation authorization。

- Special-material implementation。
- Custom-location crafting profile。
- Stable Item ID migration。
- Canonical transaction migration。
- Account-total product inventory。
- Vite。
- Progressive type checking。
- CSP。
- SQLite。
- Location service extraction。

## Data-safety Architecture Boundary

Future data-safety implementation boundary：

```text
UI
-> backup/reset application service
-> codec/validation
-> repository/storage backend
```

Boundary rules：

- This is future implementation boundary, not current implementation。
- Do not split `state.js` preemptively。
- Export、import、reset must remain separate checkpoints。
- Do not wire everything into the production path in one step。
- `app.js` should call pure services only after tests and service contracts exist。
- This section does not define SQLite or canonical transaction work。

## Reviewed Core Specifications

以下文件包含 current rules、target specifications 或 migration boundaries。閱讀時應以文件內標示的 current / future / migration boundary 為準：

- [Architecture](./ARCHITECTURE.md)
- [Business Rules](./BUSINESS_RULES.md)
- [Data Model](./DATA_MODEL.md)
- [Location Model](./LOCATION_MODEL.md)
- [Item ID Model](./ITEM_ID_MODEL.md)
- [Transaction Event Model](./TRANSACTION_EVENT_MODEL.md)
- [Event Catalog](./EVENT_CATALOG.md)
- [Test Cases](./TEST_CASES.md)

## Historical / Planning Material

以下文件含有 handoff、gap、checkpoint、adapter plan 或 migration plan。它們可用於追蹤決策，但不應單獨作為 current truth：

- [Project Handoff](./PROJECT_HANDOFF.md)
- [Implementation Gap](./IMPLEMENTATION_GAP.md)
- [Migration Plan](./MIGRATION_PLAN.md)
- [Adapter API](./ADAPTER_API.md)
- [Adapter Test Plan](./ADAPTER_TEST_PLAN.md)
- [Roadmap](./ROADMAP.md)

若這些文件與本文件發生狀態衝突，先把本文件當作 current 閱讀入口，再回到 confirmed business rules、regression tests、latest production `src`、confirmed bug reports 與 user-confirmed specification 查證。

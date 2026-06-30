# Albion Logistics ERP Roadmap

## 文件定位

本文件只描述目前 Spec Lead 指定的 active roadmap。Paused / Backlog 項目不代表取消；approved target 不代表 implementation authorization。

## Active Roadmap

### Phase 1：Docs consolidation closeout

目標：

- 完成 docs entrypoint 與 current status 導覽。
- 清理 planning / historical 文件的誤導性 current wording。
- 保留 confirmed business rules、regression expectations、confirmed bug reports 與 user-confirmed specification 的優先權。

不包含：

- production code 修改。
- migration implementation。
- release/version metadata 修改。

### Phase 2：Backup/reset contract

目標：

- 定義 new-schema backup lifecycle。
- 定義 scoped Factory Reset 的 owned-key boundary。
- 定義 legacy backup policy、rollback 與 manual smoke expectations。
- Contract reviewed: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md)。

不包含：

- production export/import 接線。
- reset implementation。
- storage key/schema 修改。

### Phase 3：Tests-only data-safety regression

目標：

- 為 backup/reset contract 建立 tests-only safety net。
- 驗證 invalid input zero mutation。
- 驗證 write failure rollback。
- 驗證 unrelated `localStorage` key preservation。

不包含：

- production service。
- UI。
- writer/storage switch。

### Phase 4：Pure new-schema backup service / codec

目標：

- 建立 pure service / codec boundary。
- 驗證 v2 backup envelope / version。
- 維持 export、import、reset 分離。

不包含：

- production UI integration。
- automatic legacy migration。
- transaction payload migration。

### Phase 5：Export integration

目標：

- 將 validated v2 export path 接入 production。
- 保留 legacy backup policy。
- 建立 manual smoke / rollback procedure。

### Phase 6：Validated atomic import

目標：

- 將 validated v2 import path 接入 production。
- invalid input 必須 zero mutation。
- write failure 必須 rollback。

### Phase 7：Scoped Factory Reset

目標：

- Reset only owned Albion Logistics storage keys。
- Preserve unrelated `localStorage` keys。
- 明確區分 active v2 與 explicit legacy mode。

### Phase 8：Manual smoke / rollback / release procedure

目標：

- 完成 backup/reset manual smoke。
- 完成 rollback procedure。
- 確認 release checklist。

### Phase 9：Selected bounded service implementation

目標：

- 只在 docs、tests、pure service 與 smoke gates 完成後，才選擇下一個 bounded service implementation。
- 不得一次接入 export/import/reset 全 production path。

## Later Backlog

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

# Documentation Guide

本目錄同時包含 current implementation、已核准目標規格、active migration 邊界與歷史規劃文件。閱讀時請先確認文件定位，不要把 future target 或 planning note 解讀為目前 production behavior。

## 快速入口

### 想確認目前可依賴的行為

- [Current Status](./CURRENT_STATUS.md)
- [Current Limitations](./CURRENT_LIMITATIONS.md)

### 修改 production code 前

請依序確認：

1. [Current Status](./CURRENT_STATUS.md)
2. [Current Limitations](./CURRENT_LIMITATIONS.md)
3. 對應領域規格文件
4. [Test Cases](./TEST_CASES.md)
5. 相關 regression tests

最新 `src` 與 regression tests 用於確認 current behavior。`src` 是 compatibility baseline，但不是絕對真理；confirmed business rules、regression expectations、confirmed bug reports 或 user-confirmed specification 都可能證明 current `src` 存在 bug 或落差。docs-only plan、future target、migration target 仍不能直接當作 current behavior。

### 規劃下一階段功能

- [Roadmap](./ROADMAP.md)
- 對應的 target specification，例如 [Business Rules](./BUSINESS_RULES.md)、[Location Model](./LOCATION_MODEL.md)、[Item ID Model](./ITEM_ID_MODEL.md)、[Transaction Event Model](./TRANSACTION_EVENT_MODEL.md)。

### 處理資料模型或 migration

- [Data Model](./DATA_MODEL.md)
- [Location Model](./LOCATION_MODEL.md)
- [Item ID Model](./ITEM_ID_MODEL.md)
- [Transaction Event Model](./TRANSACTION_EVENT_MODEL.md)
- [Migration Plan](./MIGRATION_PLAN.md)

`MIGRATION_PLAN.md` 只代表 active planning 與邊界整理；只有明確標示為已實作、已測試且已接入 production path 的 phase 才能視為目前行為。

## 文件定位分類

### Current

目前 production path 可觀察到的行為。

### Test-covered

已有 regression tests 保護，但仍需確認是否已接入 production writer、storage、backup 或 UI path。

### Approved specification

已核准的 target / business rule。除非文件明確標為 current implementation，否則不可視為目前已完成。

### Active migration

正在規劃或部分實作中的 migration boundary。不得跳過 adapter、tests、backup validation 或 release gate。

### Planning

討論、handoff、gap、checkpoint 與後續任務規劃。可作為背景，不可單獨作為 production truth。

### Historical

過去 checkpoint、incident recovery、release note 或 superseded strategy。保留作為脈絡，不代表目前狀態。

## 文件權威順序

當 docs 彼此衝突，或 docs 與 `src` / tests 衝突時，請依序核對：

1. confirmed business rules
2. regression tests 與 regression expectations
3. latest production `src`
4. confirmed bug reports
5. user-confirmed specification
6. [Current Status](./CURRENT_STATUS.md) current summary
7. reviewed / approved core specifications
8. active migration documents
9. planning / handoff / implementation-gap 文件
10. historical / archived 文件

注意事項：

- `src` 是 compatibility baseline，但不是絕對真理。
- confirmed business rules、regression expectations、confirmed bug reports 或 user-confirmed specification 可證明 current `src` 存在 bug 或落差。
- test plan 不等於已測試。
- docs-only plan 不等於 production behavior。
- adapter 存在不等於 writer 已切換。
- future target 不等於 current implementation。
- migration target 不等於 current storage shape。

## 狀態衝突處理

`CURRENT_STATUS.md` 是 current 閱讀入口，不是覆蓋 business rules 或 target specification 的 override。

處理規則：

1. 不得在舊文件追加新的 status override 區塊。
2. 過時內容應在後續 consolidation 中改寫、刪除，或移入 archive。
3. Historical checkpoint 可以保留，但不得作為 current truth。
4. 發現狀態衝突時，必須回到 confirmed business rules、regression tests、latest production `src`、confirmed bug reports 與 user-confirmed specification 交叉核對。
5. 任何會改 storage、writer、backup、migration、schema 或 transaction payload 的工作，仍必須回到對應規格與 tests。

## 文件索引

### Current / 快速狀態

- [Current Status](./CURRENT_STATUS.md)
- [Current Limitations](./CURRENT_LIMITATIONS.md)
- [Test Cases](./TEST_CASES.md)

### Core specifications

- [Architecture](./ARCHITECTURE.md)
- [Business Rules](./BUSINESS_RULES.md)
- [Data Model](./DATA_MODEL.md)
- [Location Model](./LOCATION_MODEL.md)
- [Item ID Model](./ITEM_ID_MODEL.md)
- [Transaction Event Model](./TRANSACTION_EVENT_MODEL.md)
- [Event Catalog](./EVENT_CATALOG.md)

### Planning / migration / handoff

- [Roadmap](./ROADMAP.md)
- [Migration Plan](./MIGRATION_PLAN.md)
- [Implementation Gap](./IMPLEMENTATION_GAP.md)
- [Project Handoff](./PROJECT_HANDOFF.md)
- [Adapter API](./ADAPTER_API.md)
- [Adapter Test Plan](./ADAPTER_TEST_PLAN.md)

### Focused workflow docs

- [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md)
- [Special Material Inventory](./SPECIAL_MATERIAL_INVENTORY.md)
- [Sale Valuation Workflow](./SALE_VALUATION_WORKFLOW.md)
- [Crafting Incident Recovery](./CRAFTING_INCIDENT_RECOVERY.md)
- [Crafting Hotfix Smoke Checklist](./CRAFTING_HOTFIX_SMOKE_CHECKLIST.md)
- [AI Guide](./AI_GUIDE.md)

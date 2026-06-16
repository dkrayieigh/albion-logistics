# Albion Logistics ERP AI Guide

## 身分

你是專案工程師。

## 不可修改

- WAC
- Stable ID
- Event Catalog
- Business Rules

## 禁止

- FIFO
- LIFO
- Batch Costing
- 自動新增功能

## Inventory

唯一合法 Key：

${StableId}_${itemLevel}

## Cost Basis

只有 PURCHASE_ITEM 可以建立外部真實交易成本基準。
CRAFT_COMPLETE 可以建立製造成品成本基準，但不得修改被消耗材料的成本基準。

## 文件優先順序

若本文件與其他文件或程式碼出現衝突，請先停止實作並回報衝突點，不要自行猜測。

一般優先順序：

1. 使用者本次明確指示
2. docs/AI_GUIDE.md
3. docs/BUSINESS_RULES.md
4. docs/EVENT_CATALOG.md
5. docs/ARCHITECTURE.md
6. 現有程式碼行為

若 Business Rules 或 Event Catalog 需要修改，必須先取得使用者明確要求。

## Stable Release Guardrails

在穩定版封版階段，Codex 不得主動進行大規模 migration。

允許任務：
- docs-only sync
- regression test 補強
- 明確封版阻斷 bug 修復

禁止任務：
- Stable ID migration
- `qtyByLocation` 全域替換
- transaction event payload 全面改寫
- localStorage schema 重構
- 無測試保護的大型 refactor

執行規則：
- 修改前先區分 **current implementation**、**legacy-compatible behavior** 與 **future spec**。
- 不得把 future spec 寫成已完成行為。
- 穩定版 baseline 為 `npm.cmd test`：39 tests、39 pass、0 fail、0 TODO；修改 production code 後不得降低此基準。
- 不得移除或弱化 `TEST-A07`：材料數量充足但必要材料 `globalAvgCost === null` 時，製作必須阻擋，且不得造成材料、成品、cash、transactions 或 craftingQueue 的錯誤變更。
- 優先使用小型 regression test 與局部修復，不以 migration 或重構處理封版問題。
- 涉及備份、cash、inventory、transactions 或 `globalAvgCost` 的修改，必須明確驗證失敗路徑不造成部分狀態變更。

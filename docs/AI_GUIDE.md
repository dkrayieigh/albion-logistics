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
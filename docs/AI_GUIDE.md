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
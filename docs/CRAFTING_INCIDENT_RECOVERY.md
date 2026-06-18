# Crafting Incident Recovery Plan

## 1. Incident Summary

T5.3 審判者護甲實例暴露 crafting formula bug。

已確認的異常：

- 系統計算 19 件店鋪費為 `61,106`。
- Artifact item value 未乘上 quantity。
- 單件神器成本 `200,000` 未進入成品 `globalAvgCost`。
- 成品均價因此約為 `295,943`。
- 該數字可由 `(159 * 34,980 + 61,106) / 19` 反推，代表神器成本缺失。

此 incident 影響的是歷史 crafting cost correctness。E1 hotfix 修正 forward calculation，但不會自動修復已寫入的歷史資料。

## 2. Affected Versions / Affected Area

在正式 version tag 尚未建立前，以 commit boundary 描述受影響範圍：

- `f12f5c12f4e5450c66445e5379eb5a84df1c5b2a` (`fix: correct artifact crafting cost calculations`) 之前的 crafting formula 可能不可信。
- 受影響範圍集中在 artifact / alchemy crafting cost calculation、crafting queue input、以及 `submitCraftAll()` commit 時的 tax / cost aggregation。
- 非 artifact / alchemy crafting 仍需依個別資料檢查，不應直接假設全部正確或全部錯誤。

## 3. Confirmed Bugs Fixed by E1

E1 已修復 forward behavior：

- `artifactVal` fee quantity bug：artifact item value 已乘上 crafted quantity。
- `artifactPrice` queue input class bug：queue artifact / alchemy input class 已修正，使輸入能被正確讀取。
- Stale `q.tax` before `submitCraftAll`：commit 前會重新依目前 shop fee 計算 fresh tax。

Regression coverage exists in `tests/core-cost-regression.test.js` for:

- T5.3 審判者護甲 artifact fee quantity。
- `submitCraftAll()` 將 artifactPrice 納入 crafted item `globalAvgCost` 與 transaction total。
- `submitCraftAll()` commit 前重新計算 tax。

## 4. Still Unresolved / Not Fixed

以下仍未解決，不能視為 stable release ready：

- Material safe-stock requirement 尚未定義。
- Material return formula 的 net consumption vs conservative start-stock boundary 尚未定義。
- 已有 `test.todo` 保留 safe-stock boundary 決策點。
- Historical crafting data repair 尚未完成。
- 目前沒有 repair tool。
- 目前沒有經 Spec Lead 核准的資料修復流程。
- Release readiness 尚未完成。

## 5. Contaminated Data Classes

受污染或可能受污染的資料類型：

- Crafting transaction `total` / `unitPrice`。
- Crafted item `globalAvgCost`。
- Crafting cash deduction。
- 後續成品出售 profit / margin，如果引用了受污染 crafted cost。
- Net asset value。
- 任何依受污染 `globalAvgCost` 產生的報表、估價或人工判斷。

注意：E1 hotfix 不會回溯重算歷史 transaction，也不會自動修改既有 `globalAvgCost`。

## 6. Data That May Still Be Usable With Caution

以下資料可能仍可使用，但應以 backup 與人工核對為前提：

- Raw purchase records。
- 材料數量，前提是先做 physical recount 或可信盤點。
- Transport records。
- Non-crafting ledger records。
- Crafting 以外、不依賴受污染成品成本的現金紀錄。

這些資料可作為重建依據，但不應直接用來證明 crafting cost 正確。

## 7. Immediate User Procedure

在任何修復前：

1. Export backup before any repair。
2. Stop relying on old crafting cost。
3. Manually reconcile important crafted items。
4. Do not reset, delete, or overwrite evidence before backup。
5. 對高價成品優先核對：材料投入、artifact / alchemy 成本、shop fee、成品數量、transaction total、unitPrice 與 `globalAvgCost`。

## 8. Recovery Options

可考慮的恢復策略：

### Manual Rebuild

適用於 crafting records 數量少、品項重要且可人工查證時。

- 從 backup 取出原始 crafting records。
- 以 E1 修正後公式人工重算。
- 比對材料、artifact / alchemy 成本、shop fee、cash deduction 與成品數量。
- 以人工記錄方式標註修正依據。

### Ledger Annotation / Contaminated Period Marker

適用於不立即改資料，但需要阻止誤用歷史成本時。

- 標記受污染期間。
- 在 release note / handoff 中註明該期間 crafting cost 不可信。
- 保留原始 transaction 以便後續審計。

### Future Repair Tool

只能在 Spec Lead approval 後規劃。

必要前提：

- 明確定義 repair input / output。
- 明確定義是否允許修改 `globalAvgCost`。
- 明確定義是否新增 correction transaction，而不是直接覆寫歷史資料。
- 建立 backup / rollback 驗證。
- 建立 regression tests。

本文件不要求、也不授權建立 repair tool。

## 9. Release Boundary

E1 hotfix is not stable release。

目前不能 release，原因：

- Historical crafting data 已可能污染。
- Material safe-stock boundary 尚未定義。
- Recovery plan 尚未完成審查。
- Manual T5.3 Judicator Armor smoke test 尚未在 release checklist 中完成。

Release 至少需要：

- Regression pass：`69 tests / 68 pass / 0 fail / 1 TODO`。
- Manual T5.3 Judicator Armor smoke test。
- 明確 recovery plan。
- 明確 release note，說明 E1 前歷史 crafting cost 可能不可信。
- Spec Lead 確認是否需要資料修復、ledger annotation 或 contaminated period marker。

## 10. Links / References

- `docs/IMPLEMENTATION_GAP.md`
- `docs/BUSINESS_RULES.md`
- `docs/TEST_CASES.md`
- `tests/core-cost-regression.test.js`
- `src/components/crafting.js`

## Non-goals

本文件不做以下事項：

- 不修改 `src`。
- 不修改 tests。
- 不修改 package files。
- 不修改 localStorage schema。
- 不修改 transaction payload。
- 不修改 writer / storage path。
- 不新增 migration code。
- 不新增 adapter implementation。
- 不修改 backup import/export logic。
- 不建立 repair tool。
- 不 mutate historical data。
- 不宣告 E1 已可 release。

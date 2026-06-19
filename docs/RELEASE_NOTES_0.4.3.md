# Albion Logistics v0.4.3

## Release Type

Post-incident stabilization patch release.

This release candidate focuses on crafting cost correctness, manual actual-consumption workflow, and P2P sale valuation clarity after the crafting formula incident.

## Version Metadata

- `package.json`: `0.4.3`
- `package-lock` root: `0.4.3`
- `src-tauri/tauri.conf.json`: `0.4.3`
- Window title: `Albion Logistics v0.4.3`
- `src-tauri/Cargo.toml`: `0.4.3`
- `src-tauri/Cargo.lock` root: `0.4.3`

## Major Fixes

- 修正神器裝備店鋪使用費未乘製作數量。
- 修正神器價格未正確進入製作成本的輸入流程。
- 製作提交前使用最新店鋪費，不再使用 stale queue tax。
- 製作現金支出拆分為店鋪費、神器成本、鍊金成本。
- 製作成本改用使用者輸入的實際材料消耗。
- 實際材料消耗未填時阻擋製作。
- 採購與製作未選品質時阻擋，不再默認 `4.0`。

## Sale Valuation Improvements

- 遊戲估價單價 / 總價同步。
- 90% / 85% P2P 參考值。
- 實售單價 / 總價同步。
- 顯示成本總額、預估毛利、單件毛利、毛利率。
- 成本未知時不顯示假毛利。
- 移除固定市場稅額作為 P2P 主要資訊。
- 改善窄視窗 sale popup 排版。

## Crafting Planning Information

Crafting queue now separates planning information from actual accounting:

- 顯示「預估消耗」。
- 顯示「保守備料」。
- 實際入帳仍以使用者填入的「實際消耗」為準。

Accounting boundary:

- 店鋪使用費、神器成本、鍊金成本是本次製作現金支出。
- 材料成本屬於 inventory cost consumption，不是本次 cash deduction。
- 成品 `globalAvgCost` 以實際材料消耗、店鋪費、神器成本與鍊金成本計算。

## Compatibility Boundary

v0.4.3 remains legacy-compatible. This release still uses and supports:

- Chinese item keys.
- `qtyByCity`.
- Legacy transaction payload.
- `customLocations` legacy strings.
- `state.laborerInventory['滿日記本']`.
- Legacy fallbacks.

This release does not start migration away from these formats.

## Not Included

v0.4.3 does not include:

- Stable ID migration.
- `qtyByLocation` migration.
- Canonical transaction writer.
- Transaction payload migration.
- localStorage schema migration.
- Historical repair tool.
- Legacy fallback removal.

## Known Limitations

- v0.4.3 不會自動修復舊版本已寫入的錯誤製作成本。
- pre-E1 historical crafting transactions、crafted `globalAvgCost`、cash flow、sale profit、net asset value 可能不可信。
- 多個 queue row 共用同一材料時，aggregated safe-start stock 規則尚未定義。
- 使用者必須在製作完成後填入實際材料消耗。

## Upgrade / Safety Guidance

Before upgrading or validating this release:

- 升級前匯出 backup。
- 不要刪除舊 backup。
- 對重要成品重新核對 `globalAvgCost`。
- 舊資料需要修復時先交回 Spec Lead，不直接修改 JSON 或建立 repair tool。

## Verification Summary

- `npm test`: `93 tests / 92 pass / 0 fail / 1 TODO`
- Node syntax checks: pass
- Tauri production build: pass
- Working tree clean after build

Build artifacts produced:

- `src-tauri/target/release/albion-logistics.exe`
- `src-tauri/target/release/bundle/msi/albion-logistics_0.4.3_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/albion-logistics_0.4.3_x64-setup.exe`

## Final Release Checklist

- [ ] Git working tree clean
- [ ] HEAD 為 v0.4.3 release commit
- [ ] npm test 通過
- [ ] MSI smoke
- [ ] NSIS smoke
- [ ] App title 顯示 v0.4.3
- [ ] Backup export/import smoke
- [ ] Crafting actual-consumption smoke
- [ ] Sale valuation smoke
- [ ] Tag v0.4.3
- [ ] GitHub Release 建立
- [ ] MSI / NSIS 上傳
- [ ] Release notes 貼入 GitHub Release

## Suggested GitHub Release Body

```md
# Albion Logistics v0.4.3

Post-incident stabilization patch release.

## Highlights

- Fixed artifact equipment crafting fee calculation so artifact item value is multiplied by crafted quantity.
- Fixed artifact / alchemy queue input handling.
- Craft submit now recalculates shop fee from the latest global shop fee before commit.
- Crafting cash cost display now separates shop fee, artifact cost, alchemy cost, and total cash deduction.
- Crafting accounting now uses user-entered actual material consumption.
- Purchase and crafting without explicit quality selection are blocked instead of defaulting to 4.0.
- Sale valuation popup now supports P2P valuation workflow, 90% / 85% references, actual unit / total sync, and profit summary.

## Compatibility

v0.4.3 remains legacy-compatible:

- Chinese item keys
- qtyByCity
- legacy transaction payload
- customLocations legacy strings
- state.laborerInventory['滿日記本']
- legacy fallbacks

No Stable ID, qtyByLocation, canonical transaction writer, payload migration, localStorage schema migration, historical repair tool, or legacy fallback removal is included.

## Known Limitations

- v0.4.3 does not automatically repair incorrect crafting costs already written by older builds.
- Pre-E1 crafting transactions, crafted globalAvgCost, cash flow, sale profit, and net asset value may be unreliable.
- Aggregated safe-start stock rules for multiple queue rows sharing the same material remain undefined.
- Users must enter actual material consumption after crafting.

## Verification

- npm test: 93 tests / 92 pass / 0 fail / 1 TODO
- Node syntax checks: pass
- Tauri production build: pass
- Artifacts produced:
  - albion-logistics.exe
  - albion-logistics_0.4.3_x64_en-US.msi
  - albion-logistics_0.4.3_x64-setup.exe

## Upgrade Guidance

- Export a backup before upgrading.
- Do not delete old backups.
- Reconcile important crafted item globalAvgCost values manually.
- If historical data needs repair, return to Spec Lead before editing JSON or creating a repair tool.
```

## References

- `docs/CRAFTING_INCIDENT_RECOVERY.md`
- `docs/CRAFTING_HOTFIX_SMOKE_CHECKLIST.md`
- `docs/SALE_VALUATION_WORKFLOW.md`
- `docs/PROJECT_HANDOFF.md`
- `docs/IMPLEMENTATION_GAP.md`

# Albion Logistics ERP Stable Release Stabilization

## 文件定位

本文件記錄目前穩定版封版狀態。內容區分 current implementation、legacy-compatible behavior、known limitations 與 future migration targets；不代表 Stable ID、`qtyByLocation` 或新版 event payload migration 已完成。

## 封版狀態

- Tauri desktop blocking error 已解除；原因為舊 `src-tauri/target` build artifact，不需要 source patch。
- 核心成本、庫存、ledger、出售、現金操作與備份安全已有 regression test 保護。
- 非空自訂倉庫刪除造成庫存遺失的封版阻斷問題已修復。
- 目前不進行大型重構或資料模型 migration。

## 自動化測試基準

執行：

```powershell
npm.cmd test
```

穩定版 baseline：

- 37 tests
- 36 pass
- 0 fail
- 1 TODO

目前 TODO：製作所需材料 `globalAvgCost === null` 時應阻擋製作。

## 已修復與已受保護項目

- 成品出售：成功、庫存不足、零數量、cash、ledger 與 `globalAvgCost` 不變。
- 工人島物資出售：成功、暫存不足、零數量與無效輸入阻擋。
- 現金校正、注資與提領：cash / debt / ledger 行為及無效輸入阻擋。
- 備份：readable JSON、新格式匯入、legacy JSON-string backup、無效資料不得覆寫。
- 自訂倉庫：非空倉庫不得刪除；空倉庫可刪除且不影響其他狀態。
- 既有採購、物流、製作、工人匯入與採購 reversal 核心規則。

## Known Limitations

- Current implementation 仍使用 legacy `qtyByCity`、中文 item key、名稱字串 custom location key 與 legacy transaction 欄位。
- `adjustWallet()` 已實作並受測，但目前 UI availability unknown。
- 銷售估價的 6.5%、90% 與 85% 僅為 UI 參考，不是正式事件規格。
- 工人島手動新增與「無痕校正」尚無正式稽核事件規格。
- 工人收成紀錄只保留最新 100 筆。
- 搜尋、分頁、部分製作、購物清單與部分桌面 UI 行為仍主要依賴手動驗證。

## Release Guardrails

- 不進行 Stable ID migration。
- 不進行 `qtyByCity` 至 `qtyByLocation` migration。
- 不全面改寫 transaction event payload。
- 不重構 `localStorage` 或 backup schema。
- 不把 future spec 寫成 current implementation。
- Production code 變更不得降低目前 regression test baseline。

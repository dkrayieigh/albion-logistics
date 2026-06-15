# 📦 Albion Logistics

![Status](https://img.shields.io/badge/status-legacy--compatible%20stabilization-orange)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

> 中文說明為主，English summary below.

## 中文

### 專案簡介

Albion Logistics 是一款以 ERP 工作流為目標的《阿爾比恩 Online》個人物流、製作成本與帳務追蹤工具。

目前專案處於 **legacy-compatible stabilization phase**。  
現有 `src` 仍是目前實作行為的主要參考，但部分較新的 docs 描述的是未來目標架構，而不是已完成的 current implementation。

目前內部版本號主要反映個人開發歷程，不代表產品成熟度、正式發行狀態或 ERP 完成度。

### 核心功能

- **製作管理**：支援資源返還率（RRR）、專注點、神器與鍊金材料成本試算。
- **物流與庫存**：採用加權平均成本法（Weighted Average Cost, WAC）追蹤全域均價，支援多城市與黑區地堡庫存轉移。
- **工人島管理**：追蹤工人島產出、滿日記本與匯入總庫存流程。
- **帳務紀錄**：追蹤採購、製作、調整、出售與現金流。

### 安裝與執行

1. 前往 [Releases](https://github.com/dkrayieigh/albion-logistics/releases) 頁面下載最新的 `.exe` 安裝檔。
2. 執行安裝並啟動 Albion Logistics。

### 技術堆疊

- **前端**：Vanilla JavaScript, ES6 Modules, HTML5, CSS3
- **狀態儲存**：LocalStorage
- **桌面端打包**：Tauri
- **測試**：Node.js test runner

### 開發狀態

目前優先事項：

1. 保護目前可用行為。
2. 補齊 `src` 與 `docs` 的差異追蹤。
3. 建立核心成本與 ledger safety regression tests。
4. 在 compatibility layer 建立前，避免直接大規模遷移資料模型。
5. 逐步從 legacy data structures 過渡到未來事件與資料模型。

重要提醒：

- 目前庫存仍使用 legacy `qtyByCity`。
- 目前 item key 仍可能使用中文顯示名稱。
- 目前 ledger records 仍使用 legacy transaction 欄位。
- Stable ID、`qtyByLocation`、Location Registry 與新版 event payload 屬於 future migration target。
- 不應把 future spec 視為 current implementation。

### 文件

主要文件：

- `docs/ROADMAP.md`：遷移與重構路線圖。
- `docs/CURRENT_LIMITATIONS.md`：目前限制與技術債。
- `docs/IMPLEMENTATION_GAP.md`：`src`、docs 與 future spec 的差異追蹤。
- `docs/TEST_CASES.md`：手動測試與 regression test 對照。

### 支持專案

Albion Logistics 是個人開源專案。  
如果這個專案對你有幫助，可以透過以下方式支持後續維護、測試與文件整理：

- Ko-fi: [ko-fi.com/dkrayleigh2](https://ko-fi.com/dkrayleigh2)
- 備用方式：[PayPal](https://www.paypal.com/ncp/payment/NHWGGGESQU8VJ)

非金錢支持也很有幫助：

- 回報 bug
- 提供真實使用情境
- 協助測試成本計算、備份匯入與物流流程
- 提出文件修正建議

### 聯絡

- GitHub Issues：適合 bug report、功能建議與文件問題。
- Discord：`dkrayleigh2`

請不要透過 Discord 傳送敏感帳務資料、私人金流資訊或遊戲帳號密碼。

---

## English Summary

Albion Logistics is a personal logistics, crafting-cost, and ledger tracking tool for Albion Online, designed around ERP-style workflows.

The project is currently in a **legacy-compatible stabilization phase**.  
The current `src` implementation remains the reference for actual behavior, while some newer documentation describes future target architecture rather than completed implementation.

The internal package version follows the project's development history and should not be interpreted as product maturity.

### Features

- Crafting cost estimation with RRR, focus, artifact, and alchemy material costs.
- Inventory tracking with global Weighted Average Cost (WAC).
- Multi-location logistics and stock transfer tracking.
- Laborer island inventory and import workflows.
- Ledger records for purchases, crafting, adjustments, sales, and cash flow.

### Current Priorities

1. Preserve current working behavior.
2. Document gaps between `src` and `docs`.
3. Add regression tests for core cost and ledger safety rules.
4. Avoid large-scale data model migration before compatibility layers exist.
5. Gradually migrate from legacy data structures to the future event/data model.

### Support

If this project is useful to you, you can support continued development here:

- Ko-fi: [ko-fi.com/dkrayleigh2](https://ko-fi.com/dkrayleigh2)
- Alternative: [PayPal](https://www.paypal.com/ncp/payment/NHWGGGESQU8VJ)

Bug reports, testing notes, real usage scenarios, and documentation suggestions are also valuable forms of support.

### Contact

- GitHub Issues: preferred for bug reports and feature requests.
- Discord: `dkrayleigh2`
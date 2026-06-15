# 📦 Albion Logistics

![Status](https://img.shields.io/badge/status-legacy--compatible%20stabilization-orange)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

Albion Logistics 是一款以 ERP 工作流為目標的《阿爾比恩 Online》個人物流、製作成本與帳務追蹤工具。

## ✨ 核心功能 (Features)
- **🔨 製作管理**：支援即時計算資源返還率 (RRR)、專注點收益，並包含神器與鍊金材料的成本試算。
- **📦 物流與庫存**：採用「加權平均成本法 (Weighted Average Cost, WAC)」追蹤全域均價，支援多城市與黑區地堡的庫存轉移。
- **🏡 工人島嶼**：獨立追蹤勞工產出與滿日記本消耗，實現工人島的「無痕套現」記帳。
- **📊 作業日誌**：全局儀表板實時顯示「累計現金流」與「製造淨資產」，每一筆買賣、轉移皆有跡可循。

## 🚀 安裝與執行 (Installation)
1. 前往 [Releases](https://github.com/dkrayieigh/albion-logistics/releases) 頁面下載最新的 `.exe` 安裝檔。
2. 執行安裝並啟動 Albion Logistics。

## 🛠️ 技術堆疊 (Tech Stack)
- **前端:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3
- **架構:** Event Delegation, CustomEvent Decoupling, LocalStorage Persistence
- **桌面端打包:** Tauri (Rust + Node.js)

## Development Status
The internal package version follows the project's development history and should not be interpreted as product maturity.

Albion Logistics ERP is currently in a legacy-compatible stabilization phase.

The current `src` implementation remains usable, but parts of the newer docs describe future target architecture rather than completed implementation.

Current priorities:

1. Preserve current working behavior.
2. Document gaps between `src` and `docs`.
3. Add regression tests for core cost and ledger safety rules.
4. Avoid direct large-scale migration before compatibility layers exist.
5. Gradually migrate from legacy data structures to the future event/data model.

Important notes:

- Current inventory still uses legacy `qtyByCity`.
- Current item keys may still use Chinese display names.
- Current ledger records still use legacy transaction fields.
- Stable ID, `qtyByLocation`, Location Registry, and new event payload are future migration targets.
- Do not treat future specs as current implementation.
# 📦 Albion Logistics (阿爾比恩物流與財務 ERP 系統)

![Version](https://img.shields.io/badge/version-v4.1.1-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

Albion Logistics 是一款專為《阿爾比恩 Online》玩家打造的桌面端 ERP 輔助工具。幫助玩家精準計算製作成本、追蹤物流轉移，並管理個人資產與工人島收益。

## ✨ 核心功能 (Features)
- **🔨 製作管理**：支援即時計算資源返還率 (RRR)、專注點收益，並包含神器與鍊金材料的成本試算。
- **📦 物流與庫存**：採用「移動平均成本法 (Moving Average Cost)」精準計算全局均價，支援多城市與黑區地堡的庫存轉移。
- **🏡 工人島嶼**：獨立追蹤勞工產出與滿日記本消耗，實現工人島的「無痕套現」記帳。
- **📊 作業日誌**：全局儀表板實時顯示「累計現金流」與「製造淨資產」，每一筆買賣、轉移皆有跡可循。

## 🚀 安裝與執行 (Installation)
1. 前往 [Releases](https://github.com/dkrayieigh/albion-logistics/releases) 頁面下載最新的 `.exe` 安裝檔。
2. 執行安裝並啟動 Albion Logistics。

## 🛠️ 技術堆疊 (Tech Stack)
- **前端:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3
- **架構:** Event Delegation, CustomEvent Decoupling, LocalStorage Persistence
- **桌面端打包:** Tauri (Rust + Node.js)
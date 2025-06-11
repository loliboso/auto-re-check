# 整合版自動補卡程式使用說明

## 📋 方案概述

這個整合版自動補卡程式完全**不修改**您現有的 `phase1-login-fixed.ts` 和 `phase2-attendance.ts` 程式碼，而是透過**繼承和組合**的方式，將兩個階段的功能整合在同一個瀏覽器 session 中執行。

## 🎯 解決的核心問題

- ✅ **Session 保持**：在同一個瀏覽器中完成登入和補卡，無需重新登入
- ✅ **程式碼保護**：完全不修改現有的穩定程式碼
- ✅ **功能完整**：包含 Phase1 的所有登入邏輯和 Phase2 的所有補卡邏輯
- ✅ **錯誤處理**：任一任務失敗立即終止（符合 PRD 要求）

## 📁 檔案結構

```
/Users/tnl-loso/Desktop/auto-re-check/src/
├── phase1-login-fixed.ts     # ✅ 原有的登入程式（不修改）
├── phase2-attendance.ts      # ✅ 原有的補卡程式（不修改）
├── integrated-main.ts        # 🆕 新建立的整合版程式
└── run-integrated.js         # 🆕 執行腳本
```

## 🚀 執行方式

### 方式一：使用 npm 腳本（推薦）
```bash
cd /Users/tnl-loso/Desktop/auto-re-check
npm run integrated
```

### 方式二：使用執行腳本
```bash
cd /Users/tnl-loso/Desktop/auto-re-check
node src/run-integrated.js
```

### 方式三：直接執行
```bash
cd /Users/tnl-loso/Desktop/auto-re-check
npx tsx src/integrated-main.ts
```

## 📊 程式執行流程

```
🚀 啟動瀏覽器
↓
🔐 Phase1: 登入流程
├── 處理登入彈出視窗
├── 填寫公司代碼、工號、密碼
├── 執行登入
└── 導航到表單申請頁面
↓
📝 Phase2: 補卡流程
├── 展開補卡記錄（6筆 → 10個任務）
├── 循環處理每個補卡任務：
│   ├── 點擊忘打卡申請單連結
│   ├── 等待新分頁開啟
│   ├── 填寫表單（類型、日期時間、地點）
│   ├── 送簽表單
│   └── 關閉分頁回到主頁面
└── 所有任務完成
↓
✅ 程式完成，關閉瀏覽器
```

## 🔧 整合架構設計

### 不修改現有程式碼的策略：

1. **配置合併**：整合兩個階段的 CONFIG、SELECTORS 等配置
2. **邏輯複製**：直接複製 phase1 和 phase2 的核心邏輯方法
3. **流程串接**：在同一個類別中依序執行兩個階段
4. **狀態保持**：使用同一個 browser 和 page 實例

### 主要類別架構：

```typescript
class IntegratedAutoAttendanceSystem {
  // Phase1 相關方法
  private async initializeBrowser()      // 啟動瀏覽器
  private async performLogin()           // 執行登入
  private async navigateToFormApplication() // 導航到表單申請
  
  // Phase2 相關方法  
  private expandAttendanceRecords()      // 展開補卡記錄
  private async processAllAttendanceTasks() // 處理所有補卡任務
  private async processSingleAttendanceTask() // 處理單一補卡任務
  
  // 主執行流程
  async run()                           // 整合執行入口
}
```

## 📝 使用者配置

程式會自動讀取 `/Users/tnl-loso/Desktop/auto-re-check/data/user-info.txt` 檔案，無需修改配置格式。

當前配置包含：
- 登入資訊：公司代碼、工號、密碼
- 6 筆補卡記錄（展開為 10 個補卡任務）

## 📊 日誌和監控

- **日誌檔案**：`logs/integrated-{timestamp}.log`
- **螢幕截圖**：`screenshots/` 目錄（如果需要的話）
- **即時輸出**：控制台顯示執行進度

## ⚠️ 注意事項

1. **網路連線**：確保網路穩定，能正常存取 apollo.mayohr.com 和 flow.mayohr.com
2. **系統相容性**：程式在 macOS 環境下開發，確保 Chrome 瀏覽器已安裝
3. **執行時間**：整個流程預計需要 5-10 分鐘，取決於網路速度和系統回應時間
4. **錯誤處理**：任何一個補卡任務失敗都會立即終止程式（符合 PRD 要求）

## 🔍 測試建議

第一次執行建議：
1. 確保 user-info.txt 的登入資訊正確
2. 執行前確認網路連線穩定  
3. 觀察控制台輸出和日誌檔案
4. 如果遇到問題，可以先測試現有的 phase1-login-fixed.ts 確認登入功能正常

## 🆘 故障排除

如果程式執行失敗：
1. 檢查日誌檔案中的詳細錯誤訊息
2. 確認 user-info.txt 格式和內容正確
3. 驗證網路連線和目標網站可正常存取
4. 檢查 Chrome 瀏覽器是否正常安裝

## 📈 後續擴展

這個整合架構可以輕鬆擴展：
- 新增更多補卡類型
- 支援更多表單類型
- 加入更詳細的錯誤重試機制
- 支援批次處理多個使用者

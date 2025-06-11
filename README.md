# 自動補卡程式

一個專為企業員工設計的自動補卡工具，能夠自動登入公司系統並完成補卡申請。

## 🚀 功能特色

- **全自動化流程**：從登入到補卡申請一鍵完成
- **智能環境檢查**：自動檢測 Node.js 和 Chrome 環境
- **批量處理**：支援多個日期的補卡申請
- **詳細日誌**：完整記錄執行過程和結果
- **安全可靠**：本地執行，資料不上傳

## 📋 系統需求

- **Node.js**: v16 或以上版本
- **Google Chrome**: 已安裝在系統中
- **作業系統**: macOS / Windows / Linux

### 🔄 第二階段：表單填寫功能 - **準備中**
### 🔄 第三階段：完整流程整合 - **規劃中**

## 🛠️ 安裝步驟

### 1. 下載程式
**開啟終端機（Terminal），執行以下命令：**
```bash
git clone https://github.com/loliboso/auto-re-check.git
cd auto-re-check
```

### 2. 安裝相依套件
```bash
npm install
```

### 3. 設定使用者資訊
**使用任何文字編輯器編輯** `data/user-info.txt` **檔案：**

```
登入資訊：
公司代碼：你的公司代碼
登入帳號：你的員工編號
密碼：你的密碼

補卡日期：
2025/01/15	上班未打卡
2025/01/16	下班未打卡
2025/01/17	上班未打卡 / 下班未打卡
```

### 4. 執行程式
**回到終端機執行：**
```bash
npm start
```

## 🎯 使用方法

### 快速開始
```bash
npm start
```

### 其他指令
```bash
# 檢查程式狀態
npm run check

# 查看執行日誌
npm run logs

# 清理暫存檔案
npm run clean
```

## 📁 專案結構

```
auto-re-check/
├── src/                    # 原始碼
│   └── integrated-main-v2.ts  # 主程式
├── data/                   # 配置檔案
│   └── user-info.txt      # 使用者資訊
├── logs/                   # 執行日誌
├── screenshots/            # 截圖檔案
├── archive/               # 封存檔案
│   ├── development/       # 開發過程檔案
│   ├── tests/            # 測試檔案
│   ├── old-versions/     # 舊版本程式
│   └── analysis/         # 分析工具
├── package.json           # 套件配置
├── tsconfig.json         # TypeScript 配置
├── USER_GUIDE.md         # 使用者指南
└── README.md             # 說明文件
```

## 🔧 配置說明

### 使用者資訊格式
- **公司代碼**：你的公司識別碼
- **登入帳號**：員工編號或登入帳號
- **密碼**：登入密碼
- **補卡日期**：需要補卡的日期和類型

### 補卡類型
- `上班未打卡`：只補上班打卡
- `下班未打卡`：只補下班打卡  
- `上班未打卡 / 下班未打卡`：補兩次打卡

## 📊 執行結果

程式執行後會：
1. 自動檢查系統環境
2. 驗證配置檔案
3. 開啟瀏覽器並登入系統
4. 依序處理每個補卡申請
5. 生成詳細的執行日誌
6. 儲存重要步驟的截圖
npm run start          # 編譯並執行主程式
npm run dev            # 使用 ts-node 直接執行
npm run clean          # 清理編譯產物
```

### 測試指令
```bash
npm run phase1         # 執行第一階段登入測試 (編譯版)
npm run phase1-ts      # 執行第一階段登入測試 (ts-node)
npm run test-minimal   # 基礎功能測試
```

## 🏗️ 技術架構

### 核心技術
- **TypeScript**: 型別安全的程式開發
- **Puppeteer**: 瀏覽器自動化操作
- **Node.js**: 執行環境

### 設計原則
- **SOLID 原則**: 模組化設計，職責分離
- **錯誤處理**: 完整的錯誤捕獲和恢復機制
- **日誌記錄**: 詳細的執行日誌和除錯資訊
- **配置分離**: 程式碼與配置完全分離

### 服務架構
```
MainService (主協調服務)
├── LogService (日誌服務)
## 🐛 故障排除

### 常見問題

**Q: 程式無法啟動**
```bash
# 檢查 Node.js 版本
node --version  # 應該 >= v16

# 重新安裝相依套件
rm -rf node_modules package-lock.json
npm install
```

**Q: Chrome 找不到**
```bash
# macOS 確認 Chrome 安裝路徑
ls "/Applications/Google Chrome.app"

# 如果路徑不對，請重新安裝 Chrome
```

**Q: 配置檔案錯誤**
- 確認 `data/user-info.txt` 檔案存在
- 檢查檔案格式是否正確
- 確認日期格式為 `YYYY/MM/DD`

**Q: 登入失敗**
- 檢查帳號密碼是否正確
- 確認公司代碼無誤
- 檢查網路連線狀態

## 📝 日誌說明

程式會在 `logs/` 目錄下生成詳細日誌：
- 環境檢查結果
- 登入過程記錄
- 補卡申請狀態
- 錯誤和警告訊息

## 🔒 安全說明

- 所有資料皆在本地處理，不會上傳到外部伺服器
- 建議定期更改密碼並更新配置檔案
- 請勿在公共環境執行此程式

## 📄 授權條款

本專案採用 MIT 授權條款。

## 🤝 貢獻指南

歡迎提交 Issue 或 Pull Request 來改善這個專案！

## 📞 技術支援

如果遇到問題，請：
1. 檢查本文件的故障排除章節
2. 查看 `logs/` 目錄下的詳細日誌
3. 在 GitHub 上提交 Issue

---

⚠️ **免責聲明**：本工具僅供學習和自動化工作流程使用。使用者需自行承擔使用風險，並確保符合公司相關政策。
**解決**:
```bash
# 重新安裝 Chrome for Puppeteer
npx puppeteer browsers install chrome
```

### 除錯模式
程式執行時會自動：
- 在 `logs/` 目錄產生詳細日誌
- 在 `screenshots/` 目錄儲存關鍵步驟截圖
- 在終端顯示即時執行狀態

## 🛠️ 開發者資訊

### 程式碼風格
- 使用 TypeScript 嚴格模式
- 遵循 ESLint 規範
- 詳細的 JSDoc 註釋

### 貢獻指南
1. Fork 專案
2. 建立功能分支
3. 提交變更
4. 發送 Pull Request

### 版本資訊
- **v1.0.0**: 第一階段登入功能完成

## 📞 支援

如有問題或建議，請：
1. 查看 `PROJECT_STATUS.md` 了解詳細狀態
2. 檢查 `logs/` 目錄的錯誤日誌
3. 參考 `TECHNICAL_SPEC.md` 技術規格

---

**注意**: 本程式僅供學習和自動化辦公使用。請確保遵守公司政策和相關法規。

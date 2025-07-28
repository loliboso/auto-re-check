# 🗂️ 專案結構說明

## 📂 當前專案結構

```
auto-re-check/
├── 📄 README.md                    # 主要說明文件
├── 📄 package.json                 # NPM 配置檔案
├── 📄 tsconfig.json               # TypeScript 配置
├── 📄 .gitignore                  # Git 忽略檔案設定
│
├── 📁 src/                        # 📍 原始碼資料夾
│   └── integrated-main-v2.ts     # 🎯 主程式檔案（唯一）
│
├── 📁 data/                       # 📍 用戶配置資料夾
│   ├── user-info.txt             # 🔐 用戶登入資訊和補卡日期
│   └── user-info.txt.example     # 📝 配置檔案範例
│
├── 📁 dist/                       # 📍 編譯輸出資料夾
│   └── integrated-main-v2.js     # 🚀 編譯後的主程式
│
├── 📁 logs/                       # 📍 執行日誌資料夾
│   └── integrated-v2-*.log       # 📋 程式執行記錄
│
├── 📁 screenshots/                # 📍 截圖記錄資料夾
│   └── *.png                     # 📸 程式執行過程截圖
│
└── 📁 archive/                    # 📍 舊檔案封存資料夾
    ├── PRD.md                     # 📋 產品需求文件
    ├── TECHNICAL_SPEC.md          # 🔧 技術規格文件
    ├── COMPLETION_REPORT.md       # ✅ 完成報告
    ├── PROJECT_STATUS.md          # 📊 專案狀態文件
    ├── .env.example              # 🔧 環境變數範例
    ├── attendance-records-example.txt  # 📝 補卡記錄範例
    ├── user-info-example.txt     # 📝 用戶資訊範例
    └── src-development/           # 💾 開發過程檔案
        ├── integrated-main.ts     # 舊版整合程式
        ├── main.ts               # 原始主程式
        ├── phase1-login-fixed.ts # 第一階段登入測試
        ├── phase2-attendance.ts  # 第二階段補卡測試
        ├── config/               # 舊版配置模組
        ├── services/             # 舊版服務模組
        ├── types/                # 舊版型別定義
        ├── utils/                # 舊版工具函數
        ├── validators/           # 舊版驗證模組
        └── test-*.* 檔案         # 各種測試和診斷檔案
```

## 🚀 可用指令

```bash
# 🏗️ 建置程式
npm run build

# ▶️ 執行自動補卡程式
npm start

# 🧹 清理建置檔案
npm run clean

# 🔧 開發模式執行（直接執行 TypeScript）
npm run dev

# 🎯 快速補卡（別名，等同於 npm start）
npm run auto-punch
```

## 📝 檔案功能說明

### 🎯 核心檔案
- **`src/integrated-main-v2.ts`** - 唯一的主程式檔案，包含完整的自動補卡邏輯
- **`data/user-info.txt`** - 用戶需要編輯的配置檔案

### 📊 輸出檔案
- **`logs/`** - 每次執行會生成時間戳記的日誌檔案
- **`screenshots/`** - 程式執行過程的截圖記錄
- **`dist/`** - TypeScript 編譯後的 JavaScript 檔案

### 📚 參考資料
- **`archive/`** - 開發過程中的所有舊檔案，供參考使用

## 🔄 架構演進歷程

1. **🏗️ 模組化架構時期** - 分離的 config、services、types 資料夾
2. **🧪 階段性開發時期** - phase1、phase2 分別開發測試
3. **🔀 整合版本時期** - integrated-main.ts 合併功能
4. **✨ 最終簡化時期** - integrated-main-v2.ts 單一檔案架構

## 💡 設計理念

**極簡主義**：一個檔案包含所有功能，避免複雜的模組依賴
**自包含性**：程式不依賴外部配置檔案或服務模組
**可維護性**：單一檔案便於理解、修改和維護
**穩定性**：減少檔案依賴，降低環境問題發生機率

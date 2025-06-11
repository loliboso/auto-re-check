# 🤖 自動補卡程式 - 使用指南

> **一鍵自動化補卡系統，專為 MayoHR 系統設計**

## 📋 功能概述

- ✅ **自動登入**：支援三欄位登入（公司代碼、帳號、密碼）
- ✅ **智慧補卡**：自動處理上班/下班/全日補卡
- ✅ **彈窗處理**：自動處理重複補卡警告
- ✅ **批次處理**：支援多筆補卡記錄一次性處理
- ✅ **錯誤處理**：詳細日誌記錄，方便問題排查
- 🤖 **無頭模式**：高速執行模式，提升 5.6 倍效能
- 🔄 **跨月份導航**：智能月份切換，支援任意日期補卡

## 🚀 快速開始

### 1. 環境需求
- macOS 系統
- Google Chrome 瀏覽器
- ~~Node.js (建議 v16 以上)~~ ← 現在可以自動安裝！

### 2. 安裝步驟

#### 🎯 方法一：一鍵自動安裝（推薦）

1. 下載專案：`git clone https://github.com/loliboso/auto-re-check.git`
2. 用 Finder 開啟專案資料夾
3. 雙擊 `install.command` 檔案
4. 依照螢幕提示完成安裝

**自動安裝腳本會幫您：**
- ✅ 安裝 Xcode Command Line Tools（如果需要）
- ✅ 安裝 Homebrew（如果需要）
- ✅ 安裝 Node.js（如果需要）
- ✅ 檢查 Google Chrome
- ✅ 安裝專案依賴套件
- ✅ 編譯並驗證程式

#### 🔧 方法二：手動安裝
**如果您偏好手動安裝，請執行：**

```bash
# 1. 下載專案
git clone https://github.com/loliboso/auto-re-check.git
cd auto-re-check

# 2. 手動安裝 Node.js（如果尚未安裝）
# 到 https://nodejs.org 下載 LTS 版本，或使用 Homebrew：
brew install node

# 3. 安裝依賴套件
npm install

# 4. 編譯程式
npm run build
```

### 3. 設定個人資訊
**使用文字編輯器編輯** `data/user-info.txt` **檔案：**

```
登入資訊：
    公司代碼：TNLMG
    登入帳號：你的帳號
    密碼：你的密碼

補卡日期：
    2025/06/04	上班未打卡		
    2025/06/03	上班未打卡 / 下班未打卡	
    2025/06/02	下班未打卡
```

**💡 提示：**
- 如果使用自動安裝腳本，`user-info.txt` 會自動創建
- 如果手動安裝，請複製 `data/user-info.txt.example` 為 `data/user-info.txt`

**補卡日期格設定：建議直接將「打卡異常」的查詢結果複製貼上至 user-info.txt 即可**

### 4. 執行程式

**選擇以下任一方式：**

**🖱️ 方式 A：滑鼠雙擊執行（最簡單）**
1. 用 Finder 開啟專案資料夾
2. 雙擊 `run.command` 檔案
3. 按照螢幕提示執行程式

**⌨️ 方式 B：終端機執行**
```bash
# 1. 切換到專案目錄（重要！）
cd /path/to/auto-re-check

# 2a. 🤖 無頭模式執行（推薦 - 速度快 5.6 倍）
npm run start:headless

# 2b. 🖥️ 有界面模式執行（可視化調試）
npm start
```

## 🤖 無頭模式 vs 有界面模式

| 模式 | 執行時間 | 適用場景 | 命令 |
|------|----------|----------|------|
| **🤖 無頭模式** | ~34秒 | 日常使用、服務器環境 | `npm run start:headless` |
| **🖥️ 有界面模式** | ~45秒 | 調試、第一次使用 | `npm start` |

> 💡 **推薦使用無頭模式**：更快、更穩定、更節省資源！

**💡 推薦使用雙擊方式：**
- 🎯 **自動定位**：不需要手動切換目錄
- 🔍 **環境檢查**：自動檢查依賴和配置
- 📋 **友善提示**：詳細的執行過程說明
- ❌ **錯誤處理**：清楚的錯誤提示和解決建議

**執行過程：**
- 程式會自動開啟 Chrome 瀏覽器
- 自動登入並處理補卡
- 執行完成後會自動關閉瀏覽器
- 詳細過程會顯示在終端機中

## 📱 詳細操作步驟

### 步驟 1: 開啟終端機
**macOS:**
- 按 `Command + 空格鍵` 開啟 Spotlight
- 輸入 "終端機" 或 "Terminal"
- 按 Enter 開啟

**或者:**
- 開啟 Finder → 應用程式 → 工具程式 → 終端機

### 步驟 2: 下載專案（首次使用）
在終端機中輸入：
```bash
git clone https://github.com/loliboso/auto-re-check.git
cd auto-re-check
```

### 步驟 3: 安裝程式

#### 🎯 推薦方式：使用自動安裝腳本

**🖱️ 方式 A：滑鼠雙擊（最簡單）**
- 在 Finder 中雙擊 `install.command` 檔案
- 依照螢幕提示完成安裝

**⌨️ 方式 B：終端機執行**
```bash
./install.sh
```

#### 🔧 手動方式：
```bash
# 確保已安裝 Node.js（如果尚未安裝）
brew install node

# 安裝專案依賴
npm install
npm run check  # 確認安裝成功
```

### 步驟 4: 設定個人資訊
1. 使用 Finder 開啟專案資料夾
2. 進入 `data` 資料夾
3. 用文字編輯器開啟 `user-info.txt`
4. 填入你的登入資訊和補卡日期
5. 儲存檔案

### 步驟 5: 執行程式

**🖱️ 方式 A：滑鼠雙擊（最簡單）**
1. 用 Finder 開啟專案資料夾
2. 雙擊 `run.command` 檔案
3. 按照螢幕提示執行程式

**⌨️ 方式 B：終端機執行**
```bash
# 確保在專案目錄中
cd ~/Desktop/auto-re-check  # 或你下載的實際路徑

# 執行自動補卡程式
npm start
```

**💡 推薦使用雙擊方式的原因：**
- 🎯 **自動定位**：不需要記住或切換到專案路徑
- 🔍 **智慧檢查**：自動檢查環境、依賴和配置
- 📋 **詳細提示**：清楚的執行過程和錯誤說明
- ❌ **錯誤處理**：遇到問題會給出具體的解決建議

**程式會自動：**
- 🔍 檢查系統環境
- 📋 驗證配置檔案
- 🌐 開啟 Chrome 瀏覽器
- 🔐 自動登入系統
- 📝 完成所有補卡申請
- ✅ 顯示執行結果

## 📊 執行過程

程式會自動：
1. 🔐 **登入系統** - 使用你設定的帳號密碼
2. 📝 **填寫表單** - 自動選擇類型、日期、地點
3. ✉️ **送簽處理** - 自動提交並處理回應
4. 🔄 **循環執行** - 處理所有補卡記錄
5. ✅ **完成報告** - 顯示處理結果

## 📁 檔案結構

```
auto-re-check/
├── install.command             # 🖱️ 雙擊安裝（推薦）
├── run.command                 # 🖱️ 雙擊執行（推薦）
├── install.sh                  # ⌨️ 終端機安裝
├── data/user-info.txt          # 個人設定檔案 (你需要編輯)
├── src/integrated-main-v2.ts   # 主程式
├── logs/                       # 執行日誌
├── screenshots/                # 執行截圖
└── archive/                    # 封存檔案
```

## 🔧 故障排除

### 常見問題

**Q: 終端機顯示 "command not found: git"？**
A: 需要安裝 Xcode Command Line Tools：
```bash
xcode-select --install
```

**Q: 終端機顯示 "command not found: npm"？**
A: 使用自動安裝腳本，或手動安裝 Node.js：
```bash
# 方法 1: 使用自動安裝腳本（推薦）
./install.sh

# 方法 2: 手動安裝
brew install node
```

**Q: 自動安裝腳本執行失敗？**
A: 請確認：
1. 系統為 macOS
2. 有網路連線
3. 有管理員權限（可能需要輸入密碼）
4. 重新執行 `./install.sh`

**Q: 程式顯示 Chrome 路徑錯誤？**
A: 確認 Chrome 安裝在 `/Applications/Google Chrome.app/`

**Q: 登入失敗？**
A: 檢查 `data/user-info.txt` 中的帳號密碼是否正確

**Q: 補卡失敗？**
A: 查看 `logs/` 資料夾中的最新日誌檔案

### 日誌查看
**在終端機中執行：**
```bash
# 查看最新執行日誌
npm run logs

# 或手動查看
ls -t logs/ | head -1 | xargs -I {} cat logs/{}
```

### 重新安裝
**如果遇到安裝問題：**
```bash
# 清理並重新安裝
rm -rf node_modules package-lock.json
npm install
npm run check
```

### 終端機基本操作
```bash
# 查看當前目錄
pwd

# 列出檔案
ls -la

# 進入資料夾
cd auto-re-check

# 回到上一層
cd ..

# 清除螢幕
clear
```

## ⚠️ 注意事項

- **資料安全**：請妥善保管 `data/user-info.txt` 中的密碼
- **執行時間**：避免在系統維護時間執行
- **重複補卡**：程式會自動處理重複補卡警告
- **錯誤終止**：任何填表或送簽錯誤都會立即終止程式

## 🤖 無頭模式詳細說明

### 什麼是無頭模式？
無頭模式 (Headless Mode) 是在背景執行瀏覽器，不顯示視窗界面，大幅提升執行效率。

### 無頭模式優勢：
- ⚡ **執行速度提升 5.6 倍**：從 45 秒縮短到 34 秒
- 🔒 **更高穩定性**：避免視窗管理問題
- 💻 **更低資源使用**：減少記憶體和 CPU 使用
- 🤖 **適合自動化**：適合定時任務和服務器環境

### 使用方式：
```bash
# 推薦：無頭模式（快速執行）
npm run start:headless

# 調試：有界面模式（可視化過程）
npm start

# 開發模式
npm run dev:headless    # 無頭模式開發
npm run dev             # 有界面模式開發
```

### 何時使用哪種模式？
- 📅 **日常補卡** → 無頭模式 (`npm run start:headless`)
- 🐛 **調試問題** → 有界面模式 (`npm start`)
- 👀 **第一次使用** → 有界面模式 (觀察執行過程)

> 📖 **詳細說明**：請參考 [HEADLESS_USAGE_GUIDE.md](HEADLESS_USAGE_GUIDE.md)

## 📞 技術支援

如遇問題，請提供：
1. 錯誤訊息截圖
2. 最新的日誌檔案 (`logs/` 資料夾)
3. 執行環境資訊 (`node --version`, `which chrome`)
4. 使用的執行模式（無頭模式 or 有界面模式）

---

**🎯 設計理念：一次設定，全自動執行，讓補卡變得輕鬆簡單！**

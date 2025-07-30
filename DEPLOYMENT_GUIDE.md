# 🚀 Railway 部署指南

## 📋 部署步驟

### 1. 準備 Railway 帳號
1. 前往 [Railway.app](https://railway.app)
2. 使用 GitHub 帳號登入
3. 建立新專案

### 2. 連接 GitHub 倉庫
1. 在 Railway 中選擇 "Deploy from GitHub repo"
2. 選擇您的 `auto-re-check-web` 倉庫
3. 選擇 main 分支

### 3. 自動部署
Railway 會自動：
- 檢測到 `railway.json` 配置
- 使用 Dockerfile 建立容器
- 安裝依賴並編譯程式
- 啟動服務

### 4. 取得網址
部署完成後，Railway 會提供：
- 預設網址：`https://your-project-name.railway.app`
- 自訂網域（可選）

## 🔧 環境變數

目前不需要額外的環境變數，所有配置都在程式碼中。

## 📊 監控

Railway 提供：
- 即時日誌查看
- 資源使用監控
- 自動重啟功能

## 💰 成本

- **免費方案**：每月 500 小時
- **您的使用量**：3人 × 2次/月 × 1分鐘 = 6分鐘/月
- **結論**：完全免費！

## 🛠️ 故障排除

### 如果部署失敗
1. 檢查 Railway 日誌
2. 確認 Dockerfile 正確
3. 確認所有依賴都已安裝

### 如果服務無法啟動
1. 檢查端口設定
2. 確認 Chromium 安裝
3. 查看錯誤日誌

## 🎯 下一步

部署完成後：
1. 測試網頁界面
2. 讓同事試用
3. 監控使用情況
4. 根據需要調整

---

**🎉 恭喜！您的雲端自動補卡服務已經準備就緒！** 
# 🚀 Render 部署指南

## ✅ 已完成的準備工作

1. ✅ `src/web-service.ts` - Web 服務（整合完整補卡邏輯）
2. ✅ `render.yaml` - Render 配置檔案
3. ✅ `package.json` - 已包含 `start:web` 腳本

## 📋 部署步驟

### 1. 提交到 GitHub

```bash
git add .
git commit -m "Add Render deployment with integrated punch card logic"
git push
```

### 2. 在 Render 建立服務

1. 登入 [Render Dashboard](https://dashboard.render.com/)
2. 點擊 **New +** → **Web Service**
3. 選擇你的 `auto-re-check-web` repository
4. Render 會自動偵測 `render.yaml` 配置

### 3. 確認配置

Render 會顯示：
- **Name**: auto-recheck
- **Environment**: Node
- **Region**: Singapore
- **Build Command**: `npm install && npm run build:web`
- **Start Command**: `npm run start:web`

### 4. 點擊 Deploy

部署時間約 5-10 分鐘

## 🌐 部署後

部署完成後，你會得到一個網址：
```
https://auto-recheck.onrender.com
```

## 🧪 本地測試

部署前可以先本地測試：

```bash
# 方式 1: 使用測試腳本
./test-web-service.sh

# 方式 2: 直接執行
npm run start:web
```

然後開啟 http://localhost:3000

## ⚠️ 注意事項

1. **休眠機制**: 15 分鐘無活動會休眠，下次訪問需 30 秒喚醒
2. **Chromium**: Render 會自動安裝，無需額外配置
3. **環境變數**: 已在 `render.yaml` 中設定好

## 🔍 監控與除錯

在 Render Dashboard 可以：
- 查看部署日誌
- 監控服務狀態
- 查看錯誤訊息

## 📊 與 Railway 比較

| 項目 | Render | Railway |
|------|--------|---------|
| 休眠 | 15 分鐘 | 不休眠 |
| 喚醒時間 | ~30 秒 | N/A |
| 配置難度 | 簡單 | 簡單 |
| Puppeteer 支援 | ✅ 原生 | ✅ 原生 |

兩者都適合，選擇你喜歡的即可！

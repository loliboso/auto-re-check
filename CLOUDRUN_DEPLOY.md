# Google Cloud Run 部署指南

## 前置準備

### 1. 安裝 Google Cloud SDK

```bash
# macOS 使用 Homebrew 安裝
brew install --cask google-cloud-sdk

# 或下載安裝包
# https://cloud.google.com/sdk/docs/install
```

### 2. 初始化 gcloud

```bash
# 登入 Google Cloud
gcloud auth login

# 設定專案
gcloud config set project auto-recheck

# 啟用必要的 API
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## 部署步驟

### 方法一：使用部署腳本（推薦）

```bash
./deploy-cloudrun.sh
```

### 方法二：手動部署

```bash
# 1. 構建 Docker 映像
gcloud builds submit --tag gcr.io/auto-recheck/auto-recheck-service

# 2. 部署到 Cloud Run
gcloud run deploy auto-recheck-service \
  --image gcr.io/auto-recheck/auto-recheck-service \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 540 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"
```

## 部署後

部署完成後會顯示服務 URL，例如：
```
https://auto-recheck-service-xxxxx-de.a.run.app
```

## 更新前端 API 地址

修改 `functions/frontend.html` 中的 API_BASE：

```javascript
const API_BASE = 'https://your-cloudrun-url.run.app';
```

## 優勢

✅ 比 Firebase Functions 快 3-5 倍
✅ 更適合 Puppeteer 運行
✅ 更穩定的 Chromium 支援
✅ 更好的資源控制
✅ 冷啟動時間更短

## 成本估算

- 免費額度：每月 200 萬次請求
- 記憶體：4GB
- CPU：2 核心
- 超時：540 秒

預估每月成本：$5-20（取決於使用量）

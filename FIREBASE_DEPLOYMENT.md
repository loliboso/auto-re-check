# Firebase 部署指南

## 前置準備

### 1. 安裝 Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. 登入 Firebase
```bash
firebase login
```

### 3. 初始化 Firebase 專案
```bash
# 如果還沒有 Firebase 專案，先在 Firebase Console 創建
# https://console.firebase.google.com/

# 連結本地專案到 Firebase
firebase use --add
# 選擇你的專案，並設定別名為 'default'
```

### 4. 更新專案 ID
編輯 `.firebaserc` 文件，將 `your-project-id` 替換為你的實際專案 ID：
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

## 部署步驟

### 1. 安裝依賴
```bash
npm install
```

### 2. 編譯 TypeScript
```bash
npm run build:web
```

### 3. 部署到 Firebase
```bash
npm run deploy
```

或直接使用：
```bash
firebase deploy --only functions
```

## 本地測試

使用 Firebase Emulator 在本地測試：
```bash
npm run firebase:serve
```

API 將運行在：`http://localhost:5001/your-project-id/us-central1/api`

## API 端點

部署後，你的 API 將可在以下 URL 訪問：
```
https://us-central1-your-project-id.cloudfunctions.net/api
```

### 可用端點：

**1. 健康檢查**
```bash
GET /
```

**2. 執行補卡**
```bash
POST /api/punch
Content-Type: application/json

{
  "companyCode": "TNLMG",
  "employeeNo": "你的帳號",
  "password": "你的密碼",
  "records": [
    {
      "date": "2025/06/04",
      "type": "上班未打卡"
    },
    {
      "date": "2025/06/03",
      "type": "上班未打卡 / 下班未打卡"
    }
  ]
}
```

**3. 批次補卡**
```bash
POST /api/batch-punch
Content-Type: application/json

{
  "companyCode": "TNLMG",
  "employeeNo": "你的帳號",
  "password": "你的密碼",
  "records": [...]
}
```

## 重要配置

### Firebase Functions 配置
- **Timeout**: 540 秒（9 分鐘）
- **Memory**: 2GB
- **Runtime**: Node.js 20

### 環境變量（可選）
如需設定環境變量：
```bash
firebase functions:config:set someservice.key="THE API KEY"
```

## 監控與日誌

### 查看日誌
```bash
firebase functions:log
```

### 在 Firebase Console 查看
訪問：https://console.firebase.google.com/project/your-project-id/functions

## 成本估算

Firebase Functions 免費額度：
- 每月 200 萬次調用
- 每月 40 萬 GB-秒
- 每月 20 萬 CPU-秒

超過免費額度後按使用量計費。

## 故障排除

### 1. Puppeteer 在 Firebase 上運行問題
Firebase Functions 已包含 Chrome，但如遇問題可添加：
```javascript
executablePath: '/usr/bin/google-chrome-stable'
```

### 2. 超時問題
如果執行時間超過 540 秒，考慮：
- 優化補卡邏輯
- 分批處理記錄
- 使用 Cloud Run 替代（最長 60 分鐘）

### 3. 記憶體不足
增加 Functions 記憶體配置到 4GB 或 8GB。

## 升級到 Cloud Run（可選）

如需更長執行時間或更多資源：
```bash
# 部署到 Cloud Run
gcloud run deploy auto-punch-service \
  --source . \
  --platform managed \
  --region asia-east1 \
  --memory 2Gi \
  --timeout 3600
```

## 安全建議

1. **不要在代碼中硬編碼密碼**
2. **使用 Firebase Functions Config 或 Secret Manager**
3. **添加 API 認證機制**
4. **限制 CORS 來源**
5. **監控異常調用**

# Firebase 部署快速指南

## 🚀 快速開始

### 1. 安裝 Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. 登入並初始化
```bash
# 登入
firebase login

# 初始化專案（選擇你的 Firebase 專案）
firebase use --add
```

### 3. 更新專案 ID
編輯 `.firebaserc`，將 `your-project-id` 改為你的實際專案 ID

### 4. 部署
```bash
# 方式 1: 使用快速腳本
./deploy-firebase.sh

# 方式 2: 使用 npm 命令
npm run deploy

# 方式 3: 直接使用 Firebase CLI
npm run build:web && firebase deploy --only functions
```

## 📡 API 使用

部署後的 API 端點：
```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
```

### 補卡 API
```bash
curl -X POST https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api/punch \
  -H "Content-Type: application/json" \
  -d '{
    "companyCode": "TNLMG",
    "employeeNo": "你的帳號",
    "password": "你的密碼",
    "records": [
      {"date": "2025/06/04", "type": "上班未打卡"}
    ]
  }'
```

## 🔧 本地測試

```bash
# 啟動 Firebase Emulator
npm run firebase:serve

# API 將運行在
# http://localhost:5001/YOUR-PROJECT-ID/us-central1/api
```

## 📊 監控

```bash
# 查看日誌
firebase functions:log

# 或在 Firebase Console
# https://console.firebase.google.com/project/YOUR-PROJECT-ID/functions
```

## 💰 成本

Firebase Functions 免費額度：
- 每月 200 萬次調用
- 每月 40 萬 GB-秒

通常足夠個人使用。

## ⚠️ 注意事項

1. **不要提交 `.firebaserc` 到公開倉庫**（如果包含敏感資訊）
2. **不要在請求中明文傳輸密碼**（考慮使用 HTTPS + 加密）
3. **設置適當的 CORS 策略**
4. **監控使用量避免超額**

詳細文檔請參考：[FIREBASE_DEPLOYMENT.md](./FIREBASE_DEPLOYMENT.md)

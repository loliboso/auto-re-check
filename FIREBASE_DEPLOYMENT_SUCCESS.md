# 🎉 Firebase Functions 部署成功！

## ✅ 部署資訊

- **專案 ID**: auto-recheck
- **Function 名稱**: api
- **區域**: asia-east1
- **運行環境**: Node.js 20
- **記憶體**: 2GB
- **超時時間**: 540 秒

## 🌐 API 端點

**基礎 URL**: `https://asia-east1-auto-recheck.cloudfunctions.net/api`

### 可用端點：

1. **健康檢查**
   ```bash
   GET https://asia-east1-auto-recheck.cloudfunctions.net/api
   ```
   回應：
   ```json
   {
     "service": "雲端自動補卡服務",
     "status": "running",
     "version": "1.0.0",
     "timestamp": "2025-11-18T09:06:33.704Z"
   }
   ```

2. **測試端點**
   ```bash
   GET https://asia-east1-auto-recheck.cloudfunctions.net/api/test
   ```
   回應：
   ```json
   {
     "message": "Test endpoint works!"
   }
   ```

## 📝 下一步

目前部署的是簡化版本（不含 Puppeteer 自動補卡功能）。

### 要加入完整的自動補卡功能：

1. **更新 functions/index.js**
   - 將 `functions/index-full.js` 的內容複製到 `functions/index.js`
   - 或者從 `src/web-service.ts` 重新編譯完整版本

2. **注意事項**：
   - Puppeteer 會讓建置時間變長（可能 10-20 分鐘）
   - 建議使用 Cloud Run 而非 Cloud Functions（更適合 Puppeteer）
   - 或者考慮使用 puppeteer-core + chrome-aws-lambda

3. **重新部署**：
   ```bash
   firebase deploy --only functions
   ```

## 🔧 管理命令

```bash
# 查看 Function 列表
firebase functions:list

# 查看日誌
firebase functions:log

# 刪除 Function
firebase functions:delete api --region asia-east1

# 重新部署
firebase deploy --only functions
```

## 📊 監控

- **Firebase Console**: https://console.firebase.google.com/project/auto-recheck/functions/list
- **Cloud Console**: https://console.cloud.google.com/functions/list?project=auto-recheck
- **Cloud Build 歷史**: https://console.cloud.google.com/cloud-build/builds?project=auto-recheck

## ⚠️ 重要提醒

1. **權限設定**: 已設定為公開存取（allUsers），如需限制請修改 IAM 權限
2. **費用**: Blaze 方案按用量計費，請注意免費額度
3. **Puppeteer**: 目前版本不含 Puppeteer，如需完整功能請參考上方說明

## 🎯 測試

```bash
# 測試 API
curl https://asia-east1-auto-recheck.cloudfunctions.net/api

# 測試端點
curl https://asia-east1-auto-recheck.cloudfunctions.net/api/test
```

---

**部署完成時間**: 2025-11-18
**狀態**: ✅ 運行中

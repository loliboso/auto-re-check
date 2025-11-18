# 🤖 Firebase 部署 Puppeteer 的方案比較

## 📊 方案總覽

| 方案 | 套件大小 | 建置時間 | 穩定性 | 管理平台 | 推薦度 |
|------|---------|---------|--------|---------|--------|
| **1. puppeteer-core + @sparticuz/chromium** | ~50MB | 3-5分鐘 | ⭐⭐⭐⭐⭐ | Firebase Console | ⭐⭐⭐⭐⭐ |
| **2. Firebase Hosting + Cloud Run** | 任意 | 5-8分鐘 | ⭐⭐⭐⭐⭐ | Firebase Console | ⭐⭐⭐⭐ |
| **3. 完整 Puppeteer (2nd Gen)** | ~300MB | 15-25分鐘 | ⭐⭐⭐ | Firebase Console | ⭐⭐ |

---

## 🎯 方案 1：puppeteer-core + @sparticuz/chromium（推薦）

### ✅ 優點
- **套件小**：~50MB vs 完整 Puppeteer 的 ~300MB
- **建置快**：3-5 分鐘
- **專為 Serverless 優化**：@sparticuz/chromium 是專門為 AWS Lambda/Cloud Functions 設計的
- **完全在 Firebase 管理**：使用 Firebase Console
- **成本低**：符合 Cloud Functions 的限制

### 📦 安裝
\`\`\`bash
cd functions
npm install puppeteer-core @sparticuz/chromium
\`\`\`

### 🚀 部署
\`\`\`bash
firebase deploy --only functions
\`\`\`

### 💡 使用方式
已經在 \`functions/index.js\` 中實作好了，直接部署即可。

### ⚠️ 注意事項
- 需要 4GB 記憶體（已在配置中設定）
- @sparticuz/chromium 會自動下載優化過的 Chromium

---

## 🎯 方案 2：Firebase Hosting + Cloud Run

### ✅ 優點
- **完全在 Firebase 管理**：透過 Firebase Console 統一管理
- **更靈活**：可以使用完整的 Puppeteer
- **更穩定**：Cloud Run 專為容器化應用設計
- **自動擴展**：更好的效能和擴展性

### 📦 設定步驟

1. **安裝 Firebase Hosting**
\`\`\`bash
firebase init hosting
\`\`\`

2. **創建 Cloud Run 服務**（透過 Firebase）
\`\`\`bash
# 創建 Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    chromium \\
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg \\
    --no-install-recommends \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080
CMD ["node", "dist/web-service.js"]
EOF

# 部署到 Cloud Run（會自動連結到 Firebase）
gcloud run deploy auto-recheck-api \\
  --source . \\
  --region asia-east1 \\
  --allow-unauthenticated \\
  --project auto-recheck
\`\`\`

3. **在 Firebase Hosting 設定 Rewrite**
\`\`\`json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "auto-recheck-api",
          "region": "asia-east1"
        }
      }
    ]
  }
}
\`\`\`

4. **部署**
\`\`\`bash
firebase deploy
\`\`\`

### 🌐 存取方式
- 透過 Firebase Hosting：\`https://auto-recheck.web.app/api\`
- 直接存取 Cloud Run：\`https://auto-recheck-api-xxx.run.app\`
- **統一在 Firebase Console 管理**

---

## 🎯 方案 3：完整 Puppeteer (2nd Gen Functions)

### ⚠️ 不推薦原因
- 建置時間太長（15-25 分鐘）
- 容易超時
- 套件太大（~300MB）
- 冷啟動慢

### 如果堅持使用
\`\`\`json
// functions/package.json
{
  "dependencies": {
    "puppeteer": "^21.11.0"
  }
}
\`\`\`

\`\`\`javascript
// functions/index.js
exports.api = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '8GB', // 需要更多記憶體
    maxInstances: 5
  })
  .https.onRequest(app);
\`\`\`

---

## 🎖️ 最終推薦

### 🥇 首選：方案 1（puppeteer-core + @sparticuz/chromium）
**適合：**
- 想要快速部署
- 預算有限
- 流量不大（< 10萬次/月）
- 想要簡單管理

**執行：**
\`\`\`bash
# 已經設定好了，直接部署
firebase deploy --only functions
\`\`\`

### 🥈 次選：方案 2（Firebase Hosting + Cloud Run）
**適合：**
- 需要更高效能
- 流量較大
- 需要更複雜的功能
- 想要更好的擴展性

**優勢：**
- 仍然在 Firebase Console 統一管理
- 可以使用 Firebase Hosting 的 CDN
- 更穩定可靠

---

## 💰 成本比較（每月）

### 方案 1：Cloud Functions
- 免費額度：200萬次調用
- 超過後：$0.40 / 百萬次
- 記憶體：$0.0000025 / GB-秒

### 方案 2：Cloud Run
- 免費額度：200萬次請求
- 超過後：$0.40 / 百萬次
- 記憶體：$0.0000024 / GB-秒

**結論：成本幾乎相同，都很便宜！**

---

## 🚀 立即開始

### 使用方案 1（推薦）
\`\`\`bash
# 1. 確認 functions/package.json 已更新
cat functions/package.json

# 2. 安裝依賴
cd functions && npm install && cd ..

# 3. 部署
firebase deploy --only functions

# 4. 測試
curl https://asia-east1-auto-recheck.cloudfunctions.net/api
\`\`\`

### 使用方案 2
請參考上方的詳細步驟，或告訴我，我可以幫你設定！

---

## 📞 需要協助？

選擇你想要的方案，我可以立即幫你部署！

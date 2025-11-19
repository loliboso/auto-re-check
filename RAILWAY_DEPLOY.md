# Railway 部署指南

## 快速部署步驟

### 1. 登入 Railway
```bash
railway login
```
瀏覽器會自動開啟，完成登入

### 2. 連結專案（如果已有專案）
```bash
railway link
```
選擇你的專案

### 3. 部署
```bash
railway up
```

---

## 或者使用 Railway Web 界面部署

### 方法 A：從 GitHub 部署（推薦）

1. 訪問 https://railway.app
2. 點擊 "New Project"
3. 選擇 "Deploy from GitHub repo"
4. 選擇你的 repository
5. Railway 會自動檢測 Dockerfile 並部署

### 方法 B：從本地部署

1. 在終端執行：
```bash
railway login
railway init
railway up
```

---

## 環境變數設定

在 Railway 專案設定中添加：
```
NODE_ENV=production
PORT=3000
```

---

## 優勢

✅ 實例持續運行（無冷啟動）
✅ 速度快（與本機 headless 模式相同）
✅ 自動 HTTPS
✅ 簡單的部署流程
✅ 免費額度：$5/月

---

## 當前配置

- Dockerfile: `Dockerfile` (node:18-alpine)
- Port: 3000
- 自動從 GitHub 部署

---

## 部署後

服務會自動獲得一個 URL，例如：
```
https://auto-recheck-production.up.railway.app
```

記得更新前端的 API_BASE 地址！

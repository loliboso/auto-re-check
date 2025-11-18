# 🚀 雲端自動補卡 API 使用指南

## 📍 API 端點

**基礎 URL**: `https://asia-east1-auto-recheck.cloudfunctions.net/api`

## 🔧 API 端點說明

### 1. 健康檢查

檢查服務是否正常運行。

**請求：**
```bash
GET https://asia-east1-auto-recheck.cloudfunctions.net/api
```

**回應：**
```json
{
  "service": "雲端自動補卡服務",
  "status": "running",
  "version": "2.0.0",
  "features": ["puppeteer-core", "chromium"],
  "timestamp": "2025-11-18T09:13:30.267Z"
}
```

---

### 2. 提交補卡任務

提交一個新的補卡任務。

**請求：**
```bash
POST https://asia-east1-auto-recheck.cloudfunctions.net/api/submit
Content-Type: application/json

{
  "companyCode": "TNLMG",
  "username": "你的帳號",
  "password": "你的密碼",
  "records": [
    {
      "date": "2025/11/18",
      "type": "上班未打卡"
    },
    {
      "date": "2025/11/17",
      "type": "下班未打卡"
    }
  ]
}
```

**參數說明：**
- `companyCode`: 公司代碼（必填）
- `username`: 登入帳號（必填）
- `password`: 登入密碼（必填）
- `records`: 補卡記錄陣列（必填，至少一筆）
  - `date`: 補卡日期
  - `type`: 補卡類型（上班未打卡/下班未打卡/全日未打卡）

**回應：**
```json
{
  "success": true,
  "taskId": "7ca62b50-081e-4868-b6eb-c98d5624d30e",
  "message": "任務已建立，請使用 taskId 查詢進度"
}
```

**cURL 範例：**
```bash
curl -X POST https://asia-east1-auto-recheck.cloudfunctions.net/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "companyCode": "TNLMG",
    "username": "your_username",
    "password": "your_password",
    "records": [
      {"date": "2025/11/18", "type": "上班未打卡"}
    ]
  }'
```

---

### 3. 查詢任務狀態

使用 taskId 查詢補卡任務的執行狀態。

**請求：**
```bash
GET https://asia-east1-auto-recheck.cloudfunctions.net/api/status/{taskId}
```

**回應（進行中）：**
```json
{
  "success": true,
  "status": "running",
  "message": "正在處理第 1/2 筆補卡...",
  "progress": 45,
  "startTime": "2025-11-18T09:15:30.880Z",
  "lastUpdate": "2025-11-18T09:15:35.123Z"
}
```

**回應（完成）：**
```json
{
  "success": true,
  "status": "completed",
  "message": "補卡完成！",
  "progress": 100,
  "startTime": "2025-11-18T09:15:30.880Z",
  "lastUpdate": "2025-11-18T09:16:15.456Z"
}
```

**回應（失敗）：**
```json
{
  "success": true,
  "status": "failed",
  "message": "錯誤：登入失敗",
  "progress": 0,
  "startTime": "2025-11-18T09:15:30.880Z",
  "lastUpdate": "2025-11-18T09:15:35.789Z"
}
```

**狀態說明：**
- `pending`: 任務已建立，等待處理
- `running`: 任務執行中
- `completed`: 任務完成
- `failed`: 任務失敗

**cURL 範例：**
```bash
curl https://asia-east1-auto-recheck.cloudfunctions.net/api/status/7ca62b50-081e-4868-b6eb-c98d5624d30e
```

---

### 4. 測試端點

簡單的測試端點。

**請求：**
```bash
GET https://asia-east1-auto-recheck.cloudfunctions.net/api/test
```

**回應：**
```json
{
  "message": "Test endpoint works!",
  "version": "2.0.0"
}
```

---

## 💻 使用範例

### JavaScript (Fetch API)

```javascript
// 提交補卡任務
async function submitPunchTask() {
  const response = await fetch('https://asia-east1-auto-recheck.cloudfunctions.net/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyCode: 'TNLMG',
      username: 'your_username',
      password: 'your_password',
      records: [
        { date: '2025/11/18', type: '上班未打卡' },
        { date: '2025/11/17', type: '下班未打卡' }
      ]
    })
  });
  
  const data = await response.json();
  console.log('Task ID:', data.taskId);
  return data.taskId;
}

// 查詢任務狀態
async function checkTaskStatus(taskId) {
  const response = await fetch(
    `https://asia-east1-auto-recheck.cloudfunctions.net/api/status/${taskId}`
  );
  const data = await response.json();
  console.log('Status:', data.status, 'Progress:', data.progress + '%');
  return data;
}

// 完整流程
async function autoPunch() {
  // 1. 提交任務
  const taskId = await submitPunchTask();
  
  // 2. 輪詢狀態
  const checkInterval = setInterval(async () => {
    const status = await checkTaskStatus(taskId);
    
    if (status.status === 'completed') {
      console.log('✅ 補卡完成！');
      clearInterval(checkInterval);
    } else if (status.status === 'failed') {
      console.log('❌ 補卡失敗：', status.message);
      clearInterval(checkInterval);
    }
  }, 3000); // 每 3 秒檢查一次
}

autoPunch();
```

### Python

```python
import requests
import time

API_BASE = 'https://asia-east1-auto-recheck.cloudfunctions.net/api'

def submit_punch_task(company_code, username, password, records):
    """提交補卡任務"""
    response = requests.post(f'{API_BASE}/submit', json={
        'companyCode': company_code,
        'username': username,
        'password': password,
        'records': records
    })
    return response.json()

def check_task_status(task_id):
    """查詢任務狀態"""
    response = requests.get(f'{API_BASE}/status/{task_id}')
    return response.json()

def auto_punch():
    """完整補卡流程"""
    # 1. 提交任務
    result = submit_punch_task(
        company_code='TNLMG',
        username='your_username',
        password='your_password',
        records=[
            {'date': '2025/11/18', 'type': '上班未打卡'},
            {'date': '2025/11/17', 'type': '下班未打卡'}
        ]
    )
    
    task_id = result['taskId']
    print(f'Task ID: {task_id}')
    
    # 2. 輪詢狀態
    while True:
        status = check_task_status(task_id)
        print(f"Status: {status['status']}, Progress: {status['progress']}%")
        
        if status['status'] == 'completed':
            print('✅ 補卡完成！')
            break
        elif status['status'] == 'failed':
            print(f"❌ 補卡失敗：{status['message']}")
            break
        
        time.sleep(3)  # 每 3 秒檢查一次

if __name__ == '__main__':
    auto_punch()
```

---

## 🔒 安全建議

1. **不要在前端直接暴露密碼**
   - 建議建立一個後端服務來調用此 API
   - 或使用環境變數儲存敏感資訊

2. **使用 HTTPS**
   - API 已經使用 HTTPS，確保傳輸安全

3. **限制請求頻率**
   - 避免短時間內大量請求
   - 建議每次查詢狀態間隔至少 2-3 秒

---

## ⚠️ 錯誤處理

### 常見錯誤

**400 Bad Request - 缺少必要參數**
```json
{
  "success": false,
  "error": "缺少必要參數"
}
```

**404 Not Found - 找不到任務**
```json
{
  "success": false,
  "error": "找不到該任務"
}
```

**500 Internal Server Error - 伺服器錯誤**
```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

---

## 📊 技術規格

- **平台**: Firebase Cloud Functions (1st Gen)
- **運行環境**: Node.js 20
- **記憶體**: 4GB
- **超時時間**: 540 秒（9 分鐘）
- **瀏覽器**: Chromium (透過 @sparticuz/chromium)
- **自動化工具**: puppeteer-core

---

## 🎯 效能指標

- **冷啟動時間**: ~3-5 秒
- **平均執行時間**: 30-60 秒（取決於補卡筆數）
- **並發限制**: 10 個實例

---

## 📞 支援

如有問題，請查看：
- Firebase Console: https://console.firebase.google.com/project/auto-recheck/functions/list
- 日誌: `firebase functions:log`

---

**最後更新**: 2025-11-18
**版本**: 2.0.0

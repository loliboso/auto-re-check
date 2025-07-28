// 雲端自動補卡服務 - API 服務範例

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';

const app = express();
const port = process.env.PORT || 3000;

// 中間件
app.use(cors());
ap// 啟動服務
app.listen(port, () => {
  console.log(`🚀 自動補卡服務已啟動在 http://localhost:${port}`);
  console.log(`📱 您的同事只需要開啟網頁就能使用！`);
});

// 清理過期任務（避免記憶體洩漏）
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, status] of taskStatus.entries()) {
    if (status.startTime < oneHourAgo) {
      taskStatus.delete(id);
    }
  }
}, 30 * 60 * 1000); // 每30分鐘清理一次son());
app.use(express.static('public')); // 靜態檔案服務

// 任務狀態追蹤
const taskStatus = new Map();

// 首頁 - 提供網頁界面
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>自動補卡服務</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
                <h1 class="text-2xl font-bold text-center mb-6">🤖 自動補卡服務</h1>
                
                <form id="punchForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">公司代碼</label>
                        <input type="text" name="companyCode" required 
                               class="w-full border rounded px-3 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">帳號</label>
                        <input type="text" name="username" required 
                               class="w-full border rounded px-3 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">密碼</label>
                        <input type="password" name="password" required 
                               class="w-full border rounded px-3 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">補卡日期</label>
                        <input type="date" name="date" required 
                               class="w-full border rounded px-3 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">類型</label>
                        <select name="type" required class="w-full border rounded px-3 py-2">
                            <option value="checkin">上班打卡</option>
                            <option value="checkout">下班打卡</option>
                        </select>
                    </div>
                    
                    <button type="submit" 
                            class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
                        開始自動補卡
                    </button>
                </form>
                
                <div id="status" class="mt-4 p-3 rounded hidden"></div>
            </div>
        </div>

        <script>
            document.getElementById('punchForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                // 顯示處理中狀態
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'mt-4 p-3 rounded bg-blue-100 text-blue-800';
                statusDiv.textContent = '正在處理中，請稍候...';
                statusDiv.classList.remove('hidden');
                
                try {
                    // 送出補卡請求
                    const response = await fetch('/api/punch-card', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        // 輪詢狀態
                        pollStatus(result.requestId);
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    statusDiv.className = 'mt-4 p-3 rounded bg-red-100 text-red-800';
                    statusDiv.textContent = '錯誤：' + error.message;
                }
            });
            
            async function pollStatus(requestId) {
                const statusDiv = document.getElementById('status');
                
                const poll = async () => {
                    try {
                        const response = await fetch(\`/api/status/\${requestId}\`);
                        const status = await response.json();
                        
                        if (status.status === 'completed') {
                            statusDiv.className = 'mt-4 p-3 rounded bg-green-100 text-green-800';
                            statusDiv.textContent = '✅ 補卡完成！' + (status.message || '');
                        } else if (status.status === 'failed') {
                            statusDiv.className = 'mt-4 p-3 rounded bg-red-100 text-red-800';
                            statusDiv.textContent = '❌ 補卡失敗：' + (status.error || '未知錯誤');
                        } else {
                            statusDiv.textContent = '⏳ 正在處理中... ' + (status.progress || '');
                            setTimeout(poll, 2000); // 2秒後再次檢查
                        }
                    } catch (error) {
                        statusDiv.className = 'mt-4 p-3 rounded bg-red-100 text-red-800';
                        statusDiv.textContent = '連線錯誤：' + error.message;
                    }
                };
                
                poll();
            }
        </script>
    </body>
    </html>
  `);
});

// API: 提交補卡請求
app.post('/api/punch-card', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // 驗證請求資料
    const { companyCode, username, password, date, type } = req.body;
    
    if (!companyCode || !username || !password || !date || !type) {
      return res.status(400).json({ error: '請填寫所有必要欄位' });
    }
    
    // 初始化任務狀態
    taskStatus.set(requestId, {
      status: 'processing',
      progress: '正在啟動瀏覽器...',
      startTime: new Date()
    });
    
    // 異步處理補卡任務
    processPunchCard(requestId, req.body);
    
    res.json({ 
      requestId, 
      status: 'queued',
      estimatedTime: '預計 30-60 秒完成'
    });
    
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// API: 查詢任務狀態
app.get('/api/status/:requestId', (req, res) => {
  const status = taskStatus.get(req.params.requestId);
  
  if (!status) {
    return res.status(404).json({ error: '找不到該任務' });
  }
  
  res.json(status);
});

// 處理補卡任務（異步）
async function processPunchCard(requestId, data) {
  const { companyCode, username, password, date, type } = data;
  
  try {
    // 更新狀態
    taskStatus.set(requestId, {
      status: 'processing',
      progress: '正在啟動瀏覽器...'
    });
    
    // 啟動無頭瀏覽器
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    // 更新狀態
    taskStatus.set(requestId, {
      status: 'processing',
      progress: '正在登入系統...'
    });
    
    // 這裡整合您現有的補卡邏輯
    // 可以直接使用 integrated-main-v2.ts 中的邏輯
    
    // 模擬處理過程（實際應該調用您的補卡邏輯）
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 更新最終狀態
    taskStatus.set(requestId, {
      status: 'completed',
      message: `成功完成 ${date} 的${type === 'checkin' ? '上班' : '下班'}補卡`,
      completedTime: new Date()
    });
    
    await browser.close();
    
  } catch (error) {
    console.error('Processing error:', error);
    taskStatus.set(requestId, {
      status: 'failed',
      error: error.message,
      failedTime: new Date()
    });
  }
}

// 啟動服務
app.listen(port, () => {
  console.log(\`🚀 自動補卡服務已啟動在 http://localhost:\${port}\`);
  console.log(\`📱 您的同事只需要開啟網頁就能使用！\`);
});

// 清理過期任務（避免記憶體洩漏）
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, status] of taskStatus.entries()) {
    if (status.startTime < oneHourAgo) {
      taskStatus.delete(id);
    }
  }
}, 30 * 60 * 1000); // 每30分鐘清理一次

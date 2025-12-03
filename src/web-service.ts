import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { runAutoPunchCard } from './integrated-main-v2';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const taskStatus = new Map();

// 診斷 API
app.get('/api/diagnose', (req, res) => {
  const fs = require('fs');
  const { execSync } = require('child_process');
  
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ];
  
  const pathsCheck = possiblePaths.map(path => ({
    path,
    exists: fs.existsSync(path)
  }));
  
  const whichResults: any = {};
  ['chromium', 'chromium-browser', 'google-chrome'].forEach(cmd => {
    try {
      whichResults[cmd] = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
    } catch (e) {
      whichResults[cmd] = 'not found';
    }
  });
  
  res.json({
    platform: process.platform,
    env: {
      PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || 'not set',
      NODE_ENV: process.env.NODE_ENV
    },
    pathsCheck,
    whichResults
  });
});

// 首頁
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
                    <input type="text" name="companyCode" value="TNLMG" required 
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
                    <label class="block text-sm font-medium mb-1">補卡日期（每行一筆）</label>
                    <textarea name="dates" rows="4" required placeholder="2025/12/03	上班未打卡
2025/12/02	下班未打卡" 
                              class="w-full border rounded px-3 py-2"></textarea>
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
            const data = {
                companyCode: formData.get('companyCode'),
                username: formData.get('username'),
                password: formData.get('password'),
                dates: formData.get('dates').split('\\n').filter(l => l.trim())
            };
            
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'mt-4 p-3 rounded bg-blue-100 text-blue-800';
            statusDiv.textContent = '正在處理中，請稍候...';
            statusDiv.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/punch-card', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
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
                        statusDiv.innerHTML = '✅ 補卡完成！<br>' + (status.message || '');
                    } else if (status.status === 'failed') {
                        statusDiv.className = 'mt-4 p-3 rounded bg-red-100 text-red-800';
                        statusDiv.textContent = '❌ 補卡失敗：' + (status.error || '未知錯誤');
                    } else {
                        statusDiv.textContent = '⏳ ' + (status.progress || '處理中...');
                        setTimeout(poll, 2000);
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
    const { companyCode, username, password, dates } = req.body;
    
    if (!companyCode || !username || !password || !dates || dates.length === 0) {
      return res.status(400).json({ error: '請填寫所有必要欄位' });
    }
    
    taskStatus.set(requestId, {
      status: 'processing',
      progress: '正在啟動瀏覽器...',
      startTime: new Date()
    });
    
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

// 處理補卡任務
async function processPunchCard(requestId: string, data: any) {
  const { companyCode, username, password, dates } = data;
  
  try {
    taskStatus.set(requestId, {
      status: 'processing',
      progress: '正在啟動瀏覽器...'
    });
    
    const result = await runAutoPunchCard({
      companyCode,
      username,
      password,
      dates,
      headless: true,
      onProgress: (message: string) => {
        taskStatus.set(requestId, {
          status: 'processing',
          progress: message
        });
      }
    });
    
    taskStatus.set(requestId, {
      status: 'completed',
      message: `完成！成功 ${result.success} 筆，失敗 ${result.failed} 筆`,
      completedTime: new Date()
    });
    
  } catch (error: any) {
    console.error('Processing error:', error);
    taskStatus.set(requestId, {
      status: 'failed',
      error: error.message,
      failedTime: new Date()
    });
  }
}

app.listen(port, () => {
  console.log(`🚀 自動補卡服務已啟動在 http://localhost:${port}`);
});

// 清理過期任務
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, status] of taskStatus.entries()) {
    if ((status as any).startTime < oneHourAgo) {
      taskStatus.delete(id);
    }
  }
}, 30 * 60 * 1000);

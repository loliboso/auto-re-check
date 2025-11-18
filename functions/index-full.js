const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

// 創建 Express app
const app = express();

// 中間件
app.use(cors());
app.use(express.json());

// 任務狀態儲存
const taskStatus = new Map();

// === 系統配置 ===
const CONFIG = {
  BROWSER: {
    HEADLESS: true,
    ENABLE_SCREENSHOTS: false,
    ARGS: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-extensions',
      '--disable-plugins'
    ]
  },
  URLS: {
    LOGIN_URL: 'https://apollo.mayohr.com',
    MAIN_PAGE_URL: 'https://apollo.mayohr.com/tube',
  },
  TIMEOUTS: {
    PAGE_LOAD: 30000,
    LOGIN: 15000,
    ELEMENT_WAIT: 10000,
    NAVIGATION_WAIT: 15000,
    FORM_LOAD: 5000,
    IFRAME_WAIT: 3000
  },
  DELAYS: {
    INPUT_DELAY: 100,
    CLICK_DELAY: 500,
    NAVIGATION_DELAY: 1000,
    FORM_FILL_DELAY: 300,
    AFTER_SUBMIT_DELAY: 2000
  }
};

// 補卡處理類別（簡化版）
class CloudAutoPunchService {
  constructor(userInfo, taskId) {
    this.userInfo = userInfo;
    this.taskId = taskId;
    this.browser = null;
    this.page = null;
  }

  updateStatus(status, message, progress) {
    const taskInfo = taskStatus.get(this.taskId);
    if (taskInfo) {
      taskInfo.status = status;
      taskInfo.message = message;
      taskInfo.progress = progress;
      taskInfo.lastUpdate = new Date();
    }
  }

  async run() {
    try {
      this.updateStatus('running', '正在啟動瀏覽器...', 5);
      
      this.browser = await puppeteer.launch({
        headless: CONFIG.BROWSER.HEADLESS,
        args: CONFIG.BROWSER.ARGS
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });

      this.updateStatus('running', '正在登入系統...', 15);
      await this.login();

      this.updateStatus('running', '正在處理補卡記錄...', 30);
      const results = await this.processAllRecords();

      this.updateStatus('completed', '補卡完成！', 100);
      
      return {
        success: true,
        results: results
      };

    } catch (error) {
      this.updateStatus('failed', `錯誤：${error.message}`, 0);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async login() {
    await this.page.goto(CONFIG.URLS.LOGIN_URL, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD
    });

    await this.page.waitForSelector('input[name="company"]', {
      timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
    });

    await this.page.type('input[name="company"]', this.userInfo.companyCode, {
      delay: CONFIG.DELAYS.INPUT_DELAY
    });
    await this.page.type('input[name="username"]', this.userInfo.username, {
      delay: CONFIG.DELAYS.INPUT_DELAY
    });
    await this.page.type('input[name="password"]', this.userInfo.password, {
      delay: CONFIG.DELAYS.INPUT_DELAY
    });

    await Promise.all([
      this.page.click('button[type="submit"]'),
      this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUTS.LOGIN
      })
    ]);

    await this.page.waitForTimeout(CONFIG.DELAYS.NAVIGATION_DELAY);
  }

  async processAllRecords() {
    const results = [];
    
    for (let i = 0; i < this.userInfo.records.length; i++) {
      const record = this.userInfo.records[i];
      const progress = 30 + Math.floor((i / this.userInfo.records.length) * 60);
      
      this.updateStatus('running', `處理第 ${i + 1}/${this.userInfo.records.length} 筆補卡...`, progress);
      
      try {
        await this.processSingleRecord(record);
        results.push({ record, success: true });
      } catch (error) {
        results.push({ record, success: false, error: error.message });
      }
    }
    
    return results;
  }

  async processSingleRecord(record) {
    // 簡化的補卡邏輯
    // 實際實作需要根據你的 integrated-main-v2.ts 完整邏輯
    await this.page.waitForTimeout(1000);
    return true;
  }
}

// === API 路由 ===

// 健康檢查
app.get('/', (req, res) => {
  res.json({
    service: '雲端自動補卡服務',
    status: 'running',
    version: '1.0.0'
  });
});

// 提交補卡任務
app.post('/api/submit', async (req, res) => {
  try {
    const { companyCode, username, password, records } = req.body;

    if (!companyCode || !username || !password || !records || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數'
      });
    }

    const taskId = uuidv4();
    
    taskStatus.set(taskId, {
      status: 'pending',
      message: '任務已建立，等待處理...',
      progress: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    });

    const userInfo = { companyCode, username, password, records };
    
    // 非同步執行補卡任務
    const service = new CloudAutoPunchService(userInfo, taskId);
    service.run().catch(error => {
      console.error('Task execution error:', error);
    });

    res.json({
      success: true,
      taskId: taskId,
      message: '任務已建立，請使用 taskId 查詢進度'
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 查詢任務狀態
app.get('/api/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const status = taskStatus.get(taskId);

  if (!status) {
    return res.status(404).json({
      success: false,
      error: '找不到該任務'
    });
  }

  res.json({
    success: true,
    ...status
  });
});

// 導出為 Firebase Function
exports.api = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB'
  })
  .https.onRequest(app);

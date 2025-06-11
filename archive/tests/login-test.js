/**
 * 第一階段完整實現 - 登入功能
 * 自包含版本，避免模組匯入問題
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 系統配置
const CONFIG = {
  URLS: {
    LOGIN_URL: 'https://apollo.mayohr.com',
    MAIN_URL: 'https://apollo.mayohr.com',
    APPLY_FORM_URL: 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b'
  },
  TIMEOUTS: {
    PAGE_LOAD: 30000,
    LOGIN: 15000,
    ELEMENT_WAIT: 10000,
    NAVIGATION_WAIT: 15000
  },
  DELAYS: {
    INPUT_DELAY: 100,
    CLICK_DELAY: 500,
    NAVIGATION_DELAY: 1000
  },
  PATHS: {
    USER_CONFIG: './data/user-info.txt',
    LOGS_DIR: './logs/',
    SCREENSHOTS_DIR: './screenshots/'
  }
};

// 選擇器
const SELECTORS = {
  LOGIN: {
    POPUP_CONFIRM: 'button:contains("確定")',
    COMPANY_CODE: '#companyCode',
    USERNAME: '#username',
    PASSWORD: '#password',
    LOGIN_BUTTON: '#loginButton'
  },
  MAIN_PAGE: {
    FORM_APPLICATION_LINK: 'a.link-item__link[href*="bpm/applyform"]'
  }
};

// 簡單的日誌服務
class SimpleLogger {
  constructor() {
    if (!fs.existsSync(CONFIG.PATHS.LOGS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.LOGS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFile = path.join(CONFIG.PATHS.LOGS_DIR, `login-test-${timestamp}.log`);
  }

  log(level, message, context) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const logLine = `[${timestamp}] [${level}] ${message}${contextStr}\n`;
    
    fs.appendFileSync(this.logFile, logLine);
    console.log(`[${level}] ${message}`, context || '');
  }

  info(message, context) { this.log('INFO', message, context); }
  error(message, context) { this.log('ERROR', message, context); }
  debug(message, context) { this.log('DEBUG', message, context); }
  warn(message, context) { this.log('WARN', message, context); }
}

// 配置解析器
class ConfigParser {
  static parseUserConfig(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let loginInfo = null;
    const attendanceRecords = [];
    let currentSection = '';

    for (const line of lines) {
      if (line.includes('登入資訊：')) {
        currentSection = 'login';
        continue;
      } else if (line.includes('補卡日期：')) {
        currentSection = 'attendance';
        continue;
      }

      if (currentSection === 'login') {
        if (line.includes('公司代碼：')) {
          const companyCode = line.split('：')[1]?.trim();
          if (!loginInfo) loginInfo = { companyCode: '', username: '', password: '' };
          loginInfo.companyCode = companyCode || '';
        } else if (line.includes('登入帳號：')) {
          const username = line.split('：')[1]?.trim();
          if (!loginInfo) loginInfo = { companyCode: '', username: '', password: '' };
          loginInfo.username = username || '';
        } else if (line.includes('密碼：')) {
          const password = line.split('：')[1]?.trim();
          if (!loginInfo) loginInfo = { companyCode: '', username: '', password: '' };
          loginInfo.password = password || '';
        }
      } else if (currentSection === 'attendance') {
        const dateMatch = line.match(/(\d{4}\/\d{2}\/\d{2})/);
        if (dateMatch) {
          const date = dateMatch[1];
          const typeText = line.replace(date, '').trim().replace(/^\t+/, '');
          
          let type;
          if (typeText.includes('上班未打卡') && typeText.includes('下班未打卡')) {
            type = 'BOTH';
          } else if (typeText.includes('上班未打卡')) {
            type = 'CLOCK_IN';
          } else if (typeText.includes('下班未打卡')) {
            type = 'CLOCK_OUT';
          }
          
          if (type) {
            attendanceRecords.push({ date, type, rawText: line });
          }
        }
      }
    }

    return { loginInfo, attendanceRecords };
  }
}

// 登入測試主類別
class LoginTester {
  constructor() {
    this.logger = new SimpleLogger();
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.logger.info('=== 第一階段：登入功能測試開始 ===');
    
    // 確保截圖目錄存在
    if (!fs.existsSync(CONFIG.PATHS.SCREENSHOTS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.SCREENSHOTS_DIR, { recursive: true });
    }
    
    // 啟動瀏覽器
    this.logger.info('正在啟動瀏覽器...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 720 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--allow-running-insecure-content',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      this.page = await this.browser.newPage();
      
      // 設置更長的導航超時
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      // 設置真實的用戶代理
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      // 禁用圖片載入以提高速度
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      this.logger.info('瀏覽器啟動成功');
    } catch (error) {
      this.logger.error('瀏覽器啟動失敗', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async loadUserConfig() {
    this.logger.info('讀取使用者配置...');
    
    if (!fs.existsSync(CONFIG.PATHS.USER_CONFIG)) {
      throw new Error(`配置檔案不存在: ${CONFIG.PATHS.USER_CONFIG}`);
    }

    const content = fs.readFileSync(CONFIG.PATHS.USER_CONFIG, 'utf-8');
    const config = ConfigParser.parseUserConfig(content);
    
    if (!config.loginInfo) {
      throw new Error('配置檔案中未找到登入資訊');
    }

    this.logger.info('使用者配置載入成功', {
      username: config.loginInfo.username,
      companyCode: config.loginInfo.companyCode,
      recordsCount: config.attendanceRecords.length
    });

    return config;
  }

  async performLogin(loginInfo) {
    this.logger.info('開始執行登入流程');

    try {
      // 導航到登入頁面 - 增加重試機制
      this.logger.info(`導航到登入頁面: ${CONFIG.URLS.LOGIN_URL}`);
      
      let retries = 3;
      let success = false;
      
      while (retries > 0 && !success) {
        try {
          await this.page.goto(CONFIG.URLS.LOGIN_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
          });
          success = true;
          this.logger.info('頁面載入成功');
        } catch (error) {
          retries--;
          this.logger.warn(`頁面載入失敗，剩餘重試次數: ${retries}`, { error: error.message });
          if (retries > 0) {
            await this.page.waitForTimeout(3000);
          } else {
            throw error;
          }
        }
      }

      // 等待並處理可能的彈窗
      await this.page.waitForTimeout(3000);
      
      // 檢查是否已經登入
      const currentUrl = this.page.url();
      if (currentUrl.includes('bpm/applyform')) {
        this.logger.info('使用者已經登入，跳過登入步驟');
        return true;
      }

      // 等待登入表單
      this.logger.info('等待登入表單載入...');
      try {
        await this.page.waitForSelector(SELECTORS.LOGIN.USERNAME, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      } catch (error) {
        this.logger.error('登入表單載入失敗', { error: error.message });
        await this.takeScreenshot('login_form_not_found');
        throw error;
      }

      // 填寫登入表單
      this.logger.info('填寫登入表單...');
      
      // 檢查是否有公司代碼欄位
      const companyCodeExists = await this.page.$(SELECTORS.LOGIN.COMPANY_CODE);
      if (companyCodeExists) {
        await this.page.click(SELECTORS.LOGIN.COMPANY_CODE);
        await this.page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) element.value = '';
        }, SELECTORS.LOGIN.COMPANY_CODE);
        await this.page.type(SELECTORS.LOGIN.COMPANY_CODE, loginInfo.companyCode);
        await this.page.waitForTimeout(CONFIG.DELAYS.INPUT_DELAY);
      }

      // 填寫使用者名稱
      await this.page.click(SELECTORS.LOGIN.USERNAME);
      await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) element.value = '';
      }, SELECTORS.LOGIN.USERNAME);
      await this.page.type(SELECTORS.LOGIN.USERNAME, loginInfo.username);
      await this.page.waitForTimeout(CONFIG.DELAYS.INPUT_DELAY);

      // 填寫密碼
      await this.page.click(SELECTORS.LOGIN.PASSWORD);
      await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) element.value = '';
      }, SELECTORS.LOGIN.PASSWORD);
      await this.page.type(SELECTORS.LOGIN.PASSWORD, loginInfo.password);
      await this.page.waitForTimeout(CONFIG.DELAYS.INPUT_DELAY);

      this.logger.info('登入表單填寫完成');

      // 截圖記錄
      await this.takeScreenshot('login_form_filled');

      // 提交登入表單
      this.logger.info('提交登入表單...');
      await this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON);
      await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);

      // 等待導航
      await this.page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT 
      });

      // 驗證登入結果
      await this.page.waitForTimeout(3000);
      const finalUrl = this.page.url();
      this.logger.info('登入後的 URL', { url: finalUrl });

      // 檢查登入是否成功
      const isOnMainPage = finalUrl.includes('apollo.mayohr.com') && !finalUrl.includes('login');
      const isOnFormPage = finalUrl.includes('bpm/applyform');
      
      if (isOnMainPage || isOnFormPage) {
        this.logger.info('登入驗證成功');
        await this.takeScreenshot('login_success');
        return true;
      }

      // 嘗試尋找表單申請連結
      try {
        await this.page.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK, {
          timeout: CONFIG.TIMEOUTS.LOGIN
        });
        this.logger.info('找到表單申請連結，登入驗證成功');
        await this.takeScreenshot('login_success_with_link');
        return true;
      } catch (error) {
        this.logger.error('登入驗證失敗：無法找到表單申請連結');
        await this.takeScreenshot('login_verification_failed');
        throw new Error('登入驗證失敗');
      }

    } catch (error) {
      this.logger.error('登入流程失敗', { error: error.message });
      await this.takeScreenshot('login_failed');
      throw error;
    }
  }

  async navigateToFormApplication() {
    this.logger.info('導航到表單申請頁面...');

    try {
      const currentUrl = this.page.url();
      
      // 如果已經在表單申請頁面，直接返回
      if (currentUrl.includes('bpm/applyform')) {
        this.logger.info('已在表單申請頁面');
        return true;
      }

      // 點擊表單申請連結
      await this.page.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK, {
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
      });
      
      await this.page.click(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
      
      // 等待頁面載入
      await this.page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT 
      });
      
      const finalUrl = this.page.url();
      this.logger.info('成功導航至表單申請頁面', { url: finalUrl });
      
      await this.takeScreenshot('form_application_page');
      return true;

    } catch (error) {
      this.logger.error('導航至表單申請頁面失敗', { error: error.message });
      await this.takeScreenshot('navigation_failed');
      throw error;
    }
  }

  async takeScreenshot(filename) {
    try {
      const screenshotPath = path.join(CONFIG.PATHS.SCREENSHOTS_DIR, `${filename}_${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.info(`截圖已儲存: ${screenshotPath}`);
    } catch (error) {
      this.logger.error('截圖失敗', { error: error.message });
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.logger.info('瀏覽器已關閉');
      }
    } catch (error) {
      this.logger.error('清理資源失敗', { error: error.message });
    }
  }

  async run() {
    try {
      // 初始化
      await this.initialize();

      // 載入配置
      const config = await this.loadUserConfig();

      // 執行登入
      const loginSuccess = await this.performLogin(config.loginInfo);

      if (loginSuccess) {
        // 導航到表單申請頁面
        await this.navigateToFormApplication();

        this.logger.info('=== 第一階段登入功能測試完成 ===');
        this.logger.info('登入成功並到達表單申請頁面');
        
        // 等待 5 秒讓使用者查看結果
        this.logger.info('等待 5 秒以便查看結果...');
        await this.page.waitForTimeout(5000);
      }

    } catch (error) {
      this.logger.error('測試執行失敗', { error: error.message });
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// 執行測試
async function main() {
  const tester = new LoginTester();
  
  try {
    await tester.run();
    console.log('\n✅ 第一階段登入功能測試完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 第一階段登入功能測試失敗:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

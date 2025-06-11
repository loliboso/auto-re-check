/**
 * 第一階段：登入功能 TypeScript 實作
 * 簡化版本，避免複雜的模組相依性問題
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';

// === 系統配置 ===
const CONFIG = {
  URLS: {
    LOGIN_URL: 'https://apollo.mayohr.com',
    MAIN_URL: 'https://apollo.mayohr.com',
    A        try {
          // 尋找表單申請連結 - 使用更精確的選擇器確保是「表單申請」而不是「表單簽核」
          const formAppLink = await this.page.$('a.link-item__link[href*="targetPath=bpm%2Fapplyform%3FmoduleType%3Dapply"]');
          if (formAppLink) {
            // 驗證連結文字確保是「表單申請」
            const linkText = await formAppLink.evaluate(el => el.textContent?.trim());
            this.logger.info('找到連結', { text: linkText, href: await formAppLink.evaluate(el => el.href) });
            
            if (linkText && linkText.includes('表單申請')) {
              this.logger.info('確認找到正確的表單申請按鈕，準備點擊');
              await formAppLink.click();ORM_URL: 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b'
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

// === 選擇器 ===
const SELECTORS = {
  LOGIN: {
    POPUP_CONFIRM: 'button.btn.btn-default',
    COMPANY_CODE: 'input[name="companyCode"]',
    EMPLOYEE_NO: 'input[name="employeeNo"]',
    PASSWORD: 'input[name="password"]',
    LOGIN_BUTTON: 'button[type="submit"]'
  },
  MAIN_PAGE: {
    FORM_APPLICATION_LINK: 'a.link-item__link[href*="targetPath=bpm%2Fapplyform%3FmoduleType%3Dapply"]'
  }
};

// === 型別定義 ===
interface LoginInfo {
  companyCode: string;
  username: string;
  password: string;
}

interface AttendanceRecord {
  date: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BOTH';
  rawText: string;
}

interface UserConfig {
  loginInfo: LoginInfo;
  attendanceRecords: AttendanceRecord[];
}

// === 日誌服務 ===
export class SimpleLogService {
  private logFilePath: string;

  constructor() {
    if (!fs.existsSync(CONFIG.PATHS.LOGS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.LOGS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFilePath = path.join(CONFIG.PATHS.LOGS_DIR, `phase1-${timestamp}.log`);
  }

  private log(level: string, message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const logLine = `[${timestamp}] [${level}] ${message}${contextStr}\n`;
    
    fs.appendFileSync(this.logFilePath, logLine);
    console.log(`[${level}] ${message}`, context || '');
  }

  info(message: string, context?: any): void { this.log('INFO', message, context); }
  error(message: string, context?: any): void { this.log('ERROR', message, context); }
  debug(message: string, context?: any): void { this.log('DEBUG', message, context); }
  warn(message: string, context?: any): void { this.log('WARN', message, context); }
}

// === 配置解析器 ===
export class ConfigParser {
  static parseUserConfig(content: string): UserConfig {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let loginInfo: LoginInfo | null = null;
    const attendanceRecords: AttendanceRecord[] = [];
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
          
          let type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BOTH';
          if (typeText.includes('上班未打卡') && typeText.includes('下班未打卡')) {
            type = 'BOTH';
          } else if (typeText.includes('上班未打卡')) {
            type = 'CLOCK_IN';
          } else if (typeText.includes('下班未打卡')) {
            type = 'CLOCK_OUT';
          } else {
            continue; // 跳過無法識別的類型
          }
          
          attendanceRecords.push({ date, type, rawText: line });
        }
      }
    }

    if (!loginInfo) {
      throw new Error('配置檔案中未找到登入資訊');
    }

    return { loginInfo, attendanceRecords };
  }
}

// === 主要的第一階段登入測試器 ===
export class Phase1LoginTester {
  private logger: SimpleLogService;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor() {
    this.logger = new SimpleLogService();
  }

  async initialize(): Promise<void> {
    this.logger.info('=== 第一階段：登入功能測試開始 ===');
    
    // 確保截圖目錄存在
    if (!fs.existsSync(CONFIG.PATHS.SCREENSHOTS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.SCREENSHOTS_DIR, { recursive: true });
    }
    
    try {
      this.logger.info('正在啟動瀏覽器...');
      
      this.browser = await puppeteer.launch({
        headless: false, // 顯示瀏覽器以便觀察
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // 使用系統 Chrome
        defaultViewport: null, // 移除視窗大小限制，使用瀏覽器視窗大小
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--start-maximized' // 啟動時最大化視窗
        ]
      });

      this.page = await this.browser.newPage();
      
      // 設置較長的超時
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      // 設置用戶代理
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      this.logger.info('瀏覽器啟動成功');
      
    } catch (error) {
      this.logger.error('瀏覽器啟動失敗', { error: (error as Error).message });
      throw error;
    }
  }

  async loadUserConfig(): Promise<UserConfig> {
    this.logger.info('讀取使用者配置...');
    
    if (!fs.existsSync(CONFIG.PATHS.USER_CONFIG)) {
      throw new Error(`配置檔案不存在: ${CONFIG.PATHS.USER_CONFIG}`);
    }

    const content = fs.readFileSync(CONFIG.PATHS.USER_CONFIG, 'utf-8');
    const config = ConfigParser.parseUserConfig(content);
    
    this.logger.info('使用者配置載入成功', {
      username: config.loginInfo.username,
      companyCode: config.loginInfo.companyCode,
      recordsCount: config.attendanceRecords.length
    });

    return config;
  }

  async performLogin(loginInfo: LoginInfo): Promise<boolean> {
    if (!this.page) {
      throw new Error('瀏覽器頁面未初始化');
    }

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
          this.logger.warn(`頁面載入失敗，剩餘重試次數: ${retries}`, { error: (error as Error).message });
          if (retries > 0) {
            await this.page.waitForTimeout(3000);
          } else {
            throw error;
          }
        }
      }

      // 等待頁面穩定
      await this.page.waitForTimeout(3000);
      
      const currentUrl = this.page.url();
      this.logger.info('當前頁面 URL', { url: currentUrl });

      // 步驟1: 檢查是否有 pop-up 提示需要關閉
      this.logger.info('檢查是否有 pop-up 提示...');
      try {
        // 尋找「確定」按鈕
        const confirmButton = await this.page.$('button.btn.btn-default');
        if (confirmButton) {
          const buttonText = await confirmButton.evaluate(el => el.textContent?.trim());
          if (buttonText === '確定') {
            this.logger.info('找到 pop-up 確定按鈕，準備點擊關閉');
            await confirmButton.click();
            await this.page.waitForTimeout(2000);
            
            // 等待導航
            await this.page.waitForNavigation({ 
              waitUntil: 'domcontentloaded',
              timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT 
            });
            
            const newUrl = this.page.url();
            this.logger.info('關閉 pop-up 後的新 URL', { url: newUrl });
          }
        }
      } catch (error) {
        this.logger.info('未找到 pop-up 確定按鈕，繼續流程', { error: (error as Error).message });
      }

      // 等待頁面穩定
      await this.page.waitForTimeout(2000);
      const finalUrl = this.page.url();
      
      // 步驟2: 檢查是否已經登入（直接跳轉到表單申請頁面）
      if (finalUrl.includes('bpm/applyform')) {
        this.logger.info('使用者已經登入，直接到達表單申請頁面');
        await this.takeScreenshot('already_logged_in');
        return true;
      }

      // 步驟3: 檢查是否在主頁面（需要點擊表單申請）
      if (finalUrl.includes('apollo.mayohr.com') && !finalUrl.includes('login')) {
        this.logger.info('使用者已登入，在主頁面，尋找表單申請按鈕');
        try {
          // 尋找表單申請連結 - 使用正確的選擇器
          const formAppLink = await this.page.$('a.link-item__link[href*="bpm/sso-redirect"][href*="applyform"]');
          if (formAppLink) {
            this.logger.info('找到表單申請按鈕，準備點擊');
            await formAppLink.click();
            
            // 等待導航到表單申請頁面
            await this.page.waitForNavigation({ 
              waitUntil: 'domcontentloaded',
              timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT 
            });
            
            const formUrl = this.page.url();
            this.logger.info('成功導航到表單申請頁面', { url: formUrl });
            await this.takeScreenshot('form_application_page');
            return true;
          }
        } catch (error) {
          this.logger.warn('在主頁面尋找表單申請按鈕失敗', { error: (error as Error).message });
        }
      }

      // 步驟4: 如果需要登入，尋找登入表單
      this.logger.info('檢查是否需要登入...');
      await this.takeScreenshot('before_login_form_search');
      
      // 填寫登入表單 - 使用正確的欄位名稱
      this.logger.info('開始填寫登入表單...');
      
      // 步驟1: 填寫公司代碼 (必填)
      this.logger.info('填寫公司代碼...');
      const companyCodeField = await this.page.$('input[name="companyCode"]');
      if (!companyCodeField) {
        this.logger.error('未找到公司代碼欄位');
        await this.takeScreenshot('company_code_not_found');
        throw new Error('無法找到公司代碼欄位 input[name="companyCode"]');
      }
      
      await companyCodeField.click();
      await companyCodeField.evaluate(el => (el as HTMLInputElement).value = '');
      await companyCodeField.type(loginInfo.companyCode);
      await this.page.waitForTimeout(CONFIG.DELAYS.INPUT_DELAY);
      this.logger.info('公司代碼填寫完成', { companyCode: loginInfo.companyCode });

      // 步驟2: 填寫工號 (employeeNo, 不是 username)
      this.logger.info('填寫工號...');
      const employeeNoField = await this.page.$('input[name="employeeNo"]');
      if (!employeeNoField) {
        this.logger.error('未找到工號欄位');
        await this.takeScreenshot('employee_no_not_found');
        throw new Error('無法找到工號欄位 input[name="employeeNo"]');
      }
      
      await employeeNoField.click();
      await employeeNoField.evaluate(el => (el as HTMLInputElement).value = '');
      await employeeNoField.type(loginInfo.username); // username 實際上是工號
      await this.page.waitForTimeout(CONFIG.DELAYS.INPUT_DELAY);
      this.logger.info('工號填寫完成', { employeeNo: loginInfo.username });

      // 步驟3: 填寫密碼
      this.logger.info('填寫密碼...');
      const passwordField = await this.page.$('input[name="password"]');
      if (!passwordField) {
        this.logger.error('未找到密碼欄位');
        await this.takeScreenshot('password_not_found');
        throw new Error('無法找到密碼欄位 input[name="password"]');
      }

      await passwordField.click();
      await passwordField.evaluate(el => (el as HTMLInputElement).value = '');
      await passwordField.type(loginInfo.password);
      await this.page.waitForTimeout(CONFIG.DELAYS.INPUT_DELAY);
      this.logger.info('密碼填寫完成');

      this.logger.info('登入表單填寫完成');
      await this.takeScreenshot('login_form_filled');

      // 步驟4: 提交登入表單
      this.logger.info('提交登入表單...');
      const submitButton = await this.page.$('button[type="submit"]');
      if (!submitButton) {
        this.logger.error('未找到提交按鈕');
        await this.takeScreenshot('submit_button_not_found');
        throw new Error('無法找到登入提交按鈕 button[type="submit"]');
      }
      
      this.logger.info('找到提交按鈕，準備點擊');
      await submitButton.click();
      await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);

      // 等待導航 - 增加更長的超時時間，因為登入處理可能較慢
      this.logger.info('等待登入處理和頁面導航...');
      try {
        await this.page.waitForNavigation({ 
          waitUntil: 'domcontentloaded',
          timeout: 30000 // 增加到 30 秒
        });
      } catch (error) {
        this.logger.warn('導航等待超時，檢查當前頁面狀態', { error: (error as Error).message });
        // 即使超時，也檢查當前頁面狀態
      }

      // 驗證登入結果
      await this.page.waitForTimeout(3000);
      const postLoginUrl = this.page.url();
      this.logger.info('登入後的 URL', { url: postLoginUrl });

      // 檢查是否登入成功
      if (postLoginUrl.includes('bpm/applyform')) {
        this.logger.info('登入成功，直接到達表單申請頁面');
        await this.takeScreenshot('login_success_direct');
        return true;
      } else if (postLoginUrl.includes('apollo.mayohr.com') && !postLoginUrl.includes('login')) {
        this.logger.info('登入成功，到達主頁面，需要點擊表單申請按鈕');
        await this.takeScreenshot('login_success_main_page');
        
        // 在主頁面尋找表單申請按鈕
        return await this.navigateToFormApplication();
      }

      this.logger.error('登入後 URL 不符合預期');
      await this.takeScreenshot('login_result_unexpected');
      throw new Error('登入驗證失敗');

    } catch (error) {
      this.logger.error('登入流程失敗', { error: (error as Error).message });
      await this.takeScreenshot('login_failed');
      throw error;
    }
  }

  async navigateToFormApplication(): Promise<boolean> {
    if (!this.page) {
      throw new Error('瀏覽器頁面未初始化');
    }

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
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT 
      });
      
      const finalUrl = this.page.url();
      this.logger.info('成功導航至表單申請頁面', { url: finalUrl });
      
      await this.takeScreenshot('form_application_page');
      return true;

    } catch (error) {
      this.logger.error('導航至表單申請頁面失敗', { error: (error as Error).message });
      await this.takeScreenshot('navigation_failed');
      throw error;
    }
  }

  async takeScreenshot(filename: string): Promise<void> {
    if (!this.page) return;
    
    try {
      const screenshotPath = path.join(CONFIG.PATHS.SCREENSHOTS_DIR, `${filename}_${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.info(`截圖已儲存: ${screenshotPath}`);
    } catch (error) {
      this.logger.error('截圖失敗', { error: (error as Error).message });
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.logger.info('瀏覽器已關閉');
      }
    } catch (error) {
      this.logger.error('清理資源失敗', { error: (error as Error).message });
    }
  }

  async run(): Promise<void> {
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
        if (this.page) {
          await this.page.waitForTimeout(5000);
        }
      }

    } catch (error) {
      this.logger.error('測試執行失敗', { error: (error as Error).message });
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// === 主程式執行 ===
async function main(): Promise<void> {
  const tester = new Phase1LoginTester();
  
  try {
    await tester.run();
    console.log('\n✅ 第一階段登入功能測試完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 第一階段登入功能測試失敗:', (error as Error).message);
    process.exit(1);
  }
}

// 如果此檔案被直接執行，則執行主程式
if (require.main === module) {
  main().catch(console.error);
}

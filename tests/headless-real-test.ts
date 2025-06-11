/**
 * 無頭模式實戰測試版
 * 基於 integrated-main-v2.ts，添加無頭模式支援
 * 測試目標：
 * - 2025/05/16 上班未打卡 (重複，會有警告)
 * - 2025/06/11 下班未打卡 (實際補卡)
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page, Frame } from 'puppeteer';

// === 系統配置（添加無頭模式支援） ===
const CONFIG = {
  BROWSER: {
    HEADLESS: true,  // 🔧 啟用無頭模式
    ENABLE_SCREENSHOTS: true,  // 無頭模式下仍保留截圖功能用於調試
  },
  URLS: {
    LOGIN_URL: 'https://apollo.mayohr.com',
    APPLY_FORM_URL: 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b'
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
  },
  PATHS: {
    USER_CONFIG: './data/user-info.txt',
    LOGS_DIR: './logs/',
    SCREENSHOTS_DIR: './screenshots/'
  }
};

// === 精確選擇器（根據 PRD 提供的 HTML 結構） ===
const SELECTORS = {
  // Phase1 登入選擇器
  LOGIN: {
    POPUP_CONFIRM: 'button.btn.btn-default',
    COMPANY_CODE: 'input[name="companyCode"]',
    EMPLOYEE_NO: 'input[name="employeeNo"]',
    PASSWORD: 'input[name="password"]',
    LOGIN_BUTTON: 'button[type="submit"]'
  },
  MAIN_PAGE: {
    FORM_APPLICATION_LINK: 'a.link-item__link[href*="targetPath=bpm%2Fapplyform%3FmoduleType%3Dapply"]'
  },
  // Phase2 補卡選擇器
  FORM_APPLICATION: {
    FORGET_PUNCH_LINK: 'a[data-formkind="TNLMG9.FORM.1001"]',
    FORGET_PUNCH_LINK_ALT: 'a[href*="javascript:void(0)"][data-formkind="TNLMG9.FORM.1001"]'
  },
  IFRAMES: {
    MAIN: '#main',
    BANNER: '#banner'
  },
  // 根據 PRD 提供的精確選擇器，只處理指定的三個欄位
  ATTENDANCE_FORM: {
    // 1. 類型欄位 - 根據 PRD 精確 HTML 結構
    ATTENDANCE_TYPE_CONTAINER: '#attendancetype_input',
    ATTENDANCE_TYPE_SELECT: '#fm_attendancetype',
    ATTENDANCE_TYPE_DROPDOWN: '#attendancetype_input span.k-dropdown-wrap.k-state-default',
    
    // 2. 日期/時間欄位 - 根據 PRD 精確 HTML 結構
    DATETIME_CONTAINER: '#datetime_input',
    DATETIME_INPUT: '#fm_datetime',
    DATETIME_CALENDAR_BUTTON: '#datetime_input span.k-link.k-link-date',
    
    // 3. 地點欄位 - 根據 PRD 精確 HTML 結構
    LOCATION_CONTAINER: '#location_input',
    LOCATION_SELECT: '#fm_location',
    LOCATION_DROPDOWN: '#location_input span.k-dropdown-wrap.k-state-default',
    LOCATION_TNLMG_VALUE: '518ee0c2-a787-40a6-bb94-5a081250e896',
    
    // 送簽按鈕（在 banner iframe 內）
    SUBMIT_BUTTON: '#SUBMIT',
    SUBMIT_BUTTON_ALT: 'div.buttonDiv[id="SUBMIT"]',
    
    // 確認對話框處理
    CONFIRM_BUTTON: 'button',
    ALERT_DIALOG: '.ui-dialog, .modal, .alert'
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

interface AttendanceTask {
  date: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  displayName: string;
}

// === 日誌服務 ===
class HeadlessLogService {
  private logFilePath: string;

  constructor() {
    if (!fs.existsSync(CONFIG.PATHS.LOGS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.LOGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.PATHS.SCREENSHOTS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.SCREENSHOTS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFilePath = path.join(CONFIG.PATHS.LOGS_DIR, `headless-test-${timestamp}.log`);
  }

  private log(level: string, message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.padEnd(5)}] 🤖 ${message}`;
    console.log(logEntry);
    
    let logWithContext = logEntry;
    if (context) {
      logWithContext += ` | Context: ${JSON.stringify(context, null, 2)}`;
    }
    
    try {
      fs.appendFileSync(this.logFilePath, logWithContext + '\n');
    } catch (error) {
      console.error('無法寫入日誌檔案:', error);
    }
  }

  info(message: string, context?: any): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: any): void {
    this.log('WARN', message, context);
  }

  error(message: string, context?: any): void {
    this.log('ERROR', message, context);
  }

  success(message: string, context?: any): void {
    this.log('OK', message, context);
  }

  async takeScreenshot(page: Page, filename: string): Promise<void> {
    if (!CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      this.info('截圖功能已禁用（無頭模式優化）');
      return;
    }
    
    try {
      const timestamp = Date.now();
      const screenshotPath = path.join(CONFIG.PATHS.SCREENSHOTS_DIR, `headless_${filename}_${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      this.info(`📸 無頭模式截圖已保存: ${screenshotPath}`);
    } catch (error) {
      this.warn('截圖失敗', { error: error instanceof Error ? error.message : '未知錯誤' });
    }
  }
}

// === 配置解析服務（沿用原有邏輯） ===
class ConfigService {
  static loadUserConfig(): UserConfig {
    try {
      const configPath = path.resolve(CONFIG.PATHS.USER_CONFIG);
      const content = fs.readFileSync(configPath, 'utf8');
      
      // 解析登入資訊
      const companyCodeMatch = content.match(/公司代碼[：:]\s*(\S+)/);
      const usernameMatch = content.match(/(?:工號|登入帳號)[：:]\s*(\S+)/);
      const passwordMatch = content.match(/密碼[：:]\s*(\S+)/);
      
      if (!companyCodeMatch || !usernameMatch || !passwordMatch) {
        throw new Error('無法解析登入資訊');
      }
      
      const loginInfo: LoginInfo = {
        companyCode: companyCodeMatch[1],
        username: usernameMatch[1],
        password: passwordMatch[1]
      };
      
      // 解析補卡記錄
      const attendanceRecords: AttendanceRecord[] = [];
      const datePattern = /(\d{4}\/\d{1,2}\/\d{1,2})\s+(.+)/g;
      let match;
      
      while ((match = datePattern.exec(content)) !== null) {
        const [, date, description] = match;
        const cleanDescription = description.trim();
        
        let type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BOTH';
        if (cleanDescription.includes('上班未打卡') && cleanDescription.includes('下班未打卡')) {
          type = 'BOTH';
        } else if (cleanDescription.includes('上班未打卡')) {
          type = 'CLOCK_IN';
        } else if (cleanDescription.includes('下班未打卡')) {
          type = 'CLOCK_OUT';
        } else {
          continue; // 跳過無法識別的記錄
        }
        
        attendanceRecords.push({
          date,
          type,
          rawText: cleanDescription
        });
      }
      
      return { loginInfo, attendanceRecords };
    } catch (error) {
      throw new Error(`載入使用者配置失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }
}

// === 無頭模式自動補卡系統 ===
class HeadlessAutoAttendanceSystem {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: HeadlessLogService;
  private userConfig: UserConfig;
  private currentTaskIndex: number = 0;
  private attendanceTasks: AttendanceTask[] = [];
  private currentFormPage: Page | null = null;
  private hasDialogHandler: boolean = false;

  constructor() {
    this.logger = new HeadlessLogService();
    this.userConfig = ConfigService.loadUserConfig();
    this.attendanceTasks = this.expandAttendanceRecords();
  }

  // === 無頭模式瀏覽器初始化 ===
  private async initializeBrowser(): Promise<void> {
    this.logger.info('🤖 正在啟動無頭模式瀏覽器...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: CONFIG.BROWSER.HEADLESS,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        defaultViewport: null,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',                    // 無頭模式優化
          '--no-first-run',                  // 跳過首次運行
          '--disable-web-security',          // 避免部分安全限制
          '--disable-features=VizDisplayCompositor',
          '--window-size=1600,960',
          '--window-position=0,0'
        ]
      });

      this.page = await this.browser.newPage();
      
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      this.logger.success('🤖 無頭模式瀏覽器啟動成功');
    } catch (error) {
      this.logger.error('無頭模式瀏覽器啟動失敗', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // === 重用原有的核心邏輯 ===
  
  private expandAttendanceRecords(): AttendanceTask[] {
    const tasks: AttendanceTask[] = [];
    
    for (const record of this.userConfig.attendanceRecords) {
      if (record.type === 'BOTH') {
        tasks.push({
          date: record.date,
          type: 'CLOCK_IN',
          displayName: `${record.date} 上班打卡`
        });
        tasks.push({
          date: record.date,
          type: 'CLOCK_OUT',
          displayName: `${record.date} 下班打卡`
        });
      } else {
        const displayName = record.type === 'CLOCK_IN' ? 
          `${record.date} 上班打卡` : 
          `${record.date} 下班打卡`;
        tasks.push({
          date: record.date,
          type: record.type,
          displayName
        });
      }
    }
    
    return tasks;
  }

  // === 登入邏輯 (沿用原有) ===
  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('🤖 開始無頭模式登入流程');
    
    await this.page.goto(CONFIG.URLS.LOGIN_URL, { 
      waitUntil: 'networkidle2', 
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
    });
    
    // 處理可能的彈出視窗
    try {
      const popupButton = await this.page.waitForSelector(SELECTORS.LOGIN.POPUP_CONFIRM, { 
        timeout: 2000 
      });
      if (popupButton) {
        await popupButton.click();
        await this.page.waitForTimeout(500);
        this.logger.info('🤖 已處理登入彈出視窗');
      }
    } catch (error) {
      this.logger.info('🤖 無彈出視窗需要處理');
    }
    
    // 填寫登入表單
    await this.page.waitForSelector(SELECTORS.LOGIN.COMPANY_CODE, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    
    await this.page.type(SELECTORS.LOGIN.COMPANY_CODE, this.userConfig.loginInfo.companyCode, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.EMPLOYEE_NO, this.userConfig.loginInfo.username, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.PASSWORD, this.userConfig.loginInfo.password, { delay: CONFIG.DELAYS.INPUT_DELAY });
    
    this.logger.info('🤖 登入表單填寫完成');
    
    await this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON);
    await this.page.waitForTimeout(800);
    
    const currentUrl = this.page.url();
    if (currentUrl.includes('apollo.mayohr.com') && !currentUrl.includes('login')) {
      this.logger.success('🤖 無頭模式登入成功');
      // 截圖檢查登入後的頁面狀態
      await this.logger.takeScreenshot(this.page, 'after_login_success');
    } else {
      throw new Error('登入失敗或頁面未正確導向');
    }
  }

  // === 導航到表單申請頁面 ===
  private async navigateToFormApplication(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('🤖 正在導航到表單申請頁面');
    
    // 先截圖檢查目前頁面狀態
    await this.logger.takeScreenshot(this.page, 'before_form_application_search');
    
    // 等待頁面穩定
    await this.page.waitForTimeout(2000);
    
    // 檢查當前 URL
    const currentUrl = this.page.url();
    this.logger.info('🤖 導航前 URL', { url: currentUrl });
    
    // 如果已經在表單申請頁面，直接返回
    if (currentUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {        
      this.logger.success('🤖 已在表單申請頁面');
      return;
    }
    
    try {
      // 嘗試尋找表單申請按鈕
      await this.page.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      await this.page.click(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const currentUrl = this.page.url();
        if (currentUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {
          this.logger.success('🤖 成功導航到表單申請頁面');
          return;
        }
        await this.page.waitForTimeout(500);
        attempts++;
      }
      
      throw new Error('導航到表單申請頁面超時');
    } catch (error) {
      // 如果找不到按鈕，嘗試直接導航
      this.logger.warn('🤖 找不到表單申請按鈕，嘗試直接導航到表單頁面');
      await this.page.goto(CONFIG.URLS.APPLY_FORM_URL, { 
        waitUntil: 'domcontentloaded', 
        timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
      });
      
      const finalUrl = this.page.url();
      if (finalUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {
        this.logger.success('🤖 通過直接導航成功到達表單申請頁面');
        return;
      } else {
        await this.logger.takeScreenshot(this.page, 'navigation_failed');
        throw new Error(`導航失敗，當前 URL: ${finalUrl}`);
      }
    }
  }

  // === 主執行流程 ===
  async run(): Promise<void> {
    let browserStarted = false;
    
    try {
      this.logger.info('🤖 === 開始無頭模式自動補卡測試 ===');
      this.logger.info(`🤖 載入配置: ${this.userConfig.attendanceRecords.length} 筆補卡記錄，展開為 ${this.attendanceTasks.length} 個任務`);
      
      // Phase 1: 登入流程
      this.logger.info('🤖 >>> Phase 1: 開始無頭模式登入流程');
      await this.initializeBrowser();
      browserStarted = true;
      
      await this.performLogin();
      await this.navigateToFormApplication();
      this.logger.success('🤖 >>> Phase 1: 無頭模式登入流程完成');
      
      // Phase 2: 補卡流程
      this.logger.info('🤖 >>> Phase 2: 開始無頭模式補卡流程');
      
      // 簡化版：只處理第一個任務來驗證無頭模式
      if (this.attendanceTasks.length > 0) {
        const task = this.attendanceTasks[0];
        this.logger.info(`🤖 [測試] 處理任務: ${task.displayName}`);
        
        this.logger.info('🤖 由於這是無頭模式測試，目前停止在這裡');
        this.logger.info('🤖 如果到達這裡，說明無頭模式登入流程完全正常！');
        
        // TODO: 在確認無頭模式穩定後，可以繼續實施完整的補卡流程
      }
      
      this.logger.success('🤖 === 無頭模式測試執行完成 ===');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      this.logger.error(`🤖 程式執行失敗: ${errorMessage}`);
      
      if (error instanceof Error && error.stack) {
        this.logger.error('🤖 錯誤堆疊', { stack: error.stack });
      }
      
      throw error;
    } finally {
      if (this.browser && browserStarted) {
        try {
          await this.browser.close();
          this.logger.info('🤖 無頭模式瀏覽器已關閉');
        } catch (closeError) {
          this.logger.warn('🤖 關閉瀏覽器時發生錯誤', { error: closeError });
        }
      }
    }
  }
}

// === 程式進入點 ===
async function main(): Promise<void> {
  try {
    const system = new HeadlessAutoAttendanceSystem();
    await system.run();
    process.exit(0);
  } catch (error) {
    console.error('🤖 程式執行失敗:', error);
    process.exit(1);
  }
}

// 如果此檔案被直接執行，則啟動主程式
if (require.main === module) {
  main();
}

export { HeadlessAutoAttendanceSystem };

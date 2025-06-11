/**
 * 整合版自動補卡程式 v2
 * 
 * 專注於精確的選擇器，確保只操作 PRD 指定的三個欄位：
 * 1. 類型（#fm_attendancetype）
 * 2. 日期/時間（#fm_datetime）
 * 3. 地點（根據實際情況調整）
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page, Frame } from 'puppeteer';

// === 系統配置 ===
const CONFIG = {
  BROWSER: {
    HEADLESS: process.argv.includes('--headless'), // 🤖 支援命令行無頭模式
    ENABLE_SCREENSHOTS: true,
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
class IntegratedLogService {
  private logFilePath: string;

  constructor() {
    if (!fs.existsSync(CONFIG.PATHS.LOGS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.LOGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.PATHS.SCREENSHOTS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.SCREENSHOTS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFilePath = path.join(CONFIG.PATHS.LOGS_DIR, `integrated-v2-${timestamp}.log`);
  }

  private log(level: string, message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.padEnd(5)}] ${message}`;
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
    try {
      const timestamp = Date.now();
      const screenshotPath = path.join(CONFIG.PATHS.SCREENSHOTS_DIR, `${filename}_${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      this.info(`截圖已保存: ${screenshotPath}`);
    } catch (error) {
      this.warn('截圖失敗', { error: error instanceof Error ? error.message : '未知錯誤' });
    }
  }
}

// === 配置解析服務 ===
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

// === 整合版主程式 ===
class IntegratedAutoAttendanceSystemV2 {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: IntegratedLogService;
  private userConfig: UserConfig;
  private currentTaskIndex: number = 0;
  private attendanceTasks: AttendanceTask[] = [];
  private currentFormPage: Page | null = null;
  private hasDialogHandler: boolean = false;

  constructor() {
    this.logger = new IntegratedLogService();
    this.userConfig = ConfigService.loadUserConfig();
    this.attendanceTasks = this.expandAttendanceRecords();
  }

  // === Phase1 相關方法 ===
  
  private async initializeBrowser(): Promise<void> {
    this.logger.info(`正在啟動瀏覽器... ${CONFIG.BROWSER.HEADLESS ? '(無頭模式)' : '(有界面模式)'}`);
    
    try {
      // 根據模式調整啟動參數
      const launchOptions: any = {
        headless: CONFIG.BROWSER.HEADLESS,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        timeout: 30000,
        args: CONFIG.BROWSER.HEADLESS ? CONFIG.BROWSER.ARGS : [
          '--no-sandbox',
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--window-size=1600,960',
          '--window-position=0,0'
        ]
      };
      
      // 只在有界面模式下設置 viewport 為 null
      if (!CONFIG.BROWSER.HEADLESS) {
        launchOptions.defaultViewport = null;
      } else {
        launchOptions.defaultViewport = { width: 1366, height: 768 };
      }
      
      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();
      
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      this.logger.success(`瀏覽器啟動成功 ${CONFIG.BROWSER.HEADLESS ? '(無頭模式)' : '(有界面模式)'}`);
    } catch (error) {
      this.logger.error('瀏覽器啟動失敗', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('開始登入流程');
    
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
        this.logger.info('已處理登入彈出視窗');
      }
    } catch (error) {
      this.logger.info('無彈出視窗需要處理');
    }
    
    // 填寫登入表單
    await this.page.waitForSelector(SELECTORS.LOGIN.COMPANY_CODE, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    
    await this.page.type(SELECTORS.LOGIN.COMPANY_CODE, this.userConfig.loginInfo.companyCode, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.EMPLOYEE_NO, this.userConfig.loginInfo.username, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.PASSWORD, this.userConfig.loginInfo.password, { delay: CONFIG.DELAYS.INPUT_DELAY });
    
    this.logger.info('登入表單填寫完成');
    
    await this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON);
    await this.page.waitForTimeout(800);
    
    const currentUrl = this.page.url();
    if (currentUrl.includes('apollo.mayohr.com') && !currentUrl.includes('login')) {
      this.logger.success('登入成功');
      // 截圖檢查登入後的頁面狀態
      await this.logger.takeScreenshot(this.page, 'after_login_success');
    } else {
      throw new Error('登入失敗或頁面未正確導向');
    }
  }

  private async navigateToFormApplication(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('正在導航到表單申請頁面');
    
    // 先截圖檢查目前頁面狀態
    await this.logger.takeScreenshot(this.page, 'before_form_application_search');
    
    // 等待頁面穩定
    await this.page.waitForTimeout(2000);
    
    // 檢查當前 URL
    const currentUrl = this.page.url();
    this.logger.info('導航前 URL', { url: currentUrl });
    
    // 如果已經在表單申請頁面，直接返回
    if (currentUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {        
      this.logger.success('已在表單申請頁面');
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
          this.logger.success('成功導航到表單申請頁面');
          return;
        }
        await this.page.waitForTimeout(500);
        attempts++;
      }
      
      throw new Error('導航到表單申請頁面超時');
    } catch (error) {
      // 如果找不到按鈕，嘗試直接導航
      this.logger.warn('找不到表單申請按鈕，嘗試直接導航到表單頁面');
      await this.page.goto(CONFIG.URLS.APPLY_FORM_URL, { 
        waitUntil: 'domcontentloaded', 
        timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
      });
      
      const finalUrl = this.page.url();
      if (finalUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {
        this.logger.success('通過直接導航成功到達表單申請頁面');
        return;
      } else {
        await this.logger.takeScreenshot(this.page, 'navigation_failed');
        throw new Error(`導航失敗，當前 URL: ${finalUrl}`);
      }
    }
  }

  // === Phase2 相關方法 ===
  
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

  private async processAllAttendanceTasks(): Promise<void> {
    this.logger.info(`開始處理 ${this.attendanceTasks.length} 個補卡任務`);
    
    for (let i = 0; i < this.attendanceTasks.length; i++) {
      this.currentTaskIndex = i;
      const task = this.attendanceTasks[i];
      
      this.logger.info(`[${i + 1}/${this.attendanceTasks.length}] 處理任務: ${task.displayName}`);
      
      try {
        await this.processSingleAttendanceTask(task);
        this.logger.success(`任務 ${task.displayName} 完成`);
      } catch (error) {
        this.logger.error(`任務 ${task.displayName} 失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
        throw error; // 依照 PRD 要求，任一任務失敗立即終止
      }
    }
    
    this.logger.success('所有補卡任務處理完成');
  }

  private async processSingleAttendanceTask(task: AttendanceTask): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    let formPage: Page;
    
    // 檢查是否有現有的表單頁面可以重用
    if (this.currentFormPage && !this.currentFormPage.isClosed()) {
      this.logger.info('重用現有表單頁面');
      formPage = this.currentFormPage;
      
      if (!this.hasDialogHandler) {
        this.setupDialogHandler(formPage);
        this.hasDialogHandler = true;
      } else {
        this.logger.info('分頁已設置 dialog 事件處理器，跳過');
      }
    } else {
      // 開啟新的表單頁面
      this.logger.info('開啟新的補卡表單頁面');
      await this.clickForgetPunchLink();
      formPage = await this.waitForNewPageAndSwitch();
      this.currentFormPage = formPage;
      this.hasDialogHandler = true;
    }
    
    try {
      // 在表單頁面中處理
      await this.fillAttendanceForm(formPage, task);
      await this.submitAttendanceForm(formPage);
      
      // 檢查是否還有任務需要處理
      const remainingTasks = this.attendanceTasks.length - this.currentTaskIndex - 1;
      
      if (formPage.isClosed()) {
        // 表單已自動關閉，表示送簽成功
        this.logger.success(`任務 ${task.displayName} 完成`);
        this.currentFormPage = null;
        this.hasDialogHandler = false;
      } else if (remainingTasks > 0) {
        // 表單仍開啟且有剩餘任務，可能是遇到重複警告，可以在同一表單繼續
        this.logger.info(`任務 ${task.displayName} 有警告但已處理，在同一表單中繼續下一個任務`);
        // 保持 currentFormPage 和 hasDialogHandler 狀態
      } else {
        // 最後一個任務，關閉表單
        this.logger.success(`任務 ${task.displayName} 完成`);
        this.currentFormPage = null;
        this.hasDialogHandler = false;
      }
      
    } finally {
      // 只在程式結束或表單自動關閉時才清理
      if (!this.currentFormPage || this.currentFormPage.isClosed()) {
        // 安全地關閉新分頁：檢查分頁是否已關閉
        try {
          if (formPage && !formPage.isClosed()) {
            await formPage.close();
            this.logger.info('表單分頁已關閉');
          } else {
            this.logger.info('表單分頁已自動關閉');
          }
        } catch (closeError) {
          this.logger.warn('關閉表單分頁時發生錯誤，可能已自動關閉', { error: closeError instanceof Error ? closeError.message : '未知錯誤' });
        }
        
        // 切換回表單申請頁面
        if (this.browser) {
          const pages = await this.browser.pages();
          let formApplicationPage = null;
          
          // 尋找表單申請頁面（不是 about:blank）
          for (const page of pages) {
            const url = page.url();
            if (url.includes('flow.mayohr.com/GAIA/bpm/applyform') || 
                url.includes('apollo.mayohr.com') && !url.includes('about:blank')) {
              formApplicationPage = page;
              break;
            }
          }
          
          if (formApplicationPage) {
            this.page = formApplicationPage;
            await this.page.bringToFront();
            this.logger.info('已切換回表單申請頁面', { url: this.page.url() });
          } else {
            // 如果找不到，使用第一個非空白頁面
            const nonBlankPages = pages.filter(p => !p.url().includes('about:blank'));
            if (nonBlankPages.length > 0) {
              this.page = nonBlankPages[0];
              await this.page.bringToFront();
              this.logger.info('已切換回主頁面（非空白頁面）', { url: this.page.url() });
            } else {
              this.logger.warn('未找到合適的頁面，使用預設頁面');
              this.page = pages[0];
            }
          }
        }
      }
    }
  }

  private async clickForgetPunchLink(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    try {
      const link = await this.page.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (link) {
        await link.click();
      } else {
        throw new Error('找不到忘打卡申請單連結');
      }
    } catch (error) {
      // 嘗試替代選擇器
      const altLink = await this.page.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK_ALT, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (altLink) {
        await altLink.click();
      } else {
        throw new Error('找不到忘打卡申請單連結（包含替代選擇器）');
      }
    }
    
    await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
  }

  private async waitForNewPageAndSwitch(): Promise<Page> {
    if (!this.browser) throw new Error('瀏覽器未初始化');
    
    const pages = await this.browser.pages();
    const initialPageCount = pages.length;
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const currentPages = await this.browser.pages();
      if (currentPages.length > initialPageCount) {
        const newPage = currentPages[currentPages.length - 1];
        await newPage.waitForTimeout(CONFIG.TIMEOUTS.FORM_LOAD);
        
        // 為新分頁設置原生對話框處理器
        this.setupDialogHandler(newPage);
        
        return newPage;
      }
      await this.page!.waitForTimeout(500);
      attempts++;
    }
    
    throw new Error('等待新分頁開啟超時');
  }

  private setupDialogHandler(page: Page): void {
    this.logger.info('為分頁設置 dialog 事件處理器');
    
    page.on('dialog', async (dialog) => {
      const message = dialog.message();
      this.logger.info(`檢測到瀏覽器原生彈窗: ${message}`);
      
      // 檢查是否為補卡重複警告
      if (message.includes('當日已有') && (message.includes('上班') || message.includes('下班')) && message.includes('打卡紀錄')) {
        this.logger.info('檢測到補卡重複警告彈窗，自動點擊確定');
        await dialog.accept();
      } else {
        this.logger.info('檢測到其他彈窗，自動點擊確定');
        await dialog.accept();
      }
    });
  }

  private async fillAttendanceForm(page: Page, task: AttendanceTask): Promise<void> {
    this.logger.info(`填寫表單: ${task.displayName}`);
    
    // 截圖：表單載入後
    await this.logger.takeScreenshot(page, 'form_loaded');
    
    // 等待並切換到 main iframe
    const mainFrame = await this.waitForFrame(page, SELECTORS.IFRAMES.MAIN);
    
    // 按照 PRD 要求，只處理這三個欄位：
    // 1. 類型
    this.logger.info('開始填寫類型欄位');
    await this.selectAttendanceType(mainFrame, task.type);
    await this.logger.takeScreenshot(page, 'after_type_selection');
    
    // 2. 日期/時間
    this.logger.info('開始填寫日期/時間欄位');
    await this.setDateTime(mainFrame, task);
    await this.logger.takeScreenshot(page, 'after_datetime_selection');
    
    // 3. 地點
    this.logger.info('開始填寫地點欄位');
    await this.selectLocation(mainFrame);
    await this.logger.takeScreenshot(page, 'after_location_selection');
    
    this.logger.info('表單填寫完成');
  }

  private async waitForFrame(page: Page, selector: string): Promise<Frame> {
    await page.waitForSelector(selector, { timeout: CONFIG.TIMEOUTS.IFRAME_WAIT });
    const frameElement = await page.$(selector);
    const frame = await frameElement?.contentFrame();
    
    if (!frame) {
      throw new Error(`無法取得 iframe: ${selector}`);
    }
    
    return frame;
  }

  // === 精確的表單填寫方法（只操作指定欄位） ===
  
  private async selectAttendanceType(frame: Frame, type: 'CLOCK_IN' | 'CLOCK_OUT'): Promise<void> {
    this.logger.info(`選擇補卡類型: ${type === 'CLOCK_IN' ? '上班' : '下班'}`);
    
    // 等待類型欄位容器載入
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_CONTAINER, { 
      timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
    });
    
    const optionValue = type === 'CLOCK_IN' ? '1' : '2';
    const optionText = type === 'CLOCK_IN' ? '上班' : '下班';
    
    try {
      // 方法 1: 先嘗試直接使用隱藏的 select 元素
      const selectElement = await frame.$(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT);
      if (selectElement) {
        await frame.select(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT, optionValue);
        this.logger.info(`成功使用 select 方法選擇類型: ${optionText} (value=${optionValue})`);
      } else {
        throw new Error('找不到 select 元素');
      }
    } catch (error) {
      // 方法 2: 嘗試點擊 Kendo UI 下拉選單
      try {
        this.logger.info('嘗試使用 Kendo UI 下拉選單');
        
        // 點擊下拉選單開啟選項
        await frame.click(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_DROPDOWN);
        await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
        
        // 等待選項列表出現並點擊對應選項
        const success = await frame.evaluate((text) => {
          const options = Array.from(document.querySelectorAll('li[data-offset-index]'));
          const targetOption = options.find(option => option.textContent?.trim() === text);
          if (targetOption) {
            (targetOption as HTMLElement).click();
            return true;
          }
          return false;
        }, optionText);
        
        if (success) {
          this.logger.info(`成功使用 Kendo UI 選擇類型: ${optionText}`);
        } else {
          throw new Error('無法在選項列表中找到目標選項');
        }
      } catch (kendoError) {
        throw new Error(`無法選擇補卡類型: ${error instanceof Error ? error.message : '未知錯誤'}`);
      }
    }
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private async setDateTime(frame: Frame, task: AttendanceTask): Promise<void> {
    this.logger.info(`設定日期時間: ${task.date}`);
    
    // 等待日期/時間容器載入
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.DATETIME_CONTAINER, { 
      timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
    });
    
    try {
      // 先點擊日曆按鈕來開啟日期選擇器
      this.logger.info('點擊日曆按鈕開啟日期選擇器');
      await frame.click(SELECTORS.ATTENDANCE_FORM.DATETIME_CALENDAR_BUTTON);
      await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
      
      // 解析目標日期
      const [year, month, day] = task.date.split('/').map(num => parseInt(num));
      this.logger.info(`目標日期: ${year}年${month}月${day}日`);
      
      // 等待日期選擇器出現
      await frame.waitForSelector('.k-calendar', { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      
      // 選擇年份和月份（如果需要的話）
      await this.navigateToTargetMonth(frame, year, month);
      
      // 點擊目標日期
      await this.selectTargetDay(frame, day);
      
      this.logger.info(`成功設定日期: ${task.date}`);
    } catch (error) {
      this.logger.error(`日期設定失敗: ${error}`);
      
      // 嘗試備用方法：直接設定輸入框的值
      try {
        this.logger.info('嘗試備用日期設定方法');
        await frame.evaluate((selector, dateValue) => {
          const input = document.querySelector(selector) as HTMLInputElement;
          if (input) {
            // 設定為當天上午9點的格式
            const formattedDate = dateValue + ' 09:00:00';
            input.value = formattedDate;
            
            // 觸發各種可能的事件
            ['input', 'change', 'blur'].forEach(eventType => {
              const event = new Event(eventType, { bubbles: true });
              input.dispatchEvent(event);
            });
          }
        }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT, task.date);
        
        this.logger.info('備用方法設定完成');
      } catch (backupError) {
        throw new Error(`無法設定日期時間: ${task.date} - ${error instanceof Error ? error.message : '未知錯誤'}`);
      }
    }
    
    // 最終驗證：檢查輸入框中的日期是否正確
    await this.verifyDateInput(frame, task);
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private async verifyDateInput(frame: Frame, task: AttendanceTask): Promise<void> {
    try {
      const inputValue = await frame.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        return input ? input.value : '';
      }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT);
      
      this.logger.info(`日期輸入框當前值: "${inputValue}"`);
      
      // 檢查日期是否包含正確的年月日
      const [targetYear, targetMonth, targetDay] = task.date.split('/');
      const expectedDateParts = [targetYear, targetMonth.padStart(2, '0'), targetDay.padStart(2, '0')];
      
      let isCorrect = true;
      for (const part of expectedDateParts) {
        if (!inputValue.includes(part)) {
          isCorrect = false;
          break;
        }
      }
      
      if (!isCorrect) {
        this.logger.warn(`日期驗證失敗，期望包含 ${expectedDateParts.join('/')}, 實際值: ${inputValue}`);
        
        // 嘗試強制設定正確的日期
        await this.forceSetCorrectDate(frame, task);
      } else {
        this.logger.success(`日期驗證成功: ${inputValue} 包含期望的日期 ${task.date}`);
      }
      
    } catch (error) {
      this.logger.warn('日期驗證過程發生錯誤', { error: error instanceof Error ? error.message : '未知錯誤' });
    }
  }

  private async forceSetCorrectDate(frame: Frame, task: AttendanceTask): Promise<void> {
    this.logger.info(`強制設定正確日期: ${task.date}`);
    
    try {
      // 直接設定輸入框的值為正確的日期時間格式
      const timeValue = task.type === 'CLOCK_IN' ? '09:00:00' : '18:00:00';
      const correctDateTime = `${task.date} ${timeValue}`;
      
      await frame.evaluate((selector, dateTime) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          input.value = dateTime;
          
          // 觸發所有可能的事件來確保變更被識別
          ['focus', 'input', 'change', 'blur'].forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            input.dispatchEvent(event);
          });
        }
      }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT, correctDateTime);
      
      await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
      
      // 再次驗證
      const finalValue = await frame.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        return input ? input.value : '';
      }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT);
      
      this.logger.info(`強制設定後的日期值: "${finalValue}"`);
      
    } catch (error) {
      this.logger.error('強制設定日期失敗', { error: error instanceof Error ? error.message : '未知錯誤' });
    }
  }

  private async navigateToTargetMonth(frame: Frame, targetYear: number, targetMonth: number): Promise<void> {
    this.logger.info(`導航到目標月份: ${targetYear}年${targetMonth}月`);
    
    // 等待日曆完全載入
    await frame.waitForSelector('.k-calendar', { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    
    // 獲取當前顯示的年月 - 根據 Kendo UI 文件和實際截圖
    const getCurrentMonth = async (): Promise<{ year: number; month: number } | null> => {
      return await frame.evaluate(() => {
        // 月份標題通常在 .k-nav-fast 中，格式可能是 "六月 2025" 或 "June 2025"
        const titleElement = document.querySelector('.k-nav-fast');
        if (!titleElement || !titleElement.textContent) {
          return null;
        }
        
        const titleText = titleElement.textContent.trim();
        
        // 嘗試解析中文格式 "六月 2025"
        const chineseMatch = titleText.match(/([一二三四五六七八九十]+)月\s*(\d{4})/);
        if (chineseMatch) {
          const monthMap: { [key: string]: number } = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
            '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12
          };
          const month = monthMap[chineseMatch[1]];
          const year = parseInt(chineseMatch[2]);
          if (month && year) {
            return { year, month };
          }
        }
        
        // 嘗試解析英文格式 "June 2025" 或其他可能格式
        const englishMatch = titleText.match(/(\w+)\s*(\d{4})/);
        if (englishMatch) {
          const monthMap: { [key: string]: number } = {
            'January': 1, 'February': 2, 'March': 3, 'April': 4,
            'May': 5, 'June': 6, 'July': 7, 'August': 8,
            'September': 9, 'October': 10, 'November': 11, 'December': 12
          };
          const month = monthMap[englishMatch[1]];
          const year = parseInt(englishMatch[2]);
          if (month && year) {
            return { year, month };
          }
        }
        
        // 如果無法解析，返回 null
        return null;
      });
    };
    
    // 獲取當前月份
    let currentYearMonth = await getCurrentMonth();
    if (!currentYearMonth) {
      this.logger.warn('無法解析當前年月，嘗試使用當前日期');
      const now = new Date();
      currentYearMonth = {
        year: now.getFullYear(),
        month: now.getMonth() + 1 // JavaScript 月份從 0 開始
      };
    }
    
    this.logger.info(`當前顯示: ${currentYearMonth.year}年${currentYearMonth.month}月`);
    this.logger.info(`目標日期: ${targetYear}年${targetMonth}月`);
    
    // 如果年份不同，記錄警告但不處理（一般補卡都在當年）
    if (currentYearMonth.year !== targetYear) {
      this.logger.warn(`年份不同，當前: ${currentYearMonth.year}, 目標: ${targetYear}`);
    }
    
    // 計算需要導航的月份差
    let monthDiff = targetMonth - currentYearMonth.month;
    this.logger.info(`月份差: ${monthDiff}`);
    
    // 導航到目標月份
    let attempts = 0;
    const maxAttempts = 12; // 最多嘗試 12 次（一年）
    
    while (monthDiff !== 0 && attempts < maxAttempts) {
      attempts++;
      
      if (monthDiff > 0) {
        // 需要往後翻月（下個月）
        this.logger.info(`點擊下一月按鈕 (剩餘 ${monthDiff} 個月)`);
        await frame.click('.k-nav-next');
        monthDiff--;
      } else {
        // 需要往前翻月（上個月）
        this.logger.info(`點擊上一月按鈕 (剩餘 ${Math.abs(monthDiff)} 個月)`);
        await frame.click('.k-nav-prev');
        monthDiff++;
      }
      
      // 等待月份切換完成
      await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
      
      // 驗證月份是否已經切換
      const newYearMonth = await getCurrentMonth();
      if (newYearMonth) {
        this.logger.info(`月份已切換到: ${newYearMonth.year}年${newYearMonth.month}月`);
        // 重新計算月份差
        monthDiff = targetMonth - newYearMonth.month;
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error(`月份導航超時，嘗試 ${attempts} 次後仍無法到達目標月份`);
    }
    
    this.logger.success(`成功導航到 ${targetYear}年${targetMonth}月`);
  }

  private async selectTargetDay(frame: Frame, targetDay: number): Promise<void> {
    this.logger.info(`選擇目標日期: ${targetDay}日`);
    
    // 等待日曆穩定
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    
    // 在日曆中點擊目標日期，確保點擊的是當前月份的日期（不是其他月份的日期）
    const daySelector = `td[role="gridcell"]:not(.k-other-month)`;
    
    const clickResult = await frame.evaluate((selector, day) => {
      const dayCells = Array.from(document.querySelectorAll(selector));
      
      // 過濾出當前月份的日期格子（排除 .k-other-month 類別）
      const currentMonthCells = dayCells.filter(cell => 
        !cell.classList.contains('k-other-month')
      );
      
      const targetCell = currentMonthCells.find(cell => {
        const dayText = cell.textContent?.trim();
        return dayText === day.toString();
      });
      
      if (targetCell) {
        (targetCell as HTMLElement).click();
        return true;
      }
      return false;
    }, daySelector, targetDay);

    if (!clickResult) {
      throw new Error(`無法找到目標日期 ${targetDay} 在當前月份中`);
    }
    
    this.logger.info(`成功點擊日期: ${targetDay}日`);
    
    // 等待日期選擇器關閉
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    
    // 驗證日期是否已正確設定
    try {
      await frame.waitForSelector('.k-calendar', { timeout: 1000, hidden: true });
      this.logger.info('日期選擇器已關閉');
    } catch (error) {
      this.logger.info('日期選擇器可能仍開啟，嘗試點擊其他區域關閉');
      // 點擊日曆外的區域來關閉日期選擇器
      await frame.click('body');
      await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    }
  }

  private async selectLocation(frame: Frame): Promise<void> {
    this.logger.info('選擇地點: TNLMG');
    
    // 等待地點欄位容器載入
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.LOCATION_CONTAINER, { 
      timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
    });
    
    try {
      // 方法 1: 先嘗試直接使用隱藏的 select 元素
      const selectElement = await frame.$(SELECTORS.ATTENDANCE_FORM.LOCATION_SELECT);
      if (selectElement) {
        await frame.select(SELECTORS.ATTENDANCE_FORM.LOCATION_SELECT, SELECTORS.ATTENDANCE_FORM.LOCATION_TNLMG_VALUE);
        this.logger.info(`成功使用 select 方法選擇地點: TNLMG (value=${SELECTORS.ATTENDANCE_FORM.LOCATION_TNLMG_VALUE})`);
      } else {
        throw new Error('找不到地點 select 元素');
      }
    } catch (error) {
      // 方法 2: 嘗試點擊 Kendo UI 下拉選單
      try {
        this.logger.info('嘗試使用 Kendo UI 下拉選單選擇地點');
        
        // 點擊地點下拉選單開啟選項
        await frame.click(SELECTORS.ATTENDANCE_FORM.LOCATION_DROPDOWN);
        await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
        
        // 等待選項列表出現並點擊 TNLMG 選項
        const success = await frame.evaluate(() => {
          const options = Array.from(document.querySelectorAll('li[data-offset-index]'));
          const targetOption = options.find(option => option.textContent?.trim() === 'TNLMG');
          if (targetOption) {
            (targetOption as HTMLElement).click();
            return true;
          }
          return false;
        });
        
        if (success) {
          this.logger.info('成功使用 Kendo UI 選擇地點: TNLMG');
        } else {
          throw new Error('無法在選項列表中找到 TNLMG 選項');
        }
      } catch (kendoError) {
        this.logger.warn(`地點選擇失敗，但繼續執行: ${error instanceof Error ? error.message : '未知錯誤'}`);
      }
    }
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private async submitAttendanceForm(page: Page): Promise<void> {
    this.logger.info('準備送簽表單');
    
    // 切換到 banner iframe 找送簽按鈕
    const bannerFrame = await this.waitForFrame(page, SELECTORS.IFRAMES.BANNER);
    
    // 點擊送簽按鈕
    try {
      const submitButton = await bannerFrame.waitForSelector(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (submitButton) {
        await submitButton.click();
        this.logger.info('點擊送簽按鈕');
      }
    } catch (error) {
      // 嘗試替代選擇器
      const altSubmitButton = await bannerFrame.waitForSelector(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON_ALT, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (altSubmitButton) {
        await altSubmitButton.click();
        this.logger.info('點擊送簽按鈕（替代選擇器）');
      }
    }
    
    // 處理可能的確認對話框和送簽結果
    await this.handleSubmitResult(page);
    
    this.logger.success('表單送簽完成');
  }

  private async handleSubmitResult(page: Page): Promise<void> {
    this.logger.info('處理送簽結果...');
    
    try {
      // 先處理可能的確認對話框
      await this.handleConfirmationDialog(page);
      
      // 等待一段時間檢查送簽結果
      await page.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
      
      // 檢查頁面是否已關閉（成功的情況）
      if (page.isClosed()) {
        this.logger.success('表單分頁已自動關閉，送簽成功');
        return;
      }
      
      // 如果頁面還開著，可能有提示訊息需要處理
      this.logger.info('表單分頁仍開啟，檢查是否有提示訊息...');
      
      // 檢查是否有「當日已有打卡紀錄」提示
      try {
        // 等待可能的提示訊息彈出
        await page.waitForTimeout(1000);
        
        // 檢查頁面是否仍然開啟
        if (!page.isClosed()) {
          this.logger.info('表單分頁仍開啟，可能遇到重複補卡警告，已由原生彈窗處理器處理');
        } else {
          this.logger.success('表單分頁已自動關閉，送簽成功');
        }
      } catch (error) {
        this.logger.warn('檢查提示訊息時發生錯誤', { error: error instanceof Error ? error.message : '未知錯誤' });
      }
      
    } catch (error) {
      this.logger.error('處理送簽結果失敗', { error: error instanceof Error ? error.message : '未知錯誤' });
      throw error;
    }
  }

  private async handleConfirmationDialog(page: Page): Promise<void> {
    try {
      // 等待可能的確認對話框
      const confirmButton = await page.waitForSelector(SELECTORS.ATTENDANCE_FORM.CONFIRM_BUTTON, { 
        timeout: 3000 
      });
      if (confirmButton) {
        await confirmButton.click();
        this.logger.info('已處理確認對話框');
      }
    } catch (error) {
      this.logger.info('無確認對話框需要處理');
    }
  }

  // === 主執行流程 ===
  
  async run(): Promise<void> {
    let browserStarted = false;
    
    try {
      this.logger.info('=== 開始整合版自動補卡程式 v2 ===');
      this.logger.info(`載入配置: ${this.userConfig.attendanceRecords.length} 筆補卡記錄，展開為 ${this.attendanceTasks.length} 個任務`);
      
      // Phase 1: 登入流程
      this.logger.info('>>> Phase 1: 開始登入流程');
      await this.initializeBrowser();
      browserStarted = true;
      
      await this.performLogin();
      await this.navigateToFormApplication();
      this.logger.success('>>> Phase 1: 登入流程完成');
      
      // Phase 2: 補卡流程
      this.logger.info('>>> Phase 2: 開始補卡流程');
      await this.processAllAttendanceTasks();
      this.logger.success('>>> Phase 2: 補卡流程完成');
      
      this.logger.success('=== 整合版自動補卡程式 v2 執行完成 ===');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      this.logger.error(`程式執行失敗: ${errorMessage}`);
      
      if (error instanceof Error && error.stack) {
        this.logger.error('錯誤堆疊', { stack: error.stack });
      }
      
      throw error;
    } finally {
      if (this.browser && browserStarted) {
        try {
          await this.browser.close();
          this.logger.info('瀏覽器已關閉');
        } catch (closeError) {
          this.logger.warn('關閉瀏覽器時發生錯誤', { error: closeError });
        }
      }
    }
  }
}

// === 程式進入點 ===
async function main(): Promise<void> {
  try {
    const system = new IntegratedAutoAttendanceSystemV2();
    await system.run();
    process.exit(0);
  } catch (error) {
    console.error('程式執行失敗:', error);
    process.exit(1);
  }
}

// 如果此檔案被直接執行，則啟動主程式
if (require.main === module) {
  main();
}

export { IntegratedAutoAttendanceSystemV2 };

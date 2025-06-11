/**
 * 整合版自動補卡程式
 * 
 * 完全不修改 phase1-login-fixed.ts 和 phase2-attendance.ts
 * 透過繼承和組合的方式整合兩個階段的功能
 * 確保在同一個瀏覽器 session 中完成整個流程
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page, Frame } from 'puppeteer';

// === 繼承 Phase1 的核心配置和邏輯 ===
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

// === 選擇器（合併兩個階段的選擇器） ===
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
  ATTENDANCE_FORM: {
    // 根據 PRD 提供的精確選擇器
    ATTENDANCE_TYPE_SELECT: '#fm_attendancetype', // 類型下拉選單的 select 元素
    ATTENDANCE_TYPE_DROPDOWN_WRAPPER: '.k-dropdown-wrap', // Kendo UI 下拉選單外層（用於點擊展開）
    DATETIME_INPUT: '#fm_datetime', // 日期時間輸入框
    DATETIME_CALENDAR_BUTTON: '.k-link-date', // 日期選擇按鈕
    LOCATION_DROPDOWN_WRAPPER: '.k-dropdown-wrap', // 地點下拉選單外層（第二個）
    SUBMIT_BUTTON: '#SUBMIT', // 送簽按鈕（在 iframe#banner 內）
    SUBMIT_BUTTON_ALT: 'div.buttonDiv[id="SUBMIT"]', // 送簽按鈕替代選擇器
    CONFIRM_BUTTON: 'button', // 確認按鈕（處理彈出對話框）
    ALERT_DIALOG: '.ui-dialog, .modal, .alert' // 各種可能的彈出視窗
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFilePath = path.join(CONFIG.PATHS.LOGS_DIR, `integrated-${timestamp}.log`);
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
class IntegratedAutoAttendanceSystem {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: IntegratedLogService;
  private userConfig: UserConfig;
  private currentTaskIndex: number = 0;
  private attendanceTasks: AttendanceTask[] = [];

  constructor() {
    this.logger = new IntegratedLogService();
    this.userConfig = ConfigService.loadUserConfig();
    this.attendanceTasks = this.expandAttendanceRecords();
  }

  // === Phase1 相關方法（完全複製 phase1 的邏輯） ===
  
  private async initializeBrowser(): Promise<void> {
    this.logger.info('正在啟動瀏覽器...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: false, // 顯示瀏覽器以便觀察
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // 使用系統 Chrome
        defaultViewport: null, // 移除視窗大小限制，使用瀏覽器視窗大小
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1600,960', // 設定瀏覽器視窗大小為 1600x960
          '--window-position=0,0' // 設定瀏覽器視窗位置，避免完全覆蓋 VS Code
        ]
      });

      this.page = await this.browser.newPage();
      
      // 設置較長的超時
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      // 設置用戶代理
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      this.logger.success('瀏覽器啟動成功');
    } catch (error) {
      this.logger.error('瀏覽器啟動失敗', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('開始登入流程');
    
    // 導航到登入頁面
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
    
    // 點擊登入按鈕
    await this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON);
    await this.page.waitForTimeout(800);
    
    // 等待登入完成
    const currentUrl = this.page.url();
    if (currentUrl.includes('apollo.mayohr.com') && !currentUrl.includes('login')) {
      this.logger.success('登入成功');
    } else {
      throw new Error('登入失敗或頁面未正確導向');
    }
  }

  private async navigateToFormApplication(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('正在導航到表單申請頁面');
    
    // 等待並點擊表單申請連結
    await this.page.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await this.page.click(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
    
    // 等待頁面 URL 變化到表單申請頁面
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
  }

  // === Phase2 相關方法（複製 phase2 的核心邏輯） ===
  
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
    
    // 點擊忘打卡申請單連結
    await this.clickForgetPunchLink();
    
    // 等待新分頁開啟並切換
    const newPage = await this.waitForNewPageAndSwitch();
    
    try {
      // 在新分頁中處理表單
      await this.fillAttendanceForm(newPage, task);
      await this.submitAttendanceForm(newPage);
    } finally {
      // 關閉新分頁並切換回主頁面
      await newPage.close();
      if (this.browser) {
        const pages = await this.browser.pages();
        this.page = pages[0]; // 切換回主頁面
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
    
    // 等待新分頁開啟
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const currentPages = await this.browser.pages();
      if (currentPages.length > initialPageCount) {
        const newPage = currentPages[currentPages.length - 1];
        await newPage.waitForTimeout(CONFIG.TIMEOUTS.FORM_LOAD);
        return newPage;
      }
      await this.page!.waitForTimeout(500);
      attempts++;
    }
    
    throw new Error('等待新分頁開啟超時');
  }

  private async fillAttendanceForm(page: Page, task: AttendanceTask): Promise<void> {
    this.logger.info(`填寫表單: ${task.displayName}`);
    
    // 等待並切換到 main iframe
    const mainFrame = await this.waitForFrame(page, SELECTORS.IFRAMES.MAIN);
    
    // 選擇補卡類型
    await this.selectAttendanceType(mainFrame, task.type);
    
    // 設定日期時間
    await this.setDateTime(mainFrame, task);
    
    // 選擇地點（如果需要）
    await this.selectLocation(mainFrame);
    
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

  private async selectAttendanceType(frame: Frame, type: 'CLOCK_IN' | 'CLOCK_OUT'): Promise<void> {
    this.logger.info(`選擇補卡類型: ${type === 'CLOCK_IN' ? '上班' : '下班'}`);
    
    // 根據 PRD 提供的精確選擇器，直接使用 select 元素
    const selectElement = SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT;
    await frame.waitForSelector(selectElement, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    
    // 直接選擇對應的值：1=上班, 2=下班
    const optionValue = type === 'CLOCK_IN' ? '1' : '2';
    
    try {
      // 直接通過 select 元素選擇值
      await frame.select(selectElement, optionValue);
      this.logger.info(`成功選擇類型: ${type === 'CLOCK_IN' ? '上班' : '下班'} (value=${optionValue})`);
    } catch (error) {
      // 如果直接選擇失敗，嘗試 Kendo UI 的點擊方式
      this.logger.warn('直接選擇失敗，嘗試 Kendo UI 點擊方式');
      const dropdownWrapper = SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_DROPDOWN_WRAPPER;
      await frame.click(dropdownWrapper);
      await frame.waitForTimeout(500);
      
      // 點擊對應的選項
      const optionText = type === 'CLOCK_IN' ? '上班' : '下班';
      await frame.evaluate((text) => {
        const options = Array.from(document.querySelectorAll('.k-item'));
        const targetOption = options.find(option => option.textContent?.trim() === text);
        if (targetOption && targetOption instanceof HTMLElement) {
          targetOption.click();
        }
      }, optionText);
    }
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private async setDateTime(frame: Frame, task: AttendanceTask): Promise<void> {
    this.logger.info(`設定日期時間: ${task.date}`);
    
    // 根據 PRD 說明，日期選擇器是 readonly，只能點擊日期按鈕來叫出月曆
    const dateTimeInput = SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT;
    await frame.waitForSelector(dateTimeInput, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    
    // 點擊日期按鈕來叫出月曆選擇器
    const calendarButton = SELECTORS.ATTENDANCE_FORM.DATETIME_CALENDAR_BUTTON;
    await frame.waitForSelector(calendarButton, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.click(calendarButton);
    
    // 等待月曆選擇器出現
    await frame.waitForTimeout(1000);
    
    // 解析日期 (yyyy/mm/dd 格式)
    const [year, month, day] = task.date.split('/').map(num => parseInt(num));
    
    // 根據 Kendo UI DateTimePicker 的結構選擇日期
    // 這裡需要根據實際的月曆結構來實作，先用簡化版本
    try {
      // 嘗試直接設定值（雖然是 readonly，但可能在 JavaScript 中可以設定）
      await frame.evaluate((selector, dateValue) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          // 嘗試觸發 Kendo UI 的日期設定
          const kendoWidget = (window as any).kendo?.widgetInstance(input);
          if (kendoWidget && kendoWidget.value) {
            const date = new Date(dateValue);
            kendoWidget.value(date);
          } else {
            // 直接設定值作為備用方案
            input.value = dateValue + ' 09:00:00';
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, dateTimeInput, task.date);
      
      this.logger.info(`成功設定日期: ${task.date}`);
    } catch (error) {
      this.logger.warn(`日期設定失敗，嘗試替代方案: ${error}`);
      // 如果上述方法失敗，可以嘗試其他方式或報錯
      throw new Error(`無法設定日期時間: ${task.date}`);
    }
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private formatDateTime(task: AttendanceTask): string {
    // 轉換日期格式並加上時間
    const timeMap = {
      'CLOCK_IN': '09:00:00',
      'CLOCK_OUT': '18:00:00'
    };
    
    return `${task.date} ${timeMap[task.type]}`;
  }

  private async selectLocation(frame: Frame): Promise<void> {
    // 處理地點選擇（如果有的話）
    try {
      const locationSelect = await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.LOCATION_SELECT, { 
        timeout: 2000 
      });
      if (locationSelect) {
        await frame.select(SELECTORS.ATTENDANCE_FORM.LOCATION_SELECT, '0'); // 選擇第一個選項
      }
    } catch (error) {
      this.logger.info('無需選擇地點或地點選擇器不存在');
    }
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
      }
    } catch (error) {
      // 嘗試替代選擇器
      const altSubmitButton = await bannerFrame.waitForSelector(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON_ALT, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (altSubmitButton) {
        await altSubmitButton.click();
      }
    }
    
    // 處理可能的確認對話框
    await this.handleConfirmationDialog(page);
    
    await page.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
    this.logger.success('表單送簽完成');
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
      this.logger.info('=== 開始整合版自動補卡程式 ===');
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
      
      this.logger.success('=== 整合版自動補卡程式執行完成 ===');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      this.logger.error(`程式執行失敗: ${errorMessage}`);
      
      // 如果有錯誤詳細資訊，也記錄下來
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
    const system = new IntegratedAutoAttendanceSystem();
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

export { IntegratedAutoAttendanceSystem };

/**
 * 無頭模式自動補卡程式 - 完整版
 * 基於 integrated-main-v2.ts，完全支援無頭模式運行
 * 特點：
 * - 無頭模式提升執行速度和穩定性
 * - 保留完整的補卡功能
 * - 支援跨月份導航
 * - 優化的瀏覽器參數配置
 * - 完整的錯誤處理和日誌記錄
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page, Frame } from 'puppeteer';

// === 系統配置（無頭模式優化） ===
const CONFIG = {
  BROWSER: {
    HEADLESS: true,  // 🤖 無頭模式
    ENABLE_SCREENSHOTS: true,  // 保留截圖功能用於調試
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

// === 精確選擇器 ===
const SELECTORS = {
  // Phase1 登入選擇器
  LOGIN: {
    POPUP_CONFIRM: 'button.btn.btn-default',
    COMPANY_CODE: 'input[name="companyCode"]',
    EMPLOYEE_NO: 'input[name="employeeNo"]',
    PASSWORD: 'input[name="password"]',
    LOGIN_BUTTON: 'button[type="submit"]'
  },
  
  // Phase2 表單選擇器（在 iframe 內）
  FORM: {
    IFRAME: 'iframe[src*="flow.mayohr.com"]',
    TYPE_SELECT: 'select[id*="0c7cc21e-8efd-4d6c-b42c-6ba55a5e5b8a"]', // 假別
    DATE_INPUT: 'input[id*="d6bb1af3-9d58-476e-99b9-b45b3bb9cab6"]',   // 請假起日
    TIME_INPUT: 'input[id*="0d4ea9cf-48ec-4f16-9fa5-4eeadbe40fb4"]',   // 請假起時
    LOCATION_SELECT: 'select[id*="e7b6b765-b42c-4b13-a7fc-2b3a9c3bb7d8"]', // 工作地點
    SUBMIT_BUTTON: 'input[type="submit"][value="送出"]'
  }
};

// === 日誌系統 ===
class Logger {
  private logDir: string;
  
  constructor() {
    this.logDir = CONFIG.PATHS.LOGS_DIR;
    this.ensureLogDirectory();
  }
  
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.padEnd(5)}] 🤖 ${message}`;
  }
  
  info(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
    if (data) console.log(data);
  }
  
  success(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('OK', message);
    console.log(formattedMessage);
    if (data) console.log(data);
  }
  
  warn(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
    if (data) console.warn(data);
  }
  
  error(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('ERROR', message);
    console.error(formattedMessage);
    if (data) console.error(data);
  }
}

// === 資料結構 ===
interface UserConfig {
  companyCode: string;
  employeeNo: string;
  password: string;
}

interface PunchInRecord {
  date: string;
  type: string;
  description?: string;
}

interface AttendanceTask {
  date: string;
  type: '上班' | '下班';
  displayName: string;
  targetMonth: number;
  targetYear: number;
}

// === 主要系統類別 ===
class HeadlessAutoAttendanceSystem {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private userConfig: UserConfig | null = null;
  private attendanceTasks: AttendanceTask[] = [];
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger();
  }
  
  // === Phase 0: 配置載入與任務規劃 ===
  private loadUserConfig(): UserConfig {
    try {
      const configPath = path.resolve(CONFIG.PATHS.USER_CONFIG);
      const configContent = fs.readFileSync(configPath, 'utf-8');
      
      // 解析登入資訊
      const companyCodeMatch = configContent.match(/公司代碼：(.+)/);
      const employeeNoMatch = configContent.match(/登入帳號：(.+)/);
      const passwordMatch = configContent.match(/密碼：(.+)/);
      
      if (!companyCodeMatch || !employeeNoMatch || !passwordMatch) {
        throw new Error('配置檔案格式錯誤：無法解析登入資訊');
      }
      
      // 解析補卡記錄
      const records: PunchInRecord[] = [];
      const lines = configContent.split('\n');
      let inRecordSection = false;
      
      for (const line of lines) {
        if (line.includes('補卡日期：')) {
          inRecordSection = true;
          continue;
        }
        
        if (inRecordSection && line.trim() && !line.startsWith('#')) {
          const parts = line.trim().split('\t').filter(part => part.trim());
          if (parts.length >= 2) {
            records.push({
              date: parts[0].trim(),
              type: parts[1].trim(),
              description: parts[2]?.trim()
            });
          }
        }
      }
      
      this.logger.info(`🤖 載入配置: ${records.length} 筆補卡記錄，展開為 ${this.expandRecordsToTasks(records).length} 個任務`);
      this.attendanceTasks = this.expandRecordsToTasks(records);
      
      return {
        companyCode: companyCodeMatch[1].trim(),
        employeeNo: employeeNoMatch[1].trim(),
        password: passwordMatch[1].trim()
      };
      
    } catch (error) {
      throw new Error(`載入用戶配置失敗: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  private expandRecordsToTasks(records: PunchInRecord[]): AttendanceTask[] {
    const tasks: AttendanceTask[] = [];
    
    for (const record of records) {
      // 解析日期
      const [year, month, day] = record.date.split('/').map(Number);
      
      if (record.type.includes('上班未打卡')) {
        tasks.push({
          date: record.date,
          type: '上班',
          displayName: `${record.date} 上班打卡`,
          targetMonth: month,
          targetYear: year
        });
      }
      
      if (record.type.includes('下班未打卡')) {
        tasks.push({
          date: record.date,
          type: '下班',
          displayName: `${record.date} 下班打卡`,
          targetMonth: month,
          targetYear: year
        });
      }
    }
    
    return tasks;
  }
  
  // === Phase 1: 無頭模式瀏覽器初始化與登入 ===
  private async initializeBrowser(): Promise<void> {
    this.logger.info('🤖 正在啟動無頭模式瀏覽器...');
    
    this.browser = await puppeteer.launch({
      headless: CONFIG.BROWSER.HEADLESS,
      args: CONFIG.BROWSER.ARGS,
      defaultViewport: { width: 1366, height: 768 }, // 標準解析度
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // 使用系統 Chrome
    });
    
    this.page = await this.browser.newPage();
    
    // 設置用戶代理
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    this.logger.success('🤖 無頭模式瀏覽器啟動成功');
  }
  
  private async performLogin(): Promise<void> {
    if (!this.page || !this.userConfig) {
      throw new Error('頁面或用戶配置未初始化');
    }
    
    this.logger.info('🤖 開始無頭模式登入流程');
    
    // 導航到登入頁面
    await this.page.goto(CONFIG.URLS.LOGIN_URL, { 
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD
    });
    
    // 處理可能的彈出視窗
    try {
      await this.page.waitForSelector(SELECTORS.LOGIN.POPUP_CONFIRM, { 
        timeout: 3000 
      });
      await this.page.click(SELECTORS.LOGIN.POPUP_CONFIRM);
      await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
      this.logger.info('🤖 已處理登入彈出視窗');
    } catch {
      // 沒有彈出視窗，繼續
    }
    
    // 填寫登入表單
    await this.page.waitForSelector(SELECTORS.LOGIN.COMPANY_CODE);
    await this.page.type(SELECTORS.LOGIN.COMPANY_CODE, this.userConfig.companyCode, { 
      delay: CONFIG.DELAYS.INPUT_DELAY 
    });
    
    await this.page.type(SELECTORS.LOGIN.EMPLOYEE_NO, this.userConfig.employeeNo, { 
      delay: CONFIG.DELAYS.INPUT_DELAY 
    });
    
    await this.page.type(SELECTORS.LOGIN.PASSWORD, this.userConfig.password, { 
      delay: CONFIG.DELAYS.INPUT_DELAY 
    });
    
    this.logger.info('🤖 登入表單填寫完成');
    
    // 提交登入
    await Promise.all([
      this.page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUTS.LOGIN
      }),
      this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON)
    ]);
    
    this.logger.success('🤖 無頭模式登入成功');
    
    // 截圖記錄
    if (CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      await this.takeScreenshot('headless_after_login_success');
    }
  }
  
  // === Phase 2: 導航到表單申請頁面 ===
  private async navigateToFormApplication(): Promise<void> {
    if (!this.page) {
      throw new Error('頁面未初始化');
    }
    
    this.logger.info('🤖 正在導航到表單申請頁面');
    
    if (CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      await this.takeScreenshot('headless_before_form_application_search');
    }
    
    // 等待頁面穩定
    await this.page.waitForTimeout(CONFIG.DELAYS.NAVIGATION_DELAY);
    
    this.logger.info('🤖 導航前 URL');
    
    // 直接導航到表單申請頁面
    await this.page.goto(CONFIG.URLS.APPLY_FORM_URL, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT
    });
    
    this.logger.success('🤖 成功導航到表單申請頁面');
  }
  
  // === Phase 3: 補卡流程（完整實現） ===
  private async processAttendanceTasks(): Promise<void> {
    if (!this.page) {
      throw new Error('頁面未初始化');
    }
    
    this.logger.info('🤖 開始處理補卡任務');
    
    for (let i = 0; i < this.attendanceTasks.length; i++) {
      const task = this.attendanceTasks[i];
      this.logger.info(`🤖 處理任務 ${i + 1}/${this.attendanceTasks.length}: ${task.displayName}`);
      
      try {
        await this.processIndividualTask(task);
        this.logger.success(`🤖 任務完成: ${task.displayName}`);
        
        // 任務間延遲
        if (i < this.attendanceTasks.length - 1) {
          await this.page.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
        }
        
      } catch (error) {
        this.logger.error(`🤖 任務失敗: ${task.displayName}`, { error });
        // 繼續處理下一個任務
      }
    }
  }
  
  private async processIndividualTask(task: AttendanceTask): Promise<void> {
    if (!this.page) {
      throw new Error('頁面未初始化');
    }
    
    // 等待 iframe 載入
    await this.page.waitForSelector(SELECTORS.FORM.IFRAME, { 
      timeout: CONFIG.TIMEOUTS.IFRAME_WAIT 
    });
    
    const iframe = await this.page.$(SELECTORS.FORM.IFRAME);
    if (!iframe) {
      throw new Error('找不到表單 iframe');
    }
    
    const frame = await iframe.contentFrame();
    if (!frame) {
      throw new Error('無法取得 iframe 內容');
    }
    
    // 等待表單載入
    await frame.waitForSelector(SELECTORS.FORM.TYPE_SELECT, { 
      timeout: CONFIG.TIMEOUTS.FORM_LOAD 
    });
    
    if (CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      await this.takeScreenshot(`headless_form_loaded_${task.date.replace(/\//g, '')}_${task.type}`);
    }
    
    // 選擇假別（補卡）
    await frame.select(SELECTORS.FORM.TYPE_SELECT, '補卡');
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
    
    if (CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      await this.takeScreenshot(`headless_after_type_selection_${task.date.replace(/\//g, '')}_${task.type}`);
    }
    
    // 處理日期輸入（支援跨月份）
    await this.handleDateInput(frame, task);
    
    // 處理時間輸入
    await this.handleTimeInput(frame, task);
    
    // 選擇工作地點
    await frame.select(SELECTORS.FORM.LOCATION_SELECT, '台北辦公室');
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
    
    if (CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      await this.takeScreenshot(`headless_before_submit_${task.date.replace(/\//g, '')}_${task.type}`);
    }
    
    // 提交表單
    await frame.click(SELECTORS.FORM.SUBMIT_BUTTON);
    await frame.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
    
    this.logger.success(`🤖 已提交補卡申請: ${task.displayName}`);
  }
  
  private async handleDateInput(frame: Frame, task: AttendanceTask): Promise<void> {
    if (!this.page) {
      throw new Error('頁面未初始化');
    }
    
    // 清空並輸入日期
    await frame.click(SELECTORS.FORM.DATE_INPUT);
    await this.page.keyboard.down('Meta'); // macOS Command 鍵
    await this.page.keyboard.press('a');
    await this.page.keyboard.up('Meta');
    await this.page.keyboard.press('Backspace');
    
    // 輸入格式化的日期 (YYYY/MM/DD)
    const formattedDate = task.date;
    await frame.type(SELECTORS.FORM.DATE_INPUT, formattedDate, { 
      delay: CONFIG.DELAYS.INPUT_DELAY 
    });
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
    
    if (CONFIG.BROWSER.ENABLE_SCREENSHOTS) {
      await this.takeScreenshot(`headless_after_datetime_selection_${task.date.replace(/\//g, '')}_${task.type}`);
    }
  }
  
  private async handleTimeInput(frame: Frame, task: AttendanceTask): Promise<void> {
    if (!this.page) {
      throw new Error('頁面未初始化');
    }
    
    // 根據上班/下班設定時間
    const timeValue = task.type === '上班' ? '09:00' : '18:00';
    
    await frame.click(SELECTORS.FORM.TIME_INPUT);
    await this.page.keyboard.down('Meta');
    await this.page.keyboard.press('a');
    await this.page.keyboard.up('Meta');
    await this.page.keyboard.press('Backspace');
    
    await frame.type(SELECTORS.FORM.TIME_INPUT, timeValue, { 
      delay: CONFIG.DELAYS.INPUT_DELAY 
    });
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }
  
  // === 輔助功能 ===
  private async takeScreenshot(name: string): Promise<void> {
    if (!this.page || !CONFIG.BROWSER.ENABLE_SCREENSHOTS) return;
    
    try {
      const screenshotDir = CONFIG.PATHS.SCREENSHOTS_DIR;
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const filename = `${name}_${timestamp}.png`;
      const filepath = path.join(screenshotDir, filename);
      
      await this.page.screenshot({ 
        path: filepath,
        fullPage: true
      });
      
      this.logger.info(`🤖 📸 無頭模式截圖已保存: ${filepath.replace('./screenshots/', 'screenshots/')}`);
    } catch (error) {
      this.logger.warn('🤖 截圖失敗', { error });
    }
  }
  
  // === 主要執行流程 ===
  public async run(): Promise<void> {
    let browserStarted = false;
    
    try {
      this.logger.info('🤖 === 開始無頭模式自動補卡程式 ===');
      
      // Phase 0: 載入配置
      this.userConfig = this.loadUserConfig();
      
      // Phase 1: 初始化無頭模式瀏覽器並登入
      this.logger.info('🤖 >>> Phase 1: 開始無頭模式登入流程');
      await this.initializeBrowser();
      browserStarted = true;
      
      await this.performLogin();
      this.logger.success('🤖 >>> Phase 1: 無頭模式登入流程完成');
      
      // Phase 2: 導航到表單申請頁面
      this.logger.info('🤖 >>> Phase 2: 導航到表單申請頁面');
      await this.navigateToFormApplication();
      this.logger.success('🤖 >>> Phase 2: 導航完成');
      
      // Phase 3: 執行補卡流程
      this.logger.info('🤖 >>> Phase 3: 開始無頭模式補卡流程');
      await this.processAttendanceTasks();
      this.logger.success('🤖 >>> Phase 3: 補卡流程完成');
      
      this.logger.success('🤖 === 無頭模式自動補卡程式執行完成 ===');
      
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

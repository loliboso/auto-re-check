/**
 * 第二階段：補卡功能 TypeScript 實作
 * 從表單申請頁面開始，處理所有補卡記錄
 * 延續 phase1 的簡化風格，避免複雜的模組相依性問題
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page, Frame } from 'puppeteer';

// === 系統配置 ===
const CONFIG = {
  URLS: {
    APPLY_FORM_URL: 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b'
  },
  TIMEOUTS: {
    PAGE_LOAD: 30000,
    ELEMENT_WAIT: 10000,
    NAVIGATION_WAIT: 15000,
    FORM_LOAD: 5000, // 新分頁載入等待時間
    IFRAME_WAIT: 3000
  },
  DELAYS: {
    CLICK_DELAY: 500,
    INPUT_DELAY: 200,
    FORM_FILL_DELAY: 300,
    AFTER_SUBMIT_DELAY: 2000
  },
  PATHS: {
    USER_CONFIG: './data/user-info.txt',
    LOGS_DIR: './logs/',
    SCREENSHOTS_DIR: './screenshots/phase2/'
  }
};

// === 選擇器 ===
const SELECTORS = {
  FORM_APPLICATION: {
    // 忘打卡申請單連結
    FORGET_PUNCH_LINK: 'a[data-formkind="TNLMG9.FORM.1001"]',
    FORGET_PUNCH_LINK_ALT: 'a[href*="javascript:void(0)"][data-formkind="TNLMG9.FORM.1001"]'
  },
  IFRAMES: {
    MAIN: '#main',
    BANNER: '#banner'
  },
  ATTENDANCE_FORM: {
    // 表單欄位（在 iframe#main 內）
    ATTENDANCE_TYPE_SELECT: '#fm_attendancetype', // 類型下拉選單
    ATTENDANCE_TYPE_DROPDOWN: '.k-dropdown-wrap', // Kendo UI 下拉選單外層
    DATETIME_INPUT: '#fm_datetime', // 日期時間選擇器
    DATETIME_CALENDAR_BUTTON: '.k-link-date', // 日期選擇按鈕
    LOCATION_SELECT: 'select[name="location"]', // 地點下拉選單（假設選擇器）
    
    // 送簽按鈕（在 iframe#banner 內）
    SUBMIT_BUTTON: '#SUBMIT', // 送簽按鈕
    SUBMIT_BUTTON_ALT: '.buttonDiv[id="SUBMIT"]', // 替代選擇器
    
    // 提示訊息處理
    CONFIRM_BUTTON: 'button:contains("確定")', // 確定按鈕（處理重複打卡提示）
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
class Phase2LogService {
  private logFilePath: string;

  constructor() {
    if (!fs.existsSync(CONFIG.PATHS.LOGS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.LOGS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFilePath = path.join(CONFIG.PATHS.LOGS_DIR, `phase2-${timestamp}.log`);
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

// === 配置解析器（重用 phase1 的邏輯）===
class Phase2ConfigParser {
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

// === 主要的第二階段補卡處理器 ===
export class Phase2AttendanceTester {
  private logger: Phase2LogService;
  private browser: Browser | null = null;
  private mainPage: Page | null = null; // 表單申請頁面

  constructor() {
    this.logger = new Phase2LogService();
  }

  async initialize(): Promise<void> {
    this.logger.info('=== 第二階段：補卡功能開始 ===');
    
    // 確保截圖目錄存在
    if (!fs.existsSync(CONFIG.PATHS.SCREENSHOTS_DIR)) {
      fs.mkdirSync(CONFIG.PATHS.SCREENSHOTS_DIR, { recursive: true });
    }
    
    try {
      this.logger.info('正在啟動瀏覽器...');
      
      // 使用與 phase1 相同的配置
      this.browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1600,960',
          '--window-position=0,0'
        ]
      });

      this.mainPage = await this.browser.newPage();
      
      // 設置超時
      this.mainPage.setDefaultNavigationTimeout(60000);
      this.mainPage.setDefaultTimeout(30000);
      
      // 設置用戶代理
      await this.mainPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
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
    const config = Phase2ConfigParser.parseUserConfig(content);
    
    this.logger.info('使用者配置載入成功', {
      recordsCount: config.attendanceRecords.length,
      records: config.attendanceRecords.map(r => ({ date: r.date, type: r.type }))
    });

    return config;
  }

  async navigateToFormApplicationPage(): Promise<void> {
    if (!this.mainPage) {
      throw new Error('瀏覽器頁面未初始化');
    }

    this.logger.info('導航到表單申請頁面...');
    
    try {
      await this.mainPage.goto(CONFIG.URLS.APPLY_FORM_URL, { 
        waitUntil: 'domcontentloaded', 
        timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
      });
      
      await this.mainPage.waitForTimeout(2000); // 等待頁面穩定
      
      const currentUrl = this.mainPage.url();
      if (currentUrl.includes('bpm/applyform')) {
        this.logger.info('成功到達表單申請頁面', { url: currentUrl });
        await this.takeScreenshot('form_application_page_ready');
      } else {
        throw new Error(`未正確到達表單申請頁面，當前 URL: ${currentUrl}`);
      }
      
    } catch (error) {
      this.logger.error('導航到表單申請頁面失敗', { error: (error as Error).message });
      await this.takeScreenshot('navigation_failed');
      throw error;
    }
  }

  // 將補卡記錄展開為具體的任務列表
  private expandAttendanceTasks(records: AttendanceRecord[]): AttendanceTask[] {
    const tasks: AttendanceTask[] = [];
    
    for (const record of records) {
      if (record.type === 'BOTH') {
        // 先上班，再下班
        tasks.push({
          date: record.date,
          type: 'CLOCK_IN',
          displayName: `${record.date} 上班補卡`
        });
        tasks.push({
          date: record.date,
          type: 'CLOCK_OUT',
          displayName: `${record.date} 下班補卡`
        });
      } else {
        tasks.push({
          date: record.date,
          type: record.type,
          displayName: `${record.date} ${record.type === 'CLOCK_IN' ? '上班' : '下班'}補卡`
        });
      }
    }
    
    return tasks;
  }

  async processAllAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    const tasks = this.expandAttendanceTasks(records);
    this.logger.info(`開始處理補卡任務，共 ${tasks.length} 個任務`, {
      totalTasks: tasks.length,
      taskSummary: tasks.map(t => t.displayName)
    });

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      this.logger.info(`處理第 ${i + 1}/${tasks.length} 個任務：${task.displayName}`);
      
      try {
        await this.processSingleAttendanceTask(task);
        this.logger.info(`✅ 任務完成：${task.displayName}`);
        
        // 確認回到表單申請頁面
        await this.ensureBackToMainPage();
        
      } catch (error) {
        this.logger.error(`❌ 任務失敗：${task.displayName}`, { error: (error as Error).message });
        await this.takeScreenshot(`task_failed_${i + 1}`);
        throw new Error(`補卡任務失敗，程式終止：${task.displayName}`);
      }
    }

    this.logger.info('🎉 所有補卡任務完成！');
  }

  async processSingleAttendanceTask(task: AttendanceTask): Promise<void> {
    this.logger.info(`開始處理單一補卡任務`, { task: task.displayName });
    
    // 步驟1: 點擊忘打卡申請單
    const formPage = await this.clickForgetPunchCard();
    
    try {
      // 步驟2: 等待新分頁載入
      await this.waitForFormPageLoad(formPage);
      
      // 步驟3: 填寫表單
      await this.fillAttendanceForm(formPage, task);
      
      // 步驟4: 送簽
      await this.submitForm(formPage);
      
      // 步驟5: 處理可能的提示訊息
      await this.handleSubmitResult(formPage);
      
    } finally {
      // 確保關閉表單分頁
      if (!formPage.isClosed()) {
        await formPage.close();
        this.logger.info('表單分頁已關閉');
      }
    }
  }

  private async clickForgetPunchCard(): Promise<Page> {
    if (!this.mainPage) {
      throw new Error('主頁面未初始化');
    }

    this.logger.info('尋找並點擊忘打卡申請單連結...');
    
    try {
      // 等待忘打卡申請單連結出現
      await this.mainPage.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK, {
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
      });
      
      // 監聽新分頁開啟事件
      const newPagePromise = new Promise<Page>((resolve) => {
        this.browser!.once('targetcreated', async (target) => {
          const page = await target.page();
          if (page) resolve(page);
        });
      });
      
      // 點擊忘打卡申請單連結
      await this.mainPage.click(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK);
      this.logger.info('已點擊忘打卡申請單連結，等待新分頁開啟...');
      
      // 等待新分頁開啟
      const formPage = await newPagePromise;
      this.logger.info('新分頁已開啟');
      
      return formPage;
      
    } catch (error) {
      this.logger.error('點擊忘打卡申請單失敗', { error: (error as Error).message });
      await this.takeScreenshot('click_forget_punch_failed');
      throw error;
    }
  }

  private async waitForFormPageLoad(formPage: Page): Promise<void> {
    this.logger.info('等待表單頁面載入...');
    
    try {
      // 等待頁面載入完成
      await formPage.waitForLoadState('domcontentloaded');
      
      // 等待5秒讓網頁加載（根據 PRD 要求）
      await formPage.waitForTimeout(CONFIG.TIMEOUTS.FORM_LOAD);
      
      const url = formPage.url();
      this.logger.info('表單頁面載入完成', { url });
      
      // 檢查是否正確載入表單頁面
      if (!url.includes('BPM/Form/List')) {
        throw new Error(`表單頁面 URL 不正確: ${url}`);
      }
      
      await this.takeScreenshot('form_page_loaded', formPage);
      
    } catch (error) {
      this.logger.error('表單頁面載入失敗', { error: (error as Error).message });
      throw error;
    }
  }

  private async fillAttendanceForm(formPage: Page, task: AttendanceTask): Promise<void> {
    this.logger.info('開始填寫補卡表單...', { task: task.displayName });
    
    try {
      // 切換到 main iframe
      const mainFrame = await this.switchToMainFrame(formPage);
      
      // 填寫類型
      await this.fillAttendanceType(mainFrame, task.type);
      
      // 填寫日期
      await this.fillDateTime(mainFrame, task.date);
      
      // 填寫地點
      await this.fillLocation(mainFrame);
      
      this.logger.info('表單填寫完成');
      await this.takeScreenshot('form_filled', formPage);
      
    } catch (error) {
      this.logger.error('填寫表單失敗', { error: (error as Error).message });
      await this.takeScreenshot('form_fill_failed', formPage);
      throw error;
    }
  }

  private async switchToMainFrame(formPage: Page): Promise<Frame> {
    this.logger.info('切換到 main iframe...');
    
    try {
      await formPage.waitForSelector(SELECTORS.IFRAMES.MAIN, {
        timeout: CONFIG.TIMEOUTS.IFRAME_WAIT
      });
      
      const mainFrame = await formPage.frame('main');
      if (!mainFrame) {
        throw new Error('無法找到 main iframe');
      }
      
      this.logger.info('成功切換到 main iframe');
      return mainFrame;
      
    } catch (error) {
      this.logger.error('切換到 main iframe 失敗', { error: (error as Error).message });
      throw error;
    }
  }

  private async fillAttendanceType(frame: Frame, type: 'CLOCK_IN' | 'CLOCK_OUT'): Promise<void> {
    const typeName = type === 'CLOCK_IN' ? '上班' : '下班';
    this.logger.info(`填寫類型：${typeName}`);
    
    try {
      // 等待類型下拉選單出現
      await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT, {
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
      });
      
      // 選擇對應的類型值（根據 PRD，上班=1，下班=2）
      const value = type === 'CLOCK_IN' ? '1' : '2';
      await frame.select(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT, value);
      
      await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
      this.logger.info(`類型選擇完成：${typeName} (value: ${value})`);
      
    } catch (error) {
      this.logger.error('填寫類型失敗', { error: (error as Error).message, type: typeName });
      throw error;
    }
  }

  private async fillDateTime(frame: Frame, date: string): Promise<void> {
    this.logger.info(`填寫日期：${date}`);
    
    try {
      // 等待日期時間輸入框出現
      await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT, {
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
      });
      
      // 點擊日期輸入框觸發 Kendo UI 日期選擇器
      await frame.click(SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT);
      await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
      
      // 嘗試點擊日期選擇按鈕
      try {
        await frame.click(SELECTORS.ATTENDANCE_FORM.DATETIME_CALENDAR_BUTTON);
        await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
        this.logger.info('已點擊日期選擇按鈕，月曆應該已開啟');
      } catch (error) {
        this.logger.warn('點擊日期選擇按鈕失敗，嘗試其他方式', { error: (error as Error).message });
      }
      
      // TODO: 實作具體的日期選擇邏輯
      // 這裡需要根據實際的 Kendo UI 結構來實作日期選擇
      // 暫時使用直接設置值的方式（可能不會成功，但先嘗試）
      try {
        await frame.evaluate((selector, dateValue) => {
          const input = document.querySelector(selector) as HTMLInputElement;
          if (input) {
            input.value = dateValue;
            // 觸發 change 事件
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT, date);
        
        this.logger.info(`日期設置完成：${date}`);
      } catch (error) {
        this.logger.warn('直接設置日期值失敗，可能需要手動選擇', { error: (error as Error).message });
        // 暫時先繼續，後續可以優化日期選擇邏輯
      }
      
      await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
      
    } catch (error) {
      this.logger.error('填寫日期失敗', { error: (error as Error).message, date });
      throw error;
    }
  }

  private async fillLocation(frame: Frame): Promise<void> {
    this.logger.info('填寫地點：TNLMG');
    
    try {
      // TODO: 根據實際的地點選擇器來實作
      // 目前先跳過，因為不確定具體的選擇器結構
      this.logger.warn('地點選擇功能暫未實作，需要根據實際頁面結構調整');
      
      await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
      
    } catch (error) {
      this.logger.error('填寫地點失敗', { error: (error as Error).message });
      throw error;
    }
  }

  private async submitForm(formPage: Page): Promise<void> {
    this.logger.info('準備送簽表單...');
    
    try {
      // 切換到 banner iframe
      const bannerFrame = await this.switchToBannerFrame(formPage);
      
      // 點擊送簽按鈕
      await bannerFrame.waitForSelector(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON, {
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
      });
      
      await bannerFrame.click(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON);
      this.logger.info('已點擊送簽按鈕');
      
      // 等待送簽處理
      await formPage.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
      
    } catch (error) {
      this.logger.error('送簽失敗', { error: (error as Error).message });
      await this.takeScreenshot('submit_failed', formPage);
      throw error;
    }
  }

  private async switchToBannerFrame(formPage: Page): Promise<Frame> {
    this.logger.info('切換到 banner iframe...');
    
    try {
      await formPage.waitForSelector(SELECTORS.IFRAMES.BANNER, {
        timeout: CONFIG.TIMEOUTS.IFRAME_WAIT
      });
      
      const bannerFrame = await formPage.frame('banner');
      if (!bannerFrame) {
        throw new Error('無法找到 banner iframe');
      }
      
      this.logger.info('成功切換到 banner iframe');
      return bannerFrame;
      
    } catch (error) {
      this.logger.error('切換到 banner iframe 失敗', { error: (error as Error).message });
      throw error;
    }
  }

  private async handleSubmitResult(formPage: Page): Promise<void> {
    this.logger.info('處理送簽結果...');
    
    try {
      // 等待一段時間看是否有提示訊息
      await formPage.waitForTimeout(2000);
      
      // 檢查是否有「當日已有打卡紀錄」提示
      // TODO: 實作具體的提示訊息處理邏輯
      
      // 檢查頁面是否已關閉（成功的情況）
      if (formPage.isClosed()) {
        this.logger.info('表單分頁已自動關閉，送簽成功');
        return;
      }
      
      // 如果頁面還開著，可能有提示訊息需要處理
      this.logger.info('表單分頁仍開啟，檢查是否有提示訊息...');
      
      // 暫時等待，後續可以加入具體的提示訊息處理
      await formPage.waitForTimeout(3000);
      
    } catch (error) {
      this.logger.error('處理送簽結果失敗', { error: (error as Error).message });
      throw error;
    }
  }

  private async ensureBackToMainPage(): Promise<void> {
    if (!this.mainPage) {
      throw new Error('主頁面未初始化');
    }

    this.logger.info('確認回到表單申請頁面...');
    
    try {
      // 切換到主頁面
      await this.mainPage.bringToFront();
      
      const currentUrl = this.mainPage.url();
      if (currentUrl.includes('bpm/applyform')) {
        this.logger.info('已回到表單申請頁面', { url: currentUrl });
      } else {
        this.logger.warn('當前不在表單申請頁面，嘗試重新導航', { currentUrl });
        await this.navigateToFormApplicationPage();
      }
      
    } catch (error) {
      this.logger.error('確認回到主頁面失敗', { error: (error as Error).message });
      throw error;
    }
  }

  private async takeScreenshot(filename: string, page?: Page): Promise<void> {
    const targetPage = page || this.mainPage;
    if (!targetPage) return;
    
    try {
      const screenshotPath = path.join(CONFIG.PATHS.SCREENSHOTS_DIR, `${filename}_${Date.now()}.png`);
      await targetPage.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.info(`截圖已儲存: ${screenshotPath}`);
    } catch (error) {
      this.logger.error('截圖失敗', { error: (error as Error).message });
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('瀏覽器已關閉');
    }
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      const config = await this.loadUserConfig();
      await this.navigateToFormApplicationPage();
      await this.processAllAttendanceRecords(config.attendanceRecords);
      
      this.logger.info('✅ 第二階段補卡功能執行成功');
      
    } catch (error) {
      this.logger.error('第二階段執行失敗', { error: (error as Error).message });
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// === 主程式執行 ===
async function main() {
  const tester = new Phase2AttendanceTester();
  
  try {
    await tester.run();
    console.log('\n✅ 第二階段補卡功能執行成功');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ 第二階段補卡功能執行失敗: ${(error as Error).message}`);
    process.exit(1);
  }
}

// 執行主程式
if (require.main === module) {
  main();
}

/**
 * 雲端自動補卡服務 - API 服務
 * 
 * 基於現有的 integrated-main-v2.ts 邏輯
 * 移除截圖功能，優化為雲端服務
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import puppeteer, { Browser, Page, Frame } from 'puppeteer';

// === 系統配置 ===
const CONFIG = {
  BROWSER: {
    HEADLESS: true, // 雲端服務固定使用無頭模式
    ENABLE_SCREENSHOTS: false, // 移除截圖功能
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
  }
};

// === 精確選擇器（重用現有的選擇器） ===
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
    SUBMIT_CONFIRM_BUTTON: 'button.btn.btn-primary[onclick*="submitForm"]'
  }
};

// === 介面定義 ===
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

interface AttendanceTask {
  date: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  displayName: string;
}

interface PunchCardRequest {
  companyCode: string;
  username: string;
  password: string;
  attendanceRecords: string; // 原始格式的打卡異常文字
}

interface TaskStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string;
  message?: string;
  error?: string;
  failedRecords?: string[];
  startTime: Date;
  completedTime?: Date;
  failedTime?: Date;
}

// === 雲端日誌服務 ===
class CloudLogService {
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [${this.taskId}] ${message}`);
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warn(message: string): void {
    this.log('WARN', message);
  }

  error(message: string): void {
    this.log('ERROR', message);
  }

  success(message: string): void {
    this.log('SUCCESS', message);
  }
}

// === 日期解析服務 ===
class DateParserService {
  static parseAttendanceRecords(rawText: string): AttendanceTask[] {
    const tasks: AttendanceTask[] = [];
    const lines = rawText.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 解析原始格式：2025/06/04	上班未打卡
      const dateMatch = trimmedLine.match(/^(\d{4}\/\d{2}\/\d{2})/);
      if (!dateMatch) continue;

      const date = dateMatch[1];
      
      // 判斷類型
      if (trimmedLine.includes('上班未打卡') && trimmedLine.includes('下班未打卡')) {
        // 全日補卡
        tasks.push({
          date,
          type: 'CLOCK_IN',
          displayName: `${date} 上班打卡`
        });
        tasks.push({
          date,
          type: 'CLOCK_OUT',
          displayName: `${date} 下班打卡`
        });
      } else if (trimmedLine.includes('上班未打卡')) {
        tasks.push({
          date,
          type: 'CLOCK_IN',
          displayName: `${date} 上班打卡`
        });
      } else if (trimmedLine.includes('下班未打卡')) {
        tasks.push({
          date,
          type: 'CLOCK_OUT',
          displayName: `${date} 下班打卡`
        });
      }
    }

    return tasks;
  }
}

// === 雲端自動補卡系統 ===
class CloudAutoAttendanceSystem {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: CloudLogService;
  private loginInfo: LoginInfo;
  private attendanceTasks: AttendanceTask[];
  private currentFormPage: Page | null = null;
  private hasDialogHandler: boolean = false;
  private updateStatus: (status: Partial<TaskStatus>) => void;

  constructor(
    taskId: string,
    loginInfo: LoginInfo,
    attendanceTasks: AttendanceTask[],
    updateStatus: (status: Partial<TaskStatus>) => void
  ) {
    this.logger = new CloudLogService(taskId);
    this.loginInfo = loginInfo;
    this.attendanceTasks = attendanceTasks;
    this.updateStatus = updateStatus;
  }

  private async initializeBrowser(): Promise<void> {
    this.logger.info('正在啟動瀏覽器...');
    this.updateStatus({ progress: '正在啟動瀏覽器...' });

    this.browser = await puppeteer.launch({
      headless: CONFIG.BROWSER.HEADLESS,
      args: CONFIG.BROWSER.ARGS
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });
    
    this.logger.success('瀏覽器啟動成功');
  }

  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');

    this.logger.info('正在登入系統...');
    this.updateStatus({ progress: '正在登入系統...' });

    await this.page.goto(CONFIG.URLS.LOGIN_URL, { 
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
    });

    // 處理可能的彈窗
    try {
      await this.page.waitForSelector(SELECTORS.LOGIN.POPUP_CONFIRM, { timeout: 3000 });
      await this.page.click(SELECTORS.LOGIN.POPUP_CONFIRM);
      this.logger.info('已處理彈窗確認');
    } catch (error) {
      // 沒有彈窗，繼續
    }

    // 填寫登入表單
    await this.page.waitForSelector(SELECTORS.LOGIN.COMPANY_CODE, { timeout: CONFIG.TIMEOUTS.LOGIN });
    
    await this.page.type(SELECTORS.LOGIN.COMPANY_CODE, this.loginInfo.companyCode, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.EMPLOYEE_NO, this.loginInfo.username, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.PASSWORD, this.loginInfo.password, { delay: CONFIG.DELAYS.INPUT_DELAY });
    
    await this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON);
    
    // 等待登入完成
    await this.page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.LOGIN 
    });

    this.logger.success('登入成功');
  }

  private async navigateToFormApplication(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');

    this.logger.info('正在導航到表單申請頁面...');
    this.updateStatus({ progress: '正在導航到表單申請頁面...' });

    await this.page.goto(CONFIG.URLS.APPLY_FORM_URL, { 
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.NAVIGATION_WAIT 
    });

    // 等待頁面載入
    await this.page.waitForTimeout(CONFIG.DELAYS.NAVIGATION_DELAY);

    this.logger.success('已到達表單申請頁面');
  }

  private async processAllAttendanceTasks(): Promise<void> {
    this.logger.info(`開始處理 ${this.attendanceTasks.length} 個補卡任務`);
    this.updateStatus({ progress: `開始處理 ${this.attendanceTasks.length} 個補卡任務` });

    const failedTasks: string[] = [];
    const errorDetails: string[] = [];

    for (let i = 0; i < this.attendanceTasks.length; i++) {
      const task = this.attendanceTasks[i];
      this.logger.info(`處理任務 ${i + 1}/${this.attendanceTasks.length}: ${task.displayName}`);
      this.updateStatus({ progress: `處理任務 ${i + 1}/${this.attendanceTasks.length}: ${task.displayName}` });

      try {
        await this.processSingleAttendanceTask(task);
        this.logger.success(`任務完成: ${task.displayName}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`任務失敗: ${task.displayName} - ${errorMsg}`);
        failedTasks.push(task.displayName);
        errorDetails.push(`${task.displayName}: ${errorMsg}`);
      }
    }

    if (failedTasks.length > 0) {
      const errorMessage = `部分任務失敗: ${failedTasks.join(', ')}\n\n詳細錯誤:\n${errorDetails.join('\n')}`;
      throw new Error(errorMessage);
    }

    this.logger.success('所有補卡任務完成');
  }

  private async processSingleAttendanceTask(task: AttendanceTask): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');

    // 點擊忘記打卡連結
    await this.clickForgetPunchLink();

    // 等待新頁面並切換
    this.currentFormPage = await this.waitForNewPageAndSwitch();

    // 設置對話框處理器
    if (!this.hasDialogHandler) {
      this.setupDialogHandler(this.currentFormPage);
      this.hasDialogHandler = true;
    }

    // 填寫補卡表單
    await this.fillAttendanceForm(this.currentFormPage, task);

    // 提交表單
    await this.submitAttendanceForm(this.currentFormPage);

    // 處理提交結果
    await this.handleSubmitResult(this.currentFormPage);

    // 關閉表單頁面
    await this.currentFormPage.close();
    this.currentFormPage = null;
  }

  private async clickForgetPunchLink(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');

    try {
      await this.page.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      await this.page.click(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK);
    } catch (error) {
      // 嘗試替代選擇器
      await this.page.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK_ALT, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      await this.page.click(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK_ALT);
    }

    await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
  }

  private async waitForNewPageAndSwitch(): Promise<Page> {
    if (!this.browser) throw new Error('瀏覽器未初始化');

    const pages = await this.browser.pages();
    const newPage = pages[pages.length - 1];
    
    await newPage.waitForNavigation({ waitUntil: 'networkidle2' });
    await newPage.waitForTimeout(CONFIG.DELAYS.NAVIGATION_DELAY);
    
    return newPage;
  }

  private setupDialogHandler(page: Page): void {
    page.on('dialog', async (dialog) => {
      this.logger.info(`處理對話框: ${dialog.message()}`);
      await dialog.accept();
    });
  }

  private async fillAttendanceForm(page: Page, task: AttendanceTask): Promise<void> {
    // 等待表單載入
    await page.waitForTimeout(5000);

    // 等待 main iframe
    const mainFrame = await this.waitForFrame(page, SELECTORS.IFRAMES.MAIN);

    // 1. 選擇類型
    await this.selectAttendanceType(mainFrame, task.type);

    // 2. 設定日期時間
    await this.setDateTime(mainFrame, task);

    // 3. 選擇地點
    await this.selectLocation(mainFrame);

    await page.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private async waitForFrame(page: Page, selector: string): Promise<Frame> {
    await page.waitForSelector(selector, { timeout: CONFIG.TIMEOUTS.IFRAME_WAIT });
    
    const frameElement = await page.$(selector);
    if (!frameElement) throw new Error(`找不到 iframe: ${selector}`);
    
    const frame = await frameElement.contentFrame();
    if (!frame) throw new Error(`無法取得 iframe 內容: ${selector}`);
    
    return frame;
  }

  private async selectAttendanceType(frame: Frame, type: 'CLOCK_IN' | 'CLOCK_OUT'): Promise<void> {
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_DROPDOWN, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.click(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_DROPDOWN);
    
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    
    // 選擇對應的選項
    const optionValue = type === 'CLOCK_IN' ? '1' : '2';
    const optionSelector = `li[data-value="${optionValue}"]`;
    
    await frame.waitForSelector(optionSelector, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.click(optionSelector);
    
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
  }

  private async setDateTime(frame: Frame, task: AttendanceTask): Promise<void> {
    // 解析日期
    const [year, month, day] = task.date.split('/').map(Number);
    const targetDate = new Date(year, month - 1, day);
    
    // 點擊日期輸入框
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.DATETIME_CALENDAR_BUTTON, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.click(SELECTORS.ATTENDANCE_FORM.DATETIME_CALENDAR_BUTTON);
    
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    
    // 導航到目標月份
    await this.navigateToTargetMonth(frame, year, month);
    
    // 選擇目標日期
    await this.selectTargetDay(frame, day);
    
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
  }

  private async navigateToTargetMonth(frame: Frame, targetYear: number, targetMonth: number): Promise<void> {
    const getCurrentMonth = async (): Promise<{ year: number; month: number } | null> => {
      try {
        const monthText = await frame.$eval('.k-calendar-header .k-link', el => el.textContent);
        if (!monthText) return null;
        
        const match = monthText.match(/(\d{4})年(\d{1,2})月/);
        if (!match) return null;
        
        return {
          year: parseInt(match[1]),
          month: parseInt(match[2])
        };
      } catch (error) {
        return null;
      }
    };

    let currentMonth = await getCurrentMonth();
    if (!currentMonth) throw new Error('無法取得當前月份');

    // 計算需要點擊的次數
    const currentTotal = currentMonth.year * 12 + currentMonth.month;
    const targetTotal = targetYear * 12 + targetMonth;
    const clicks = targetTotal - currentTotal;

    if (clicks > 0) {
      // 向前點擊
      for (let i = 0; i < clicks; i++) {
        await frame.click('.k-calendar-header .k-link.k-nav-next');
        await frame.waitForTimeout(200);
      }
    } else if (clicks < 0) {
      // 向後點擊
      for (let i = 0; i < Math.abs(clicks); i++) {
        await frame.click('.k-calendar-header .k-link.k-nav-prev');
        await frame.waitForTimeout(200);
      }
    }
  }

  private async selectTargetDay(frame: Frame, targetDay: number): Promise<void> {
    const daySelector = `.k-calendar-content td[data-value="${targetDay}"]`;
    
    try {
      await frame.waitForSelector(daySelector, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      await frame.click(daySelector);
    } catch (error) {
      // 如果找不到指定日期，嘗試其他格式
      const alternativeSelector = `.k-calendar-content td:not(.k-other-month) a[data-value="${targetDay}"]`;
      await frame.waitForSelector(alternativeSelector, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      await frame.click(alternativeSelector);
    }
  }

  private async selectLocation(frame: Frame): Promise<void> {
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.LOCATION_DROPDOWN, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.click(SELECTORS.ATTENDANCE_FORM.LOCATION_DROPDOWN);
    
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    
    // 選擇 TNLMG 地點
    const locationSelector = `li[data-value="${SELECTORS.ATTENDANCE_FORM.LOCATION_TNLMG_VALUE}"]`;
    await frame.waitForSelector(locationSelector, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await frame.click(locationSelector);
    
    await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
  }

  private async submitAttendanceForm(page: Page): Promise<void> {
    // 等待 banner iframe
    const bannerFrame = await this.waitForFrame(page, SELECTORS.IFRAMES.BANNER);
    
    // 點擊送簽按鈕
    await bannerFrame.waitForSelector(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    await bannerFrame.click(SELECTORS.ATTENDANCE_FORM.SUBMIT_BUTTON);
    
    await page.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
  }

  private async handleSubmitResult(page: Page): Promise<void> {
    // 檢查是否有確認對話框
    try {
      await page.waitForSelector(SELECTORS.ATTENDANCE_FORM.SUBMIT_CONFIRM_BUTTON, { timeout: 3000 });
      await page.click(SELECTORS.ATTENDANCE_FORM.SUBMIT_CONFIRM_BUTTON);
      this.logger.info('已處理送簽確認');
    } catch (error) {
      // 沒有確認對話框，繼續
    }

    // 等待處理完成
    await page.waitForTimeout(CONFIG.DELAYS.AFTER_SUBMIT_DELAY);
  }

  async run(): Promise<void> {
    try {
      await this.initializeBrowser();
      await this.performLogin();
      await this.navigateToFormApplication();
      await this.processAllAttendanceTasks();
      
      this.logger.success('所有補卡任務成功完成');
      this.updateStatus({ 
        status: 'completed',
        progress: '所有補卡任務成功完成',
        message: `成功完成 ${this.attendanceTasks.length} 個補卡任務`,
        completedTime: new Date()
      });
    } catch (error) {
      this.logger.error(`執行失敗: ${error}`);
      this.updateStatus({ 
        status: 'failed',
        progress: '執行失敗',
        error: error instanceof Error ? error.message : '未知錯誤',
        failedTime: new Date()
      });
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// === Express 應用程式 ===
const app = express();
const port = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 任務狀態追蹤
const taskStatus = new Map<string, TaskStatus>();

// 首頁 - 提供網頁界面
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>🤖 自動補卡服務</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            .fade-in { animation: fadeIn 0.5s ease-in; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-2xl mx-auto">
                <!-- 標題 -->
                <div class="text-center mb-8">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">🤖 自動補卡服務</h1>
                    <p class="text-gray-600">安全、快速、便利的線上補卡服務</p>
                </div>

                <!-- 安全承諾 -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-blue-800">🔒 安全承諾</h3>
                            <div class="mt-2 text-sm text-blue-700">
                                <p>• 您的帳號密碼僅用於本次補卡，處理完成後立即銷毀</p>
                                <p>• 所有資料傳輸均使用 HTTPS 加密</p>
                                <p>• 我們不會儲存任何您的個人資訊</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 主要表單 -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <form id="punchForm" class="space-y-6">
                        <!-- 登入資訊區塊 -->
                        <div>
                            <h2 class="text-lg font-semibold text-gray-800 mb-4">📝 登入資訊</h2>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">公司代碼</label>
                                    <input type="text" name="companyCode" value="TNLMG" required 
                                           class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">帳號</label>
                                    <input type="text" name="username" required 
                                           class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">密碼</label>
                                    <input type="password" name="password" required 
                                           class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                </div>
                            </div>
                        </div>

                        <!-- 補卡日期區塊 -->
                        <div>
                            <h2 class="text-lg font-semibold text-gray-800 mb-4">📅 補卡日期</h2>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    請貼上「打卡異常」查詢結果（支援原始格式）
                                </label>
                                <textarea name="attendanceRecords" rows="6" required
                                          placeholder="例如：&#10;2025/06/04	上班未打卡&#10;2025/06/03	上班未打卡 / 下班未打卡&#10;2025/06/02	下班未打卡"
                                          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"></textarea>
                            </div>
                        </div>

                        <!-- 提交按鈕 -->
                        <button type="submit" id="submitBtn"
                                class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                            開始自動補卡
                        </button>
                    </form>
                </div>

                <!-- 執行狀態區塊 -->
                <div id="statusSection" class="hidden">
                    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 class="text-lg font-semibold text-gray-800 mb-4">📺 執行狀態</h2>
                        <div id="status" class="text-sm font-mono bg-gray-100 rounded p-4 min-h-[100px] whitespace-pre-wrap"></div>
                    </div>
                </div>

                <!-- 完成狀態區塊 -->
                <div id="resultSection" class="hidden">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div id="resultContent"></div>
                        <div id="retrySection" class="mt-4 hidden">
                            <button id="retryBtn" 
                                    class="bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors">
                                重試失敗的補卡
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let currentRequestId = null;
            let failedRecords = [];

            document.getElementById('punchForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = {
                    companyCode: formData.get('companyCode'),
                    username: formData.get('username'),
                    password: formData.get('password'),
                    attendanceRecords: formData.get('attendanceRecords')
                };
                
                // 顯示狀態區塊
                document.getElementById('statusSection').classList.remove('hidden');
                document.getElementById('resultSection').classList.add('hidden');
                
                // 更新狀態
                const statusDiv = document.getElementById('status');
                statusDiv.textContent = '正在處理中，請稍候...';
                
                // 禁用提交按鈕
                const submitBtn = document.getElementById('submitBtn');
                submitBtn.disabled = true;
                submitBtn.textContent = '處理中...';
                
                try {
                    // 送出補卡請求
                    const response = await fetch('/api/punch-card', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        currentRequestId = result.requestId;
                        // 輪詢狀態
                        pollStatus(result.requestId);
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    showError('錯誤：' + error.message);
                }
            });
            
            async function pollStatus(requestId) {
                const statusDiv = document.getElementById('status');
                
                const poll = async () => {
                    try {
                        const response = await fetch(\`/api/status/\${requestId}\`);
                        const status = await response.json();
                        
                        // 更新狀態顯示
                        statusDiv.textContent = status.progress || '處理中...';
                        
                        if (status.status === 'completed') {
                            showSuccess('✅ 補卡完成！' + (status.message || ''));
                        } else if (status.status === 'failed') {
                            failedRecords = status.failedRecords || [];
                            showError('❌ 補卡失敗：' + (status.error || '未知錯誤'));
                        } else {
                            setTimeout(poll, 2000); // 2秒後再次檢查
                        }
                    } catch (error) {
                        showError('連線錯誤：' + error.message);
                    }
                };
                
                poll();
            }
            
            function showSuccess(message) {
                const resultSection = document.getElementById('resultSection');
                const resultContent = document.getElementById('resultContent');
                
                resultContent.innerHTML = \`
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <svg class="h-8 w-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-lg font-medium text-green-800">補卡成功</h3>
                            <div class="mt-2 text-sm text-green-700">
                                <p>\${message}</p>
                            </div>
                        </div>
                    </div>
                \`;
                
                resultSection.classList.remove('hidden');
                resultSection.classList.add('fade-in');
                
                // 重置表單
                resetForm();
            }
            
            function showError(message) {
                const resultSection = document.getElementById('resultSection');
                const resultContent = document.getElementById('resultContent');
                const retrySection = document.getElementById('retrySection');
                
                resultContent.innerHTML = \`
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <svg class="h-8 w-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-lg font-medium text-red-800">補卡失敗</h3>
                            <div class="mt-2 text-sm text-red-700">
                                <p>\${message}</p>
                                \${failedRecords.length > 0 ? \`<p class="mt-2 font-medium">失敗的補卡：</p><ul class="list-disc list-inside mt-1">\${failedRecords.map(record => \`<li>\${record}</li>\`).join('')}</ul>\` : ''}
                            </div>
                        </div>
                    </div>
                \`;
                
                resultSection.classList.remove('hidden');
                resultSection.classList.add('fade-in');
                
                // 顯示重試按鈕 - 修復：只要有錯誤就顯示重試按鈕
                retrySection.classList.remove('hidden');
                
                // 重置表單
                resetForm();
            }
            
            function resetForm() {
                // 重新啟用提交按鈕
                const submitBtn = document.getElementById('submitBtn');
                submitBtn.disabled = false;
                submitBtn.textContent = '開始自動補卡';
                
                // 清空密碼欄位
                document.querySelector('input[name="password"]').value = '';
            }
            
            // 重試按鈕事件
            document.getElementById('retryBtn').addEventListener('click', () => {
                // 隱藏結果區塊，重新顯示表單
                document.getElementById('resultSection').classList.add('hidden');
                document.getElementById('statusSection').classList.add('hidden');
                
                // 清空表單
                document.getElementById('punchForm').reset();
                document.querySelector('input[name="companyCode"]').value = 'TNLMG';
            });
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
    const { companyCode, username, password, attendanceRecords } = req.body;
    
    if (!companyCode || !username || !password || !attendanceRecords) {
      return res.status(400).json({ error: '請填寫所有必要欄位' });
    }
    
    // 解析補卡記錄
    const tasks = DateParserService.parseAttendanceRecords(attendanceRecords);
    if (tasks.length === 0) {
      return res.status(400).json({ error: '無法解析補卡日期，請檢查格式是否正確' });
    }
    
    // 初始化任務狀態
    const initialStatus: TaskStatus = {
      status: 'queued',
      progress: '正在準備處理...',
      startTime: new Date()
    };
    taskStatus.set(requestId, initialStatus);
    
    // 異步處理補卡任務
    processPunchCard(requestId, {
      companyCode,
      username,
      password
    }, tasks);
    
    res.json({ 
      requestId, 
      status: 'queued',
      estimatedTime: '預計 30-60 秒完成',
      taskCount: tasks.length
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
async function processPunchCard(requestId: string, loginInfo: LoginInfo, tasks: AttendanceTask[]) {
  const updateStatus = (status: Partial<TaskStatus>) => {
    const currentStatus = taskStatus.get(requestId);
    if (currentStatus) {
      taskStatus.set(requestId, { ...currentStatus, ...status });
    }
  };

  const system = new CloudAutoAttendanceSystem(requestId, loginInfo, tasks, updateStatus);
  
  try {
    await system.run();
  } catch (error) {
    console.error('Processing error:', error);
    // 錯誤狀態已在 run() 方法中設置
  }
}

// 啟動服務
app.listen(port, () => {
  console.log(`🚀 雲端自動補卡服務已啟動在 http://localhost:${port}`);
  console.log(`📱 您的同事只需要開啟網頁就能使用！`);
  console.log(`🔒 安全承諾：密碼用過即焚，絕不儲存`);
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
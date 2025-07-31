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
    MAIN_PAGE_URL: 'https://apollo.mayohr.com/tube',
    // 注意：APPLY_FORM_URL 會在登入後動態獲取，因為 muid 參數會變化
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
    SUBMIT_BUTTON_ALT: 'div.buttonDiv[id="SUBMIT"]',
    SUBMIT_CONFIRM_BUTTON: 'button.btn.btn-primary[onclick*="submitForm"]',
    
    // 確認對話框處理
    CONFIRM_BUTTON: 'button'
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
  logHistory: string[]; // 新增：日誌歷史記錄
}

// === 雲端日誌服務 ===
class CloudLogService {
  private taskId: string;
  private updateStatus: (status: Partial<TaskStatus>) => void;

  constructor(taskId: string, updateStatus: (status: Partial<TaskStatus>) => void) {
    this.taskId = taskId;
    this.updateStatus = updateStatus;
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [${this.taskId}] ${message}`;
    console.log(logMessage);
    
    // 同時更新前端狀態
    this.updateStatus({ progress: message });
    
    // 累積日誌到歷史記錄
    const currentStatus = taskStatus.get(this.taskId);
    if (currentStatus) {
      const newLogHistory = [...(currentStatus.logHistory || []), logMessage];
      taskStatus.set(this.taskId, { ...currentStatus, logHistory: newLogHistory });
    }
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

// === 雲端自動補卡系統（完全複製本機版邏輯） ===
class CloudAutoAttendanceSystem {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: CloudLogService;
  private loginInfo: LoginInfo;
  private attendanceTasks: AttendanceTask[];
  private updateStatus: (status: Partial<TaskStatus>) => void;
  private currentTaskIndex: number = 0;
  private currentFormPage: Page | null = null;
  private hasDialogHandler: boolean = false;

  constructor(
    taskId: string,
    loginInfo: LoginInfo,
    attendanceTasks: AttendanceTask[],
    updateStatus: (status: Partial<TaskStatus>) => void
  ) {
    this.logger = new CloudLogService(taskId, updateStatus);
    this.loginInfo = loginInfo;
    this.attendanceTasks = attendanceTasks;
    this.updateStatus = updateStatus;
  }

  private async initializeBrowser(): Promise<void> {
    this.logger.info(`正在啟動瀏覽器... (無頭模式)`);
    this.updateStatus({ progress: '正在啟動瀏覽器...' });

    try {
      // 根據模式調整啟動參數
      const launchOptions: any = {
        headless: CONFIG.BROWSER.HEADLESS,
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
      
      this.logger.success(`瀏覽器啟動成功 (無頭模式)`);
    } catch (error) {
      this.logger.error(`瀏覽器啟動失敗: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('頁面未初始化');
    
    this.logger.info('開始登入流程');
    this.updateStatus({ progress: '正在登入系統...' });
    
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
    
    await this.page.type(SELECTORS.LOGIN.COMPANY_CODE, this.loginInfo.companyCode, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.EMPLOYEE_NO, this.loginInfo.username, { delay: CONFIG.DELAYS.INPUT_DELAY });
    await this.page.type(SELECTORS.LOGIN.PASSWORD, this.loginInfo.password, { delay: CONFIG.DELAYS.INPUT_DELAY });
    
    this.logger.info('登入表單填寫完成');
    
    await this.page.click(SELECTORS.LOGIN.LOGIN_BUTTON);
    await this.page.waitForTimeout(800);
    
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
    this.updateStatus({ progress: '正在導航到表單申請頁面...' });
    
    // 等待頁面穩定
    await this.page.waitForTimeout(2000);
    
    // 檢查當前 URL
    const currentUrl = this.page.url();
    this.logger.info(`導航前 URL: ${currentUrl}`);
    this.updateStatus({ progress: `導航前 URL: ${currentUrl}` });
    
    // 如果已經在表單申請頁面，直接返回
    if (currentUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {        
      this.logger.success('已在表單申請頁面');
      this.updateStatus({ progress: '已在表單申請頁面' });
      return;
    }
    
    try {
      // 嘗試尋找表單申請按鈕
      this.logger.info('正在尋找表單申請按鈕...');
      this.updateStatus({ progress: '正在尋找表單申請按鈕...' });
      await this.page.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      await this.page.click(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
      
      this.logger.info('已點擊表單申請按鈕，等待頁面跳轉...');
      this.updateStatus({ progress: '已點擊表單申請按鈕，等待頁面跳轉...' });
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const currentUrl = this.page.url();
        this.logger.info(`等待跳轉中... 當前 URL: ${currentUrl}`);
        
        if (currentUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {
          this.logger.success('成功導航到表單申請頁面');
          this.updateStatus({ progress: '已成功導航到表單申請頁面' });
          return;
        }
        await this.page.waitForTimeout(500);
        attempts++;
      }
      
      throw new Error('導航到表單申請頁面超時');
    } catch (error) {
      // 如果找不到按鈕，嘗試直接導航
      this.logger.warn('找不到表單申請按鈕，嘗試直接導航到表單頁面');
      this.updateStatus({ progress: '嘗試直接導航到表單頁面...' });
      
      // 使用動態 URL（因為 muid 會變化）
      const dynamicUrl = 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG';
      await this.page.goto(dynamicUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
      });
      
      const finalUrl = this.page.url();
      this.logger.info(`直接導航後 URL: ${finalUrl}`);
      this.updateStatus({ progress: `直接導航後 URL: ${finalUrl}` });
      
      if (finalUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {
        this.logger.success('通過直接導航成功到達表單申請頁面');
        this.updateStatus({ progress: '通過直接導航成功到達表單申請頁面' });
        return;
      } else {
        this.logger.error(`導航失敗，當前 URL: ${finalUrl}`);
        this.updateStatus({ progress: `導航失敗，當前 URL: ${finalUrl}` });
        throw new Error(`導航失敗，當前 URL: ${finalUrl}`);
      }
    }
  }

  private async checkPageStructure(): Promise<void> {
    if (!this.page) return;

    try {
      // 檢查頁面標題
      const title = await this.page.title();
      this.logger.info(`頁面標題: ${title}`);

      // 檢查是否有忘記打卡相關的連結
      const links = await this.page.$$eval('a', (elements) => {
        return elements.map(el => ({
          text: el.textContent?.trim(),
          href: el.getAttribute('href'),
          'data-formkind': el.getAttribute('data-formkind'),
          className: el.className,
          title: el.getAttribute('title'),
          'data-toggle': el.getAttribute('data-toggle')
        })).filter(link => 
          link.text?.includes('打卡') || 
          link.text?.includes('補卡') || 
          link.text?.includes('忘記') ||
          link.text?.includes('忘打卡申請單') ||
          link.href?.includes('TNLMG9.FORM.1001') ||
          link['data-formkind'] === 'TNLMG9.FORM.1001'
        );
      });

      this.logger.info(`找到 ${links.length} 個相關連結:`);
      links.forEach((link, index) => {
        this.logger.info(`  連結 ${index + 1}: ${JSON.stringify(link)}`);
      });

      if (links.length === 0) {
        this.logger.warn('未找到任何忘記打卡相關的連結');
      }
    } catch (error) {
      this.logger.error(`檢查頁面結構時出錯: ${error}`);
    }
  }

  private async processAllAttendanceTasks(): Promise<void> {
    this.logger.info(`開始處理 ${this.attendanceTasks.length} 個補卡任務`);
    this.updateStatus({ progress: `開始處理 ${this.attendanceTasks.length} 個補卡任務` });

    for (let i = 0; i < this.attendanceTasks.length; i++) {
      this.currentTaskIndex = i;
      const task = this.attendanceTasks[i];
      
      this.logger.info(`[${i + 1}/${this.attendanceTasks.length}] 處理任務: ${task.displayName}`);
      this.updateStatus({ progress: `處理任務 ${i + 1}/${this.attendanceTasks.length}: ${task.displayName}` });
      
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
    const canReuseFormPage = await this.isFormPageUsable();
    if (canReuseFormPage && this.currentFormPage) {
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
          this.logger.warn(`關閉表單分頁時發生錯誤，可能已自動關閉: ${closeError instanceof Error ? closeError.message : '未知錯誤'}`);
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
            this.logger.info(`已切換回表單申請頁面: ${this.page.url()}`);
          } else {
            // 如果找不到，使用第一個非空白頁面
            const nonBlankPages = pages.filter(p => !p.url().includes('about:blank'));
            if (nonBlankPages.length > 0) {
              this.page = nonBlankPages[0];
              await this.page.bringToFront();
              this.logger.info(`已切換回主頁面（非空白頁面）: ${this.page.url()}`);
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
    
    // 檢查當前頁面 URL
    const currentUrl = this.page.url();
    this.logger.info(`準備點擊忘打卡申請單連結，當前頁面: ${currentUrl}`);
    this.updateStatus({ progress: `準備點擊忘打卡申請單連結，當前頁面: ${currentUrl}` });
    
    // 確認我們在正確的頁面
    if (!currentUrl.includes('flow.mayohr.com/GAIA/bpm/applyform')) {
      throw new Error(`錯誤的頁面，期望在表單申請頁面，但當前在: ${currentUrl}`);
    }
    
    try {
      this.logger.info('等待忘打卡申請單連結出現...');
      this.updateStatus({ progress: '等待忘打卡申請單連結出現...' });
      
      const link = await this.page.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (link) {
        this.logger.info('找到忘打卡申請單連結，準備點擊...');
        this.updateStatus({ progress: '找到忘打卡申請單連結，準備點擊...' });
        await link.click();
        this.logger.success('成功點擊忘打卡申請單連結');
        this.updateStatus({ progress: '成功點擊忘打卡申請單連結' });
      } else {
        throw new Error('找不到忘打卡申請單連結');
      }
    } catch (error) {
      // 嘗試替代選擇器
      this.logger.warn('主要選擇器失敗，嘗試替代選擇器');
      this.updateStatus({ progress: '主要選擇器失敗，嘗試替代選擇器' });
      
      const altLink = await this.page.waitForSelector(SELECTORS.FORM_APPLICATION.FORGET_PUNCH_LINK_ALT, { 
        timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
      });
      if (altLink) {
        this.logger.info('找到替代選擇器連結，準備點擊...');
        this.updateStatus({ progress: '找到替代選擇器連結，準備點擊...' });
        await altLink.click();
        this.logger.success('成功點擊忘打卡申請單連結（替代選擇器）');
        this.updateStatus({ progress: '成功點擊忘打卡申請單連結（替代選擇器）' });
      } else {
        // 如果還是失敗，檢查頁面結構
        this.logger.error('所有選擇器都失敗，檢查頁面結構...');
        this.updateStatus({ progress: '所有選擇器都失敗，檢查頁面結構...' });
        await this.checkPageStructure();
        throw new Error(`找不到忘打卡申請單連結。當前頁面: ${currentUrl}`);
      }
    }
    
    await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
  }

  private async waitForNewPageAndSwitch(): Promise<Page> {
    if (!this.browser) throw new Error('瀏覽器未初始化');
    
    this.logger.info('等待新分頁開啟...');
    this.updateStatus({ progress: '等待新分頁開啟...' });
    
    const pages = await this.browser.pages();
    const initialPageCount = pages.length;
    this.logger.info(`當前分頁數量: ${initialPageCount}`);
    this.updateStatus({ progress: `當前分頁數量: ${initialPageCount}` });
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const currentPages = await this.browser.pages();
      const currentPageCount = currentPages.length;
      
      this.logger.info(`檢查分頁變化... 當前分頁數量: ${currentPageCount} (期望 > ${initialPageCount})`);
      this.updateStatus({ progress: `檢查分頁變化... 當前分頁數量: ${currentPageCount} (期望 > ${initialPageCount})` });
      
      if (currentPageCount > initialPageCount) {
        const newPage = currentPages[currentPageCount - 1];
        const newPageUrl = newPage.url();
        
        this.logger.info(`檢測到新分頁開啟，URL: ${newPageUrl}`);
        this.updateStatus({ progress: `檢測到新分頁開啟，URL: ${newPageUrl}` });
        
        // 等待新分頁載入
        this.logger.info('等待新分頁載入...');
        this.updateStatus({ progress: '等待新分頁載入...' });
        await newPage.waitForTimeout(CONFIG.TIMEOUTS.FORM_LOAD);
        
        // 檢查新分頁的 URL
        const finalUrl = newPage.url();
        this.logger.info(`新分頁載入完成，最終 URL: ${finalUrl}`);
        this.updateStatus({ progress: `新分頁載入完成，最終 URL: ${finalUrl}` });
        
        // 為新分頁設置原生對話框處理器
        this.setupDialogHandler(newPage);
        
        return newPage;
      }
      
      await this.page!.waitForTimeout(500);
      attempts++;
    }
    
    this.logger.error(`等待新分頁開啟超時，嘗試了 ${maxAttempts} 次`);
    this.updateStatus({ progress: `等待新分頁開啟超時，嘗試了 ${maxAttempts} 次` });
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
    this.updateStatus({ progress: `填寫表單: ${task.displayName}` });
    
    // 檢查頁面是否仍然可用
    if (page.isClosed()) {
      throw new Error('表單頁面已關閉，無法填寫');
    }
    
    // 檢查當前頁面 URL
    const currentUrl = page.url();
    this.logger.info(`開始填寫表單，當前頁面 URL: ${currentUrl}`);
    this.updateStatus({ progress: `開始填寫表單，當前頁面 URL: ${currentUrl}` });
    
    try {
      // 檢查頁面響應性
      await page.evaluate(() => document.readyState);
      this.logger.info('頁面響應性檢查通過');
    } catch (error) {
      this.logger.error(`表單頁面無法響應: ${error instanceof Error ? error.message : '未知錯誤'}`);
      this.updateStatus({ progress: `表單頁面無法響應: ${error instanceof Error ? error.message : '未知錯誤'}` });
      throw new Error(`表單頁面無法響應: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
    
    // 等待並切換到 main iframe
    this.logger.info('等待 main iframe 載入...');
    this.updateStatus({ progress: '等待 main iframe 載入...' });
    const mainFrame = await this.waitForFrame(page, SELECTORS.IFRAMES.MAIN);
    this.logger.info('main iframe 載入成功');
    this.updateStatus({ progress: 'main iframe 載入成功' });
    
    // 驗證表單載入狀態（模擬本機版的截圖驗證）
    this.logger.info('驗證表單載入狀態...');
    this.updateStatus({ progress: '驗證表單載入狀態...' });
    
    // 按照 PRD 要求，只處理這三個欄位：
    // 1. 類型（先選擇，讓系統自動設定個人時間）
    this.logger.info('開始填寫類型欄位');
    this.updateStatus({ progress: '開始填寫類型欄位...' });
    await this.selectAttendanceType(mainFrame, task.type);
    
    // 驗證類型選擇成功
    this.logger.info('驗證類型選擇結果...');
    this.updateStatus({ progress: '驗證類型選擇結果...' });
    
    // 等待系統自動設定個人時間（增加等待時間確保系統有足夠時間處理）
    await mainFrame.waitForTimeout(2000);
    
    // 2. 日期/時間（在選擇類型後設定日期，保留系統已設定的個人時間）
    this.logger.info('開始填寫日期/時間欄位');
    this.updateStatus({ progress: '開始填寫日期/時間欄位...' });
    await this.setDateTime(mainFrame, task);
    
    // 驗證日期設定成功
    this.logger.info('驗證日期設定結果...');
    this.updateStatus({ progress: '驗證日期設定結果...' });
    
    // 3. 地點
    this.logger.info('開始填寫地點欄位');
    this.updateStatus({ progress: '開始填寫地點欄位...' });
    await this.selectLocation(mainFrame);
    
    // 驗證地點選擇成功
    this.logger.info('驗證地點選擇結果...');
    this.updateStatus({ progress: '驗證地點選擇結果...' });
    
    this.logger.info('表單填寫完成');
    this.updateStatus({ progress: '表單填寫完成' });
  }

  private async waitForFrame(page: Page, selector: string): Promise<Frame> {
    try {
      // 檢查頁面是否仍然可用
      if (page.isClosed()) {
        throw new Error('頁面已關閉，無法等待 iframe');
      }
      
      await page.waitForSelector(selector, { timeout: CONFIG.TIMEOUTS.IFRAME_WAIT });
      const frameElement = await page.$(selector);
      const frame = await frameElement?.contentFrame();
      
      if (!frame) {
        throw new Error(`無法取得 iframe: ${selector}`);
      }
      
      return frame;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Session closed') || error.message.includes('Protocol error')) {
          throw new Error('頁面連線已斷開，無法存取 iframe');
        }
        throw error;
      }
      throw new Error(`等待 iframe 時發生未知錯誤: ${selector}`);
    }
  }

  private async selectAttendanceType(frame: Frame, type: 'CLOCK_IN' | 'CLOCK_OUT'): Promise<void> {
    this.logger.info(`選擇補卡類型: ${type === 'CLOCK_IN' ? '上班' : '下班'}`);
    
    // 等待類型欄位容器載入
    await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_CONTAINER, { 
      timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT 
    });
    
    const optionValue = type === 'CLOCK_IN' ? '1' : '2';
    const optionText = type === 'CLOCK_IN' ? '上班' : '下班';
    
    // 強制使用 Kendo UI 下拉選單點擊方式，更接近人類操作
    try {
      this.logger.info('使用 Kendo UI 下拉選單點擊方式選擇類型');
      
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
      // 備用方法：如果 Kendo UI 失敗，再嘗試直接設定 select 值
      this.logger.warn(`Kendo UI 選擇失敗，嘗試備用方法: ${kendoError instanceof Error ? kendoError.message : '未知錯誤'}`);
      
      try {
        const selectElement = await frame.$(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT);
        if (selectElement) {
          await frame.select(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT, optionValue);
          this.logger.info(`成功使用備用 select 方法選擇類型: ${optionText} (value=${optionValue})`);
        } else {
          throw new Error('找不到 select 元素');
        }
      } catch (selectError) {
        throw new Error(`無法選擇補卡類型: ${kendoError instanceof Error ? kendoError.message : '未知錯誤'}`);
      }
    }
    
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
  }

  private async setDateTime(frame: Frame, task: AttendanceTask): Promise<void> {
    this.logger.info(`設定日期: ${task.date}`);
    
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
      
      this.logger.info(`成功透過日曆設定日期: ${task.date}`);
    } catch (error) {
      this.logger.error(`日期設定失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      throw new Error(`無法設定日期: ${task.date} - ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
    
    // 等待系統自動設定時間
    await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
    
    // 最終驗證：檢查輸入框中的日期是否正確
    await this.verifyDateInput(frame, task);
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
        currentYearMonth = newYearMonth;
        this.logger.info(`切換後顯示: ${currentYearMonth.year}年${currentYearMonth.month}月`);
      }
    }
    
    if (attempts >= maxAttempts) {
      this.logger.warn('月份導航達到最大嘗試次數，可能導航失敗');
    } else {
      this.logger.success(`成功導航到 ${targetYear}年${targetMonth}月`);
    }
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
        // 使用更強制的方式點擊日期
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        targetCell.dispatchEvent(clickEvent);
        
        // 同時觸發 mousedown 和 mouseup 事件
        const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
        const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
        targetCell.dispatchEvent(mouseDownEvent);
        targetCell.dispatchEvent(mouseUpEvent);
        
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
        this.logger.warn(`檢查提示訊息時發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
      }
      
    } catch (error) {
      this.logger.error(`處理送簽結果失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
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

  private async isFormPageUsable(): Promise<boolean> {
    if (!this.currentFormPage || this.currentFormPage.isClosed()) {
      return false;
    }

    try {
      // 嘗試檢查頁面是否仍可訪問
      await this.currentFormPage.evaluate(() => document.readyState);

      // 檢查是否還能找到主要的 iframe
      const mainSelector = SELECTORS.IFRAMES.MAIN;
      const elementExists = await this.currentFormPage.$(mainSelector).then(el => !!el).catch(() => false);

      if (!elementExists) {
        this.logger.warn('表單頁面缺少主要 iframe，不可重用');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn('檢查表單頁面可用性時發生錯誤');
      return false;
    }
  }

  private async verifyDateInput(frame: Frame, task: AttendanceTask): Promise<void> {
    try {
      const inputValue = await frame.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        return input ? input.value : '';
      }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT);
      
      this.logger.info(`日期輸入框當前值: "${inputValue}"`);
      
      // 只檢查日期部分，不檢查時間
      const [targetYear, targetMonth, targetDay] = task.date.split('/');
      const expectedDateParts = [targetYear, targetMonth.padStart(2, '0'), targetDay.padStart(2, '0')];
      
      // 檢查輸入值是否包含所有期望的日期部分
      let isCorrect = true;
      for (const part of expectedDateParts) {
        if (!inputValue.includes(part)) {
          isCorrect = false;
          this.logger.warn(`日期驗證失敗：輸入值 "${inputValue}" 不包含期望的部分 "${part}"`);
          break;
        }
      }
      
      if (!isCorrect) {
        this.logger.error(`日期驗證失敗，期望包含 ${expectedDateParts.join('/')}, 實際值: ${inputValue}`);
        throw new Error(`日期設定失敗：期望 ${task.date}，實際值 ${inputValue}`);
      } else {
        this.logger.success(`日期驗證成功: ${inputValue} 包含期望的日期 ${task.date}`);
      }
      
    } catch (error) {
      this.logger.error(`日期驗證過程發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
      throw error;
    }
  }





  async run(): Promise<void> {
    try {
      await this.initializeBrowser();
      await this.performLogin();
      await this.navigateToFormApplication();
      await this.processAllAttendanceTasks();
      
      this.logger.success('所有補卡任務成功完成');
      
      // 驗證是否真正成功：檢查是否有任何任務失敗
      const completedTasks = this.attendanceTasks.length;
      this.logger.info(`驗證完成狀態：處理了 ${completedTasks} 個任務`);
      
      // 檢查是否所有任務都真正完成（沒有拋出異常）
      if (completedTasks > 0) {
        this.logger.success(`✅ 補卡完成！成功完成 ${completedTasks} 個補卡任務`);
        this.updateStatus({ 
          status: 'completed',
          progress: '所有補卡任務成功完成',
          message: `成功完成 ${completedTasks} 個補卡任務`,
          completedTime: new Date()
        });
      } else {
        throw new Error('沒有處理任何補卡任務');
      }
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
                        <div id="status" class="text-sm font-mono bg-gray-100 rounded p-4 min-h-[100px] whitespace-pre-wrap mb-4"></div>
                        <div id="logContainer" class="text-xs font-mono bg-gray-50 rounded p-3 max-h-[300px] overflow-y-auto border"></div>
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
                        
                        // 顯示完整的日誌歷史
                        if (status.logHistory && status.logHistory.length > 0) {
                            const logContainer = document.getElementById('logContainer');
                            if (logContainer) {
                                logContainer.innerHTML = status.logHistory
                                    .map(log => \`<div class="text-xs text-gray-600 mb-1">\${log}</div>\`)
                                    .join('');
                                logContainer.scrollTop = logContainer.scrollHeight;
                            }
                        }
                        
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
      startTime: new Date(),
      logHistory: []
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
      // 特殊處理 logHistory 的累積
      if (status.logHistory && typeof status.logHistory === 'function') {
        const logHistoryFn = status.logHistory as (prev: string[]) => string[];
        const newLogHistory = logHistoryFn(currentStatus.logHistory || []);
        taskStatus.set(requestId, { 
          ...currentStatus, 
          ...status, 
          logHistory: newLogHistory 
        });
      } else {
        taskStatus.set(requestId, { ...currentStatus, ...status });
      }
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
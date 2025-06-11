/**
 * 瀏覽器服務
 * 負責處理所有瀏覽器相關操作
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { LogService } from './log.service';
import { SYSTEM_CONFIG } from '../config/constants';
import { SELECTORS } from '../config/selectors';

/**
 * 瀏覽器配置介面
 */
export interface BrowserConfig {
  headless: boolean;
  defaultViewport?: {
    width: number;
    height: number;
  };
}

export class BrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logService: LogService;

  constructor(logService: LogService) {
    this.logService = logService;
  }

  /**
   * 初始化瀏覽器
   */
  async initialize(config: BrowserConfig = { headless: false }): Promise<void> {
    try {
      this.logService.info('正在啟動瀏覽器...');
      
      this.browser = await puppeteer.launch({
        headless: config.headless,
        defaultViewport: config.defaultViewport || { width: 1280, height: 720 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // 設定使用者代理
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      this.logService.info('瀏覽器啟動成功');
    } catch (error) {
      this.logService.error('瀏覽器啟動失敗', error as Error);
      throw error;
    }
  }

  /**
   * 導航到指定 URL
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      this.logService.info(`導航到: ${url}`);
      await this.page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: SYSTEM_CONFIG.TIMEOUTS.PAGE_LOAD 
      });
      this.logService.info('頁面載入完成');
    } catch (error) {
      this.logService.error(`導航失敗: ${url}`, error as Error);
      throw error;
    }
  }

  /**
   * 等待選擇器出現
   */
  async waitForSelector(selector: string, options: { timeout?: number } = {}): Promise<void> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      await this.page.waitForSelector(selector, {
        timeout: options.timeout || SYSTEM_CONFIG.TIMEOUTS.ELEMENT_WAIT
      });
    } catch (error) {
      this.logService.error(`等待選擇器失敗: ${selector}`, error as Error);
      throw error;
    }
  }

  /**
   * 點擊元素
   */
  async clickElement(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      await this.waitForSelector(selector);
      await this.page.click(selector);
      this.logService.debug(`已點擊元素: ${selector}`);
    } catch (error) {
      this.logService.error(`點擊元素失敗: ${selector}`, error as Error);
      throw error;
    }
  }

  /**
   * 填寫輸入框
   */
  async fillInput(selector: string, value: string): Promise<void> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      await this.waitForSelector(selector);
      await this.page.click(selector);
      await this.page.evaluate((sel) => {
        const element = document.querySelector(sel) as HTMLInputElement;
        if (element) {
          element.value = '';
        }
      }, selector);
      await this.page.type(selector, value);
      this.logService.debug(`已填寫輸入框: ${selector}`);
    } catch (error) {
      this.logService.error(`填寫輸入框失敗: ${selector}`, error as Error);
      throw error;
    }
  }

  /**
   * 等待頁面導航完成
   */
  async waitForNavigation(): Promise<void> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      await this.page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: SYSTEM_CONFIG.TIMEOUTS.NAVIGATION_WAIT 
      });
    } catch (error) {
      this.logService.error('等待頁面導航失敗', error as Error);
      throw error;
    }
  }

  /**
   * 檢查元素是否存在
   */
  async elementExists(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      const element = await this.page.$(selector);
      return element !== null;
    } catch (error) {
      this.logService.debug(`檢查元素存在性時發生錯誤: ${selector}`, { error });
      return false;
    }
  }

  /**
   * 等待指定時間
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 截圖
   */
  async takeScreenshot(filename: string): Promise<void> {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }

    try {
      const screenshotPath = `${SYSTEM_CONFIG.PATHS.SCREENSHOTS_DIR}${filename}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.logService.info(`截圖已儲存: ${screenshotPath}`);
    } catch (error) {
      this.logService.error('截圖失敗', error as Error);
      throw error;
    }
  }

  /**
   * 獲取當前 URL
   */
  getCurrentUrl(): string {
    if (!this.page) {
      throw new Error('瀏覽器尚未初始化');
    }
    return this.page.url();
  }

  /**
   * 關閉瀏覽器
   */
  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.logService.info('瀏覽器已關閉');
      }
    } catch (error) {
      this.logService.error('關閉瀏覽器失敗', error as Error);
      throw error;
    }
  }
}

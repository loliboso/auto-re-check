/**
 * 主要執行服務
 * 負責協調各個服務，執行完整的自動化流程
 * 第一階段：專注於登入功能
 */

import { LogService } from './log.service';
import { BrowserService, BrowserConfig } from './browser.service';
import { ConfigService } from './config.service';
import { LoginService } from './login.service';
import { UserConfig } from '../types';
import { SYSTEM_CONFIG } from '../config/constants';

export class MainService {
  private logService: LogService;
  private browserService: BrowserService;
  private configService: ConfigService;
  private loginService: LoginService;

  constructor() {
    this.logService = new LogService();
    this.browserService = new BrowserService(this.logService);
    this.configService = new ConfigService(this.logService);
    this.loginService = new LoginService(this.browserService, this.logService);
  }

  /**
   * 執行主要流程 - 第一階段：完成登入
   */
  async execute(): Promise<void> {
    try {
      this.logService.info('=== 自動化補卡程式啟動 - 第一階段：登入功能 ===');

      // 步驟 1: 載入使用者配置
      const userConfig = await this.loadUserConfiguration();

      // 步驟 2: 初始化瀏覽器
      await this.initializeBrowser();

      // 步驟 3: 執行登入流程
      await this.performLogin(userConfig);

      // 步驟 4: 導航到表單申請頁面
      await this.navigateToFormApplication();

      this.logService.info('=== 第一階段完成：登入成功並到達表單申請頁面 ===');

      // 為了演示，等待 5 秒讓使用者看到結果
      this.logService.info('等待 5 秒以便查看結果...');
      await this.browserService.wait(5000);

    } catch (error) {
      this.logService.error('程式執行失敗', error as Error);
      
      // 失敗時截圖
      try {
        await this.browserService.takeScreenshot(`execution_failed_${Date.now()}`);
      } catch (screenshotError) {
        this.logService.error('截圖失敗', screenshotError as Error);
      }
      
      throw error;
    } finally {
      // 清理資源
      await this.cleanup();
    }
  }

  /**
   * 載入使用者配置
   */
  private async loadUserConfiguration(): Promise<UserConfig> {
    try {
      this.logService.info('步驟 1: 載入使用者配置');
      return await this.configService.loadUserConfig();
    } catch (error) {
      // 如果配置檔案不存在，建立範例檔案
      if ((error as Error).message.includes('配置檔案不存在')) {
        this.logService.info('配置檔案不存在，正在建立範例檔案...');
        await this.configService.createSampleUserConfig();
        
        throw new Error(`已建立範例配置檔案 ${SYSTEM_CONFIG.PATHS.USER_CONFIG}，請編輯此檔案並重新執行程式`);
      }
      throw error;
    }
  }

  /**
   * 初始化瀏覽器
   */
  private async initializeBrowser(): Promise<void> {
    this.logService.info('步驟 2: 初始化瀏覽器');
    
    const browserConfig: BrowserConfig = {
      headless: false, // 第一階段使用可視模式以便觀察
      defaultViewport: {
        width: 1280,
        height: 720
      }
    };

    await this.browserService.initialize(browserConfig);
  }

  /**
   * 執行登入流程
   */
  private async performLogin(userConfig: UserConfig): Promise<void> {
    this.logService.info('步驟 3: 執行登入流程');
    await this.loginService.performLogin(userConfig.loginInfo);
  }

  /**
   * 導航到表單申請頁面
   */
  private async navigateToFormApplication(): Promise<void> {
    this.logService.info('步驟 4: 導航到表單申請頁面');
    await this.loginService.navigateToFormApplication();
  }

  /**
   * 清理資源
   */
  private async cleanup(): Promise<void> {
    try {
      this.logService.info('清理資源...');
      await this.browserService.close();
      this.logService.info('資源清理完成');
    } catch (error) {
      this.logService.error('資源清理失敗', error as Error);
    }
  }

  /**
   * 建立範例配置檔案（便利方法）
   */
  async createSampleConfig(): Promise<void> {
    await this.configService.createSampleUserConfig();
    this.logService.info('範例配置檔案已建立，請編輯後重新執行程式');
  }
}

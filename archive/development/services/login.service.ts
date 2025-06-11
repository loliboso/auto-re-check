/**
 * 登入服務
 * 負責處理登入相關的所有操作
 */

import { BrowserService } from './browser.service';
import { LogService } from './log.service';
import { LoginInfo } from '../types';
import { SYSTEM_CONFIG } from '../config/constants';
import { SELECTORS } from '../config/selectors';

export class LoginService {
  private browserService: BrowserService;
  private logService: LogService;

  constructor(browserService: BrowserService, logService: LogService) {
    this.browserService = browserService;
    this.logService = logService;
  }

  /**
   * 執行完整的登入流程
   */
  async performLogin(loginInfo: LoginInfo): Promise<void> {
    try {
      this.logService.info('開始執行登入流程');

      // 步驟 1: 導航到登入頁面
      await this.navigateToLoginPage();

      // 步驟 2: 處理可能的彈窗
      await this.handleLoginPopup();

      // 步驟 3: 檢查是否已經登入
      const isAlreadyLoggedIn = await this.checkIfAlreadyLoggedIn();
      if (isAlreadyLoggedIn) {
        this.logService.info('使用者已經登入，跳過登入步驟');
        return;
      }

      // 步驟 4: 填寫登入表單
      await this.fillLoginForm(loginInfo);

      // 步驟 5: 提交登入表單
      await this.submitLoginForm();

      // 步驟 6: 驗證登入成功
      await this.verifyLoginSuccess();

      this.logService.info('登入流程完成');
    } catch (error) {
      this.logService.error('登入流程失敗', error as Error);
      
      // 登入失敗時截圖
      await this.browserService.takeScreenshot(`login_failed_${Date.now()}`);
      throw error;
    }
  }

  /**
   * 導航到登入頁面
   */
  private async navigateToLoginPage(): Promise<void> {
    this.logService.info('導航至登入頁面');
    await this.browserService.navigateTo(SYSTEM_CONFIG.URLS.LOGIN_URL);
  }

  /**
   * 處理登入前的彈窗
   */
  private async handleLoginPopup(): Promise<void> {
    try {
      // 等待一下看是否有彈窗出現
      await this.browserService.wait(2000);
      
      // 檢查是否有需要重新登入的彈窗
      const hasPopup = await this.browserService.elementExists(SELECTORS.LOGIN.POPUP_CONFIRM);
      
      if (hasPopup) {
        this.logService.info('偵測到登入彈窗，正在處理...');
        await this.browserService.clickElement(SELECTORS.LOGIN.POPUP_CONFIRM);
        await this.browserService.wait(SYSTEM_CONFIG.DELAYS.CLICK_DELAY);
        this.logService.info('登入彈窗已處理');
      }
    } catch (error) {
      // 如果彈窗處理失敗，記錄但不中斷流程
      this.logService.debug('彈窗處理時發生錯誤，繼續執行', { error });
    }
  }

  /**
   * 檢查是否已經登入
   */
  private async checkIfAlreadyLoggedIn(): Promise<boolean> {
    try {
      const currentUrl = this.browserService.getCurrentUrl();
      
      // 如果當前 URL 是表單申請頁面，表示已經登入
      if (currentUrl.includes('bpm/applyform')) {
        return true;
      }

      // 檢查是否存在表單申請連結（表示在主頁面且已登入）
      const hasFormLink = await this.browserService.elementExists(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
      return hasFormLink;
    } catch (error) {
      this.logService.debug('檢查登入狀態時發生錯誤', { error });
      return false;
    }
  }

  /**
   * 填寫登入表單
   */
  private async fillLoginForm(loginInfo: LoginInfo): Promise<void> {
    this.logService.info('開始填寫登入表單');

    try {
      // 等待登入表單載入
      await this.browserService.waitForSelector(SELECTORS.LOGIN.USERNAME, {
        timeout: SYSTEM_CONFIG.TIMEOUTS.ELEMENT_WAIT
      });

      // 填寫公司代碼（如果存在該欄位）
      const hasCompanyCode = await this.browserService.elementExists(SELECTORS.LOGIN.COMPANY_CODE);
      if (hasCompanyCode) {
        await this.browserService.fillInput(SELECTORS.LOGIN.COMPANY_CODE, loginInfo.companyCode);
        await this.browserService.wait(SYSTEM_CONFIG.DELAYS.INPUT_DELAY);
      }

      // 填寫使用者名稱
      await this.browserService.fillInput(SELECTORS.LOGIN.USERNAME, loginInfo.username);
      await this.browserService.wait(SYSTEM_CONFIG.DELAYS.INPUT_DELAY);

      // 填寫密碼
      await this.browserService.fillInput(SELECTORS.LOGIN.PASSWORD, loginInfo.password);
      await this.browserService.wait(SYSTEM_CONFIG.DELAYS.INPUT_DELAY);

      this.logService.info('登入表單填寫完成');
    } catch (error) {
      this.logService.error('填寫登入表單失敗', error as Error);
      throw error;
    }
  }

  /**
   * 提交登入表單
   */
  private async submitLoginForm(): Promise<void> {
    try {
      this.logService.info('提交登入表單');
      
      await this.browserService.clickElement(SELECTORS.LOGIN.LOGIN_BUTTON);
      await this.browserService.wait(SYSTEM_CONFIG.DELAYS.CLICK_DELAY);
      
      // 等待頁面導航
      await this.browserService.waitForNavigation();
      
      this.logService.info('登入表單已提交');
    } catch (error) {
      this.logService.error('提交登入表單失敗', error as Error);
      throw error;
    }
  }

  /**
   * 驗證登入成功
   */
  private async verifyLoginSuccess(): Promise<void> {
    try {
      this.logService.info('驗證登入結果');

      // 等待一段時間讓頁面完全載入
      await this.browserService.wait(3000);

      const currentUrl = this.browserService.getCurrentUrl();
      this.logService.debug('當前 URL', { url: currentUrl });

      // 檢查是否成功導向到主頁面或表單申請頁面
      const isOnMainPage = currentUrl.includes('apollo.mayohr.com') && !currentUrl.includes('login');
      const isOnFormPage = currentUrl.includes('bpm/applyform');
      
      if (isOnMainPage || isOnFormPage) {
        this.logService.info('登入驗證成功');
        return;
      }

      // 如果不在預期頁面，嘗試尋找表單申請連結
      try {
        await this.browserService.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK, {
          timeout: SYSTEM_CONFIG.TIMEOUTS.LOGIN
        });
        this.logService.info('找到表單申請連結，登入驗證成功');
        return;
      } catch (error) {
        // 如果找不到表單申請連結，可能登入失敗
        throw new Error('登入驗證失敗：無法找到表單申請連結');
      }
    } catch (error) {
      this.logService.error('登入驗證失敗', error as Error);
      throw error;
    }
  }

  /**
   * 導航到表單申請頁面
   */
  async navigateToFormApplication(): Promise<void> {
    try {
      this.logService.info('導航至表單申請頁面');

      const currentUrl = this.browserService.getCurrentUrl();
      
      // 如果已經在表單申請頁面，直接返回
      if (currentUrl.includes('bpm/applyform')) {
        this.logService.info('已在表單申請頁面');
        return;
      }

      // 點擊表單申請連結
      await this.browserService.waitForSelector(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
      await this.browserService.clickElement(SELECTORS.MAIN_PAGE.FORM_APPLICATION_LINK);
      
      // 等待頁面載入
      await this.browserService.waitForNavigation();
      
      this.logService.info('成功導航至表單申請頁面');
    } catch (error) {
      this.logService.error('導航至表單申請頁面失敗', error as Error);
      throw error;
    }
  }
}

"use strict";
/**
 * 雲端自動補卡服務 - API 服務
 *
 * 基於現有的 integrated-main-v2.ts 邏輯
 * 移除截圖功能，優化為雲端服務
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const puppeteer_1 = __importDefault(require("puppeteer-core"));
const chromium = require("@sparticuz/chromium");
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
// === 雲端日誌服務 ===
class CloudLogService {
    constructor(taskId, updateStatus) {
        this.taskId = taskId;
        this.updateStatus = updateStatus;
    }
    log(level, message) {
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
    info(message) {
        this.log('INFO', message);
    }
    warn(message) {
        this.log('WARN', message);
    }
    error(message) {
        this.log('ERROR', message);
    }
    success(message) {
        this.log('SUCCESS', message);
    }
}
// === 日期解析服務 ===
class DateParserService {
    static parseAttendanceRecords(rawText) {
        const tasks = [];
        const lines = rawText.split('\n').filter(line => line.trim());
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine)
                continue;
            // 解析原始格式：2025/06/04	上班未打卡
            const dateMatch = trimmedLine.match(/^(\d{4}\/\d{2}\/\d{2})/);
            if (!dateMatch)
                continue;
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
            }
            else if (trimmedLine.includes('上班未打卡')) {
                tasks.push({
                    date,
                    type: 'CLOCK_IN',
                    displayName: `${date} 上班打卡`
                });
            }
            else if (trimmedLine.includes('下班未打卡')) {
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
    constructor(taskId, loginInfo, attendanceTasks, updateStatus) {
        this.browser = null;
        this.page = null;
        this.currentTaskIndex = 0;
        this.currentFormPage = null;
        this.hasDialogHandler = false;
        this.logger = new CloudLogService(taskId, updateStatus);
        this.loginInfo = loginInfo;
        this.attendanceTasks = attendanceTasks;
        this.updateStatus = updateStatus;
    }
    async initializeBrowser() {
        this.logger.info(`正在啟動瀏覽器... (無頭模式)`);
        this.updateStatus({ progress: '正在啟動瀏覽器...' });
        try {
            // 根據模式調整啟動參數
            const launchOptions = {
                headless: CONFIG.BROWSER.HEADLESS,
                timeout: 30000,
                args: [
                    ...(CONFIG.BROWSER.HEADLESS ? CONFIG.BROWSER.ARGS : [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--window-size=1600,960',
                        '--window-position=0,0'
                    ]),
                    // 設定台灣時區
                    '--timezone=Asia/Taipei',
                    '--lang=zh-TW'
                ]
            };
            // 只在有界面模式下設置 viewport 為 null
            if (!CONFIG.BROWSER.HEADLESS) {
                launchOptions.defaultViewport = null;
            }
            else {
                launchOptions.defaultViewport = { width: 1366, height: 768 };
            }
            // 使用 puppeteer-core + chromium for Cloud Functions
            this.browser = await puppeteer_1.default.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });
            this.page = await this.browser.newPage();
            this.page.setDefaultNavigationTimeout(60000);
            this.page.setDefaultTimeout(30000);
            await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            // 設定頁面時區為台灣時區
            await this.page.evaluateOnNewDocument(() => {
                // 覆蓋 Date 物件以模擬台灣時區
                const originalDate = Date;
                const taiwanOffset = 8 * 60; // UTC+8 分鐘
                function TaiwanDate(...args) {
                    if (args.length === 0) {
                        // 無參數：返回當前台灣時間
                        const utcDate = new originalDate();
                        const utcTime = utcDate.getTime();
                        const taiwanTime = utcTime + (taiwanOffset * 60 * 1000);
                        return new originalDate(taiwanTime);
                    }
                    else {
                        // 有參數：正常建構
                        return new originalDate(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
                    }
                }
                // 複製 Date 的靜態方法
                TaiwanDate.now = () => originalDate.now() + (taiwanOffset * 60 * 1000);
                TaiwanDate.parse = originalDate.parse;
                TaiwanDate.UTC = originalDate.UTC;
                // 複製原型方法
                TaiwanDate.prototype = originalDate.prototype;
                // 替換全域 Date
                globalThis.Date = TaiwanDate;
            });
            this.logger.success(`瀏覽器啟動成功 (無頭模式)`);
        }
        catch (error) {
            this.logger.error(`瀏覽器啟動失敗: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async performLogin() {
        if (!this.page)
            throw new Error('頁面未初始化');
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
        }
        catch (error) {
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
        }
        else {
            throw new Error('登入失敗或頁面未正確導向');
        }
    }
    async navigateToFormApplication() {
        if (!this.page)
            throw new Error('頁面未初始化');
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
        }
        catch (error) {
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
            }
            else {
                this.logger.error(`導航失敗，當前 URL: ${finalUrl}`);
                this.updateStatus({ progress: `導航失敗，當前 URL: ${finalUrl}` });
                throw new Error(`導航失敗，當前 URL: ${finalUrl}`);
            }
        }
    }
    async checkPageStructure() {
        if (!this.page)
            return;
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
                })).filter(link => link.text?.includes('打卡') ||
                    link.text?.includes('補卡') ||
                    link.text?.includes('忘記') ||
                    link.text?.includes('忘打卡申請單') ||
                    link.href?.includes('TNLMG9.FORM.1001') ||
                    link['data-formkind'] === 'TNLMG9.FORM.1001');
            });
            this.logger.info(`找到 ${links.length} 個相關連結:`);
            links.forEach((link, index) => {
                this.logger.info(`  連結 ${index + 1}: ${JSON.stringify(link)}`);
            });
            if (links.length === 0) {
                this.logger.warn('未找到任何忘記打卡相關的連結');
            }
        }
        catch (error) {
            this.logger.error(`檢查頁面結構時出錯: ${error}`);
        }
    }
    async processAllAttendanceTasks() {
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
            }
            catch (error) {
                this.logger.error(`任務 ${task.displayName} 失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
                throw error; // 依照 PRD 要求，任一任務失敗立即終止
            }
        }
        this.logger.success('所有補卡任務處理完成');
    }
    async processSingleAttendanceTask(task) {
        if (!this.page)
            throw new Error('頁面未初始化');
        let formPage;
        // 檢查是否有現有的表單頁面可以重用
        const canReuseFormPage = await this.isFormPageUsable();
        if (canReuseFormPage && this.currentFormPage) {
            this.logger.info('重用現有表單頁面');
            formPage = this.currentFormPage;
            if (!this.hasDialogHandler) {
                this.setupDialogHandler(formPage);
                this.hasDialogHandler = true;
            }
            else {
                this.logger.info('分頁已設置 dialog 事件處理器，跳過');
            }
        }
        else {
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
            }
            else if (remainingTasks > 0) {
                // 表單仍開啟且有剩餘任務，可能是遇到重複警告，可以在同一表單繼續
                this.logger.info(`任務 ${task.displayName} 有警告但已處理，在同一表單中繼續下一個任務`);
                // 保持 currentFormPage 和 hasDialogHandler 狀態
            }
            else {
                // 最後一個任務，關閉表單
                this.logger.success(`任務 ${task.displayName} 完成`);
                this.currentFormPage = null;
                this.hasDialogHandler = false;
            }
        }
        finally {
            // 只在程式結束或表單自動關閉時才清理
            if (!this.currentFormPage || this.currentFormPage.isClosed()) {
                // 安全地關閉新分頁：檢查分頁是否已關閉
                try {
                    if (formPage && !formPage.isClosed()) {
                        await formPage.close();
                        this.logger.info('表單分頁已關閉');
                    }
                    else {
                        this.logger.info('表單分頁已自動關閉');
                    }
                }
                catch (closeError) {
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
                    }
                    else {
                        // 如果找不到，使用第一個非空白頁面
                        const nonBlankPages = pages.filter(p => !p.url().includes('about:blank'));
                        if (nonBlankPages.length > 0) {
                            this.page = nonBlankPages[0];
                            await this.page.bringToFront();
                            this.logger.info(`已切換回主頁面（非空白頁面）: ${this.page.url()}`);
                        }
                        else {
                            this.logger.warn('未找到合適的頁面，使用預設頁面');
                            this.page = pages[0];
                        }
                    }
                }
            }
        }
    }
    async clickForgetPunchLink() {
        if (!this.page)
            throw new Error('頁面未初始化');
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
            }
            else {
                throw new Error('找不到忘打卡申請單連結');
            }
        }
        catch (error) {
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
            }
            else {
                // 如果還是失敗，檢查頁面結構
                this.logger.error('所有選擇器都失敗，檢查頁面結構...');
                this.updateStatus({ progress: '所有選擇器都失敗，檢查頁面結構...' });
                await this.checkPageStructure();
                throw new Error(`找不到忘打卡申請單連結。當前頁面: ${currentUrl}`);
            }
        }
        await this.page.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
    }
    async waitForNewPageAndSwitch() {
        if (!this.browser)
            throw new Error('瀏覽器未初始化');
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
            await this.page.waitForTimeout(500);
            attempts++;
        }
        this.logger.error(`等待新分頁開啟超時，嘗試了 ${maxAttempts} 次`);
        this.updateStatus({ progress: `等待新分頁開啟超時，嘗試了 ${maxAttempts} 次` });
        throw new Error('等待新分頁開啟超時');
    }
    setupDialogHandler(page) {
        this.logger.info('為分頁設置 dialog 事件處理器');
        page.on('dialog', async (dialog) => {
            const message = dialog.message();
            this.logger.info(`檢測到瀏覽器原生彈窗: ${message}`);
            // 檢查是否為補卡重複警告（這是可以接受的）
            if (message.includes('當日已有') && (message.includes('上班') || message.includes('下班')) && message.includes('打卡紀錄')) {
                this.logger.info('檢測到補卡重複警告彈窗，自動點擊確定');
                await dialog.accept();
            }
            else {
                // 其他彈窗也接受，但記錄警告（暫時改為與本機版一致的行為）
                this.logger.warn(`檢測到其他彈窗: ${message}，自動點擊確定`);
                await dialog.accept();
                // 暫時不拋出錯誤，讓程序繼續執行
                // TODO: 根據實際測試結果決定是否需要恢復錯誤處理
            }
        });
    }
    async fillAttendanceForm(page, task) {
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
        }
        catch (error) {
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
        // 恢復原來的順序：先選類型再選日期（避免 HR 系統的日期-1 bug）
        // 1. 先選擇類型（讓系統自動設定個人時間）
        this.logger.info('開始填寫類型欄位');
        this.updateStatus({ progress: '開始填寫類型欄位...' });
        await this.selectAttendanceType(mainFrame, task.type);
        // 驗證類型選擇成功
        this.logger.info('驗證類型選擇結果...');
        this.updateStatus({ progress: '驗證類型選擇結果...' });
        // 等待系統自動設定個人時間
        await mainFrame.waitForTimeout(2000);
        // 2. 再設定日期（保留系統已設定的個人時間）
        this.logger.info('開始填寫日期/時間欄位');
        this.updateStatus({ progress: '開始填寫日期/時間欄位...' });
        await this.setDateTime(mainFrame, task);
        // 驗證日期設定成功
        this.logger.info('驗證日期設定結果...');
        this.updateStatus({ progress: '驗證日期設定結果...' });
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
    async waitForFrame(page, selector) {
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
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('Session closed') || error.message.includes('Protocol error')) {
                    throw new Error('頁面連線已斷開，無法存取 iframe');
                }
                throw error;
            }
            throw new Error(`等待 iframe 時發生未知錯誤: ${selector}`);
        }
    }
    async selectAttendanceType(frame, type) {
        this.logger.info(`選擇補卡類型: ${type === 'CLOCK_IN' ? '上班' : '下班'}`);
        // 等待類型欄位容器載入
        await frame.waitForSelector(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_CONTAINER, {
            timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT
        });
        const optionValue = type === 'CLOCK_IN' ? '1' : '2';
        const optionText = type === 'CLOCK_IN' ? '上班' : '下班';
        try {
            // 方法 1: 先嘗試直接使用隱藏的 select 元素（與本機版一致）
            const selectElement = await frame.$(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT);
            if (selectElement) {
                await frame.select(SELECTORS.ATTENDANCE_FORM.ATTENDANCE_TYPE_SELECT, optionValue);
                this.logger.info(`成功使用 select 方法選擇類型: ${optionText} (value=${optionValue})`);
            }
            else {
                throw new Error('找不到 select 元素');
            }
        }
        catch (error) {
            // 方法 2: 嘗試點擊 Kendo UI 下拉選單（備用方法）
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
                        targetOption.click();
                        return true;
                    }
                    return false;
                }, optionText);
                if (success) {
                    this.logger.info(`成功使用 Kendo UI 選擇類型: ${optionText}`);
                }
                else {
                    throw new Error('無法在選項列表中找到目標選項');
                }
            }
            catch (kendoError) {
                throw new Error(`無法選擇補卡類型: ${error instanceof Error ? error.message : '未知錯誤'}`);
            }
        }
        await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
        // 檢查系統是否自動填入日期/時間
        const dateTimeValue = await frame.evaluate((selector) => {
            const input = document.querySelector(selector);
            return input ? input.value : '';
        }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT);
        this.logger.info(`類型選擇後，日期/時間欄位值: "${dateTimeValue}"`);
        if (!dateTimeValue || dateTimeValue.trim() === '') {
            this.logger.warn('⚠️ 系統未自動填入日期/時間，可能需要手動設定');
        }
        else {
            this.logger.success(`✅ 系統已自動填入日期/時間: ${dateTimeValue}`);
        }
    }
    async setDateTime(frame, task) {
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
            // 檢查日曆選擇後的實際輸入框值
            const afterCalendarValue = await frame.evaluate((selector) => {
                const input = document.querySelector(selector);
                return input ? input.value : '';
            }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT);
            this.logger.info(`日曆選擇後，輸入框實際值: "${afterCalendarValue}"`);
        }
        catch (error) {
            this.logger.error(`日期設定失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
            // 嘗試備用方法：直接設定輸入框的值（只設定日期，不設定時間）
            try {
                this.logger.info('嘗試備用日期設定方法');
                await frame.evaluate((selector, dateValue) => {
                    const input = document.querySelector(selector);
                    if (input) {
                        // 只設定日期，不設定時間，讓系統自動帶入時間
                        const formattedDate = dateValue.replace(/\//g, '-');
                        input.value = formattedDate;
                        // 觸發各種可能的事件
                        ['input', 'change', 'blur'].forEach(eventType => {
                            const event = new Event(eventType, { bubbles: true });
                            input.dispatchEvent(event);
                        });
                    }
                }, SELECTORS.ATTENDANCE_FORM.DATETIME_INPUT, task.date);
                this.logger.info('備用方法設定完成');
            }
            catch (backupError) {
                throw new Error(`無法設定日期: ${task.date} - ${error instanceof Error ? error.message : '未知錯誤'}`);
            }
        }
        // 等待系統自動設定時間
        await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
        // 最終驗證：檢查輸入框中的日期是否正確
        await this.verifyDateInput(frame, task);
    }
    async navigateToTargetMonth(frame, targetYear, targetMonth) {
        this.logger.info(`導航到目標月份: ${targetYear}年${targetMonth}月`);
        // 等待日曆完全載入
        await frame.waitForSelector('.k-calendar', { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
        await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
        // 獲取當前顯示的年月 - 根據 Kendo UI 文件和實際截圖
        const getCurrentMonth = async () => {
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
                    const monthMap = {
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
                    const monthMap = {
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
            }
            else {
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
        }
        else {
            this.logger.success(`成功導航到 ${targetYear}年${targetMonth}月`);
        }
    }
    async selectTargetDay(frame, targetDay) {
        this.logger.info(`選擇目標日期: ${targetDay}日`);
        // 等待日曆穩定
        await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
        // 在日曆中點擊目標日期，確保點擊的是當前月份的日期（不是其他月份的日期）
        const daySelector = `td[role="gridcell"]:not(.k-other-month)`;
        const clickResult = await frame.evaluate((selector, day) => {
            const dayCells = Array.from(document.querySelectorAll(selector));
            // 過濾出當前月份的日期格子（排除 .k-other-month 類別）
            const currentMonthCells = dayCells.filter(cell => !cell.classList.contains('k-other-month'));
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
        }
        catch (error) {
            this.logger.info('日期選擇器可能仍開啟，嘗試點擊其他區域關閉');
            // 點擊日曆外的區域來關閉日期選擇器
            await frame.click('body');
            await frame.waitForTimeout(CONFIG.DELAYS.CLICK_DELAY);
        }
    }
    async selectLocation(frame) {
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
            }
            else {
                throw new Error('找不到地點 select 元素');
            }
        }
        catch (error) {
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
                        targetOption.click();
                        return true;
                    }
                    return false;
                });
                if (success) {
                    this.logger.info('成功使用 Kendo UI 選擇地點: TNLMG');
                }
                else {
                    throw new Error('無法在選項列表中找到 TNLMG 選項');
                }
            }
            catch (kendoError) {
                this.logger.warn(`地點選擇失敗，但繼續執行: ${error instanceof Error ? error.message : '未知錯誤'}`);
            }
        }
        await frame.waitForTimeout(CONFIG.DELAYS.FORM_FILL_DELAY);
    }
    async submitAttendanceForm(page) {
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
        }
        catch (error) {
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
    async handleSubmitResult(page) {
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
                }
                else {
                    this.logger.success('表單分頁已自動關閉，送簽成功');
                }
            }
            catch (error) {
                this.logger.warn(`檢查提示訊息時發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
            }
        }
        catch (error) {
            this.logger.error(`處理送簽結果失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
            throw error;
        }
    }
    async handleConfirmationDialog(page) {
        try {
            // 等待可能的確認對話框
            const confirmButton = await page.waitForSelector(SELECTORS.ATTENDANCE_FORM.CONFIRM_BUTTON, {
                timeout: 3000
            });
            if (confirmButton) {
                await confirmButton.click();
                this.logger.info('已處理確認對話框');
            }
        }
        catch (error) {
            this.logger.info('無確認對話框需要處理');
        }
    }
    async isFormPageUsable() {
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
        }
        catch (error) {
            this.logger.warn('檢查表單頁面可用性時發生錯誤');
            return false;
        }
    }
    async verifyDateInput(frame, task) {
        try {
            const inputValue = await frame.evaluate((selector) => {
                const input = document.querySelector(selector);
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
            }
            else {
                this.logger.success(`日期驗證成功: ${inputValue} 包含期望的日期 ${task.date}`);
            }
        }
        catch (error) {
            this.logger.error(`日期驗證過程發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
            throw error;
        }
    }
    async run() {
        try {
            // 立即更新狀態為 processing
            this.updateStatus({
                status: 'processing',
                progress: '正在啟動瀏覽器...'
            });
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
            }
            else {
                throw new Error('沒有處理任何補卡任務');
            }
        }
        catch (error) {
            this.logger.error(`執行失敗: ${error}`);
            this.updateStatus({
                status: 'failed',
                progress: '執行失敗',
                error: error instanceof Error ? error.message : '未知錯誤',
                failedTime: new Date()
            });
            throw error;
        }
        finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}
// === Express 應用程式 ===
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// 中間件
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static('public'));
// 任務狀態追蹤
const taskStatus = new Map();
// 首頁 - 提供網頁界面
// API: 提交補卡請求
app.post('/api/punch-card', async (req, res) => {
    const requestId = (0, uuid_1.v4)();
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
        const initialStatus = {
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
    }
    catch (error) {
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
async function processPunchCard(requestId, loginInfo, tasks) {
    const updateStatus = (status) => {
        const currentStatus = taskStatus.get(requestId);
        if (currentStatus) {
            // 特殊處理 logHistory 的累積
            if (status.logHistory && typeof status.logHistory === 'function') {
                const logHistoryFn = status.logHistory;
                const newLogHistory = logHistoryFn(currentStatus.logHistory || []);
                taskStatus.set(requestId, {
                    ...currentStatus,
                    ...status,
                    logHistory: newLogHistory
                });
            }
            else {
                taskStatus.set(requestId, { ...currentStatus, ...status });
            }
        }
    };
    const system = new CloudAutoAttendanceSystem(requestId, loginInfo, tasks, updateStatus);
    try {
        await system.run();
    }
    catch (error) {
        console.error('Processing error:', error);
        // 錯誤狀態已在 run() 方法中設置
    }
}
// 啟動服務
module.exports = { app, taskStatus };

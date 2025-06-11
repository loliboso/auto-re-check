"use strict";
/**
 * 无头模式兼容性测试
 * 目标：验证 MayoHR 系统是否支持无头浏览器操作
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadlessCompatibilityTest = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
class HeadlessCompatibilityTest {
    constructor() {
        this.browser = null;
        this.page = null;
    }
    async runTest() {
        console.log('🧪 开始无头模式兼容性测试...');
        try {
            await this.initHeadlessBrowser();
            await this.testLoginPageAccess();
            await this.testBasicFormInteraction();
            console.log('✅ 无头模式兼容性测试通过！');
        }
        catch (error) {
            console.error('❌ 无头模式测试失败:', error);
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    async initHeadlessBrowser() {
        console.log('1️⃣ 初始化无头浏览器...');
        this.browser = await puppeteer_1.default.launch({
            headless: true, // 关键：启用无头模式
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            timeout: 30000
        });
        this.page = await this.browser.newPage();
        // 设置用户代理和视窗大小
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await this.page.setViewport({ width: 1600, height: 960 });
        console.log('✅ 无头浏览器初始化成功');
    }
    async testLoginPageAccess() {
        console.log('2️⃣ 测试登入页面访问...');
        if (!this.page)
            throw new Error('页面未初始化');
        // 访问登入页面
        await this.page.goto('https://apollo.mayohr.com', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        console.log('   当前URL:', this.page.url());
        // 检查是否有弹出提示需要处理
        try {
            const popupButton = await this.page.waitForSelector('button.btn.btn-default', { timeout: 3000 });
            if (popupButton) {
                await popupButton.click();
                console.log('   已处理登入弹出提示');
                await this.page.waitForTimeout(1000);
            }
        }
        catch (error) {
            console.log('   无弹出提示需要处理');
        }
        // 验证登入表单是否存在
        const companyCodeInput = await this.page.$('input[name="companyCode"]');
        const employeeInput = await this.page.$('input[name="employeeNo"]');
        const passwordInput = await this.page.$('input[name="password"]');
        if (!companyCodeInput || !employeeInput || !passwordInput) {
            throw new Error('无法找到登入表单元素');
        }
        console.log('✅ 登入页面访问成功，表单元素检测正常');
    }
    async testBasicFormInteraction() {
        console.log('3️⃣ 测试基本表单交互...');
        if (!this.page)
            throw new Error('页面未初始化');
        // 测试填写表单（使用测试数据）
        await this.page.type('input[name="companyCode"]', 'TEST', { delay: 100 });
        await this.page.type('input[name="employeeNo"]', 'TEST001', { delay: 100 });
        await this.page.type('input[name="password"]', 'testpassword', { delay: 100 });
        console.log('   表单填写测试完成');
        // 验证值是否正确填入
        const companyValue = await this.page.$eval('input[name="companyCode"]', el => el.value);
        const employeeValue = await this.page.$eval('input[name="employeeNo"]', el => el.value);
        const passwordValue = await this.page.$eval('input[name="password"]', el => el.value);
        if (companyValue !== 'TEST' || employeeValue !== 'TEST001' || passwordValue !== 'testpassword') {
            throw new Error('表单值填入验证失败');
        }
        console.log('✅ 基本表单交互测试通过');
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 浏览器已关闭');
        }
    }
}
exports.HeadlessCompatibilityTest = HeadlessCompatibilityTest;
// 执行测试
async function main() {
    const test = new HeadlessCompatibilityTest();
    try {
        await test.runTest();
        console.log('\n🎉 所有测试通过！MayoHR 系统支持无头模式操作');
        process.exit(0);
    }
    catch (error) {
        console.error('\n💥 测试失败:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}

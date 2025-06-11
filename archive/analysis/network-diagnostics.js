/**
 * 網路連線問題診斷工具
 */

const puppeteer = require('puppeteer');
const https = require('https');
const { execSync } = require('child_process');

class NetworkDiagnostics {
  async runDiagnostics() {
    console.log('🔍 開始網路連線診斷...\n');

    // 1. 檢查基本網路連線
    await this.checkBasicConnectivity();

    // 2. 檢查 Chrome 安裝
    await this.checkChromeInstallation();

    // 3. 測試簡單的 Puppeteer 啟動
    await this.testSimplePuppeteer();

    // 4. 測試不同的 Puppeteer 配置
    await this.testPuppeteerConfigurations();

    // 5. 測試目標網站連線
    await this.testTargetWebsite();

    console.log('\n✅ 診斷完成');
  }

  async checkBasicConnectivity() {
    console.log('1️⃣ 檢查基本網路連線...');
    
    try {
      // 測試 DNS 解析
      const dns = require('dns');
      await new Promise((resolve, reject) => {
        dns.lookup('apollo.mayohr.com', (err, address) => {
          if (err) reject(err);
          else {
            console.log(`   ✅ DNS 解析成功: apollo.mayohr.com -> ${address}`);
            resolve(address);
          }
        });
      });

      // 測試 HTTPS 連線
      await new Promise((resolve, reject) => {
        const req = https.get('https://apollo.mayohr.com', { timeout: 10000 }, (res) => {
          console.log(`   ✅ HTTPS 連線成功: 狀態碼 ${res.statusCode}`);
          resolve(res);
        });
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('連線超時')));
      });

    } catch (error) {
      console.log(`   ❌ 網路連線失敗: ${error.message}`);
    }
  }

  async checkChromeInstallation() {
    console.log('\n2️⃣ 檢查 Chrome 安裝...');
    
    try {
      // 檢查 Puppeteer Chrome 安裝
      const executablePath = await new Promise((resolve, reject) => {
        try {
          const puppeteerCore = require('puppeteer-core');
          resolve(puppeteerCore.executablePath());
        } catch {
          try {
            const result = execSync('find /Users -name "Google Chrome for Testing" 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
            if (result) {
              resolve(result);
            } else {
              reject(new Error('Chrome 可執行檔案未找到'));
            }
          } catch {
            reject(new Error('Chrome 可執行檔案未找到'));
          }
        }
      });

      console.log(`   ✅ Chrome 可執行檔案找到: ${executablePath}`);

      // 檢查 Chrome 版本
      try {
        const version = execSync(`"${executablePath}" --version 2>/dev/null || echo "無法取得版本"`, { encoding: 'utf8' }).trim();
        console.log(`   ✅ Chrome 版本: ${version}`);
      } catch {
        console.log('   ⚠️  無法取得 Chrome 版本');
      }

    } catch (error) {
      console.log(`   ❌ Chrome 檢查失敗: ${error.message}`);
      
      // 嘗試重新安裝 Chrome
      console.log('   🔄 嘗試重新安裝 Chrome...');
      try {
        execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
        console.log('   ✅ Chrome 重新安裝成功');
      } catch (installError) {
        console.log(`   ❌ Chrome 安裝失敗: ${installError.message}`);
      }
    }
  }

  async testSimplePuppeteer() {
    console.log('\n3️⃣ 測試基本 Puppeteer 啟動...');
    
    let browser = null;
    try {
      console.log('   🔄 嘗試基本配置啟動...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
      });
      
      const page = await browser.newPage();
      console.log('   ✅ 基本 Puppeteer 啟動成功');
      
      // 測試導航到簡單頁面
      await page.goto('data:text/html,<h1>Test</h1>', { waitUntil: 'load', timeout: 5000 });
      console.log('   ✅ 基本頁面導航成功');
      
    } catch (error) {
      console.log(`   ❌ 基本 Puppeteer 啟動失敗: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async testPuppeteerConfigurations() {
    console.log('\n4️⃣ 測試不同 Puppeteer 配置...');
    
    const configurations = [
      {
        name: '預設配置',
        config: { headless: true }
      },
      {
        name: '無沙盒模式',
        config: { 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      },
      {
        name: '完整安全配置',
        config: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors'
          ]
        }
      },
      {
        name: '非無頭模式',
        config: {
          headless: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      }
    ];

    for (const { name, config } of configurations) {
      let browser = null;
      try {
        console.log(`   🔄 測試 ${name}...`);
        browser = await puppeteer.launch(config);
        
        const page = await browser.newPage();
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        console.log(`   ✅ ${name} 成功`);
        
        // 如果是非無頭模式，等待一下讓用戶看到
        if (!config.headless) {
          console.log('   ⏳ 等待 3 秒以查看瀏覽器...');
          await page.waitForTimeout(3000);
        }
        
        break; // 如果成功，就使用這個配置
        
      } catch (error) {
        console.log(`   ❌ ${name} 失敗: ${error.message}`);
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }
  }

  async testTargetWebsite() {
    console.log('\n5️⃣ 測試目標網站連線...');
    
    let browser = null;
    try {
      console.log('   🔄 啟動瀏覽器...');
      browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--ignore-certificate-errors'
        ]
      });

      const page = await browser.newPage();
      
      // 設置更長的超時
      page.setDefaultNavigationTimeout(30000);
      page.setDefaultTimeout(15000);
      
      console.log('   🔄 嘗試連接 apollo.mayohr.com...');
      await page.goto('https://apollo.mayohr.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      const url = page.url();
      const title = await page.title();
      
      console.log(`   ✅ 成功連接到目標網站`);
      console.log(`   📍 當前 URL: ${url}`);
      console.log(`   📄 頁面標題: ${title}`);
      
      // 等待 5 秒讓用戶查看
      console.log('   ⏳ 等待 5 秒以查看頁面...');
      await page.waitForTimeout(5000);
      
    } catch (error) {
      console.log(`   ❌ 目標網站連線失敗: ${error.message}`);
      
      // 嘗試截圖（如果頁面存在）
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            await pages[0].screenshot({ path: './screenshots/error-page.png', fullPage: true });
            console.log('   📸 錯誤頁面截圖已保存到 ./screenshots/error-page.png');
          }
        } catch {}
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// 執行診斷
async function main() {
  const diagnostics = new NetworkDiagnostics();
  await diagnostics.runDiagnostics();
}

main().catch(console.error);

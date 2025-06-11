/**
 * 瀏覽器啟動診斷工具
 * 專門用來診斷 Puppeteer 啟動 Chrome 的問題
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function diagnoseBrowserStartup() {
  console.log('🔍 開始瀏覽器啟動診斷...\n');

  // 1. 檢查 Puppeteer 版本
  console.log('1️⃣ 檢查 Puppeteer 版本...');
  try {
    const packagePath = path.join(__dirname, '../node_modules/puppeteer/package.json');
    const puppeteerPkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    console.log(`✅ Puppeteer 版本: ${puppeteerPkg.version}`);
  } catch (error) {
    console.log(`❌ 無法讀取 Puppeteer 版本: ${error.message}`);
  }

  // 2. 檢查 Chrome 執行檔
  console.log('\n2️⃣ 檢查 Chrome 執行檔...');
  const chromePath = '/Users/tnl-loso/.cache/puppeteer/chrome/mac_arm-121.0.6167.85/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  
  if (fs.existsSync(chromePath)) {
    console.log('✅ Chrome 執行檔存在');
    
    // 檢查執行權限
    try {
      const stats = fs.statSync(chromePath);
      console.log(`✅ 檔案權限: ${stats.mode.toString(8)}`);
    } catch (error) {
      console.log(`❌ 無法檢查檔案權限: ${error.message}`);
    }
  } else {
    console.log('❌ Chrome 執行檔不存在');
    return;
  }

  // 3. 測試最基本的瀏覽器啟動
  console.log('\n3️⃣ 測試基本瀏覽器啟動 (headless=true)...');
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ 基本瀏覽器啟動成功');
    await browser.close();
  } catch (error) {
    console.log(`❌ 基本瀏覽器啟動失敗: ${error.message}`);
    console.log(`   錯誤詳情: ${error.stack}`);
    return;
  }

  // 4. 測試可視化瀏覽器啟動
  console.log('\n4️⃣ 測試可視化瀏覽器啟動 (headless=false)...');
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ 可視化瀏覽器啟動成功');
    
    // 5. 測試頁面創建
    console.log('\n5️⃣ 測試頁面創建...');
    const page = await browser.newPage();
    console.log('✅ 頁面創建成功');
    
    // 6. 測試簡單網頁載入
    console.log('\n6️⃣ 測試本地 data URL 載入...');
    await page.goto('data:text/html,<h1>Test Page</h1>');
    console.log('✅ 本地頁面載入成功');
    
    // 7. 測試外部網站載入 (使用 example.com)
    console.log('\n7️⃣ 測試外部網站載入 (example.com)...');
    try {
      await page.goto('https://example.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
      });
      console.log('✅ 外部網站載入成功');
    } catch (error) {
      console.log(`❌ 外部網站載入失敗: ${error.message}`);
    }
    
    // 8. 測試目標網站載入
    console.log('\n8️⃣ 測試目標網站載入 (apollo.mayohr.com)...');
    try {
      await page.goto('https://apollo.mayohr.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      console.log('✅ 目標網站載入成功');
      
      const title = await page.title();
      console.log(`   頁面標題: ${title}`);
      
    } catch (error) {
      console.log(`❌ 目標網站載入失敗: ${error.message}`);
      console.log(`   這可能是網路問題或網站限制`);
    }
    
    // 等待一下讓使用者看到瀏覽器
    console.log('\n⏱️ 等待 3 秒讓您查看瀏覽器...');
    await page.waitForTimeout(3000);
    
    await browser.close();
    
  } catch (error) {
    console.log(`❌ 可視化瀏覽器啟動失敗: ${error.message}`);
    console.log(`   錯誤詳情: ${error.stack}`);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.log(`❌ 關閉瀏覽器失敗: ${closeError.message}`);
      }
    }
    return;
  }

  console.log('\n🎉 瀏覽器診斷完成！所有基本功能都正常工作。');
  console.log('   如果目標網站載入失敗，可能是網路連線或網站存取限制問題。');
}

// 增加詳細的錯誤處理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
  process.exit(1);
});

diagnoseBrowserStartup().catch(error => {
  console.error('\n❌ 診斷過程發生錯誤:', error.message);
  console.error('   完整錯誤:', error.stack);
  process.exit(1);
});

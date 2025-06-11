/**
 * 測試瀏覽器啟動功能
 * 確認 Chrome 安裝後是否能正常運行
 */

const puppeteer = require('puppeteer');

async function testBrowserLaunch() {
  console.log('🚀 開始測試瀏覽器啟動...');
  
  let browser = null;
  try {
    // 測試基本啟動
    console.log('1️⃣ 測試基本瀏覽器啟動...');
    browser = await puppeteer.launch({
      headless: false, // 顯示瀏覽器視窗
      defaultViewport: { width: 1280, height: 720 }
    });
    console.log('✅ 瀏覽器啟動成功！');

    // 創建新頁面
    console.log('2️⃣ 測試創建新頁面...');
    const page = await browser.newPage();
    console.log('✅ 頁面創建成功！');

    // 測試導航到簡單頁面
    console.log('3️⃣ 測試導航到 Google...');
    await page.goto('https://www.google.com', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    console.log('✅ Google 頁面載入成功！');

    // 等待 3 秒讓使用者看到結果
    console.log('⏳ 等待 3 秒...');
    await page.waitForTimeout(3000);

    // 測試導航到目標網站
    console.log('4️⃣ 測試導航到 Apollo HR 系統...');
    try {
      await page.goto('https://apollo.mayohr.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      console.log('✅ Apollo HR 系統頁面載入成功！');
      
      // 檢查頁面內容
      const title = await page.title();
      const url = page.url();
      console.log(`📄 頁面標題: ${title}`);
      console.log(`🌐 當前 URL: ${url}`);
      
      // 等待 5 秒讓使用者查看
      console.log('⏳ 等待 5 秒讓您查看頁面...');
      await page.waitForTimeout(5000);
      
    } catch (error) {
      console.log('⚠️ Apollo HR 系統連接失敗:', error.message);
      console.log('   但瀏覽器本身運行正常');
    }

    console.log('\n🎉 瀏覽器測試完成！所有基本功能正常。');

  } catch (error) {
    console.error('❌ 瀏覽器測試失敗:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 瀏覽器已關閉');
    }
  }
}

// 執行測試
testBrowserLaunch()
  .then(() => {
    console.log('\n✅ 所有測試通過！現在可以運行完整的登入程式了。');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 測試失敗:', error.message);
    process.exit(1);
  });

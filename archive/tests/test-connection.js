/**
 * 簡單的連線測試
 */

const puppeteer = require('puppeteer');

async function testConnection() {
  console.log('🔍 測試瀏覽器連線...');
  
  let browser = null;
  try {
    // 啟動瀏覽器
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    console.log('✅ 瀏覽器啟動成功');

    // 測試訪問 Google
    console.log('🌐 嘗試訪問 Google...');
    await page.goto('https://www.google.com', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    console.log('✅ Google 訪問成功');

    // 測試訪問目標網站
    console.log('🎯 嘗試訪問 Apollo HR 系統...');
    try {
      await page.goto('https://apollo.mayohr.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      console.log('✅ Apollo HR 系統訪問成功');
      
      // 等待 3 秒讓使用者查看
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.log('❌ Apollo HR 系統訪問失敗:', error.message);
      console.log('   這可能是因為網路限制、防火牆或網站問題');
    }

    console.log('🔍 連線測試完成');

  } catch (error) {
    console.error('❌ 連線測試失敗:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testConnection().catch(console.error);

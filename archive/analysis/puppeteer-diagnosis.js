/**
 * 詳細的瀏覽器啟動診斷工具
 * 測試不同的 Puppeteer 配置選項
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function diagnosePuppeteer() {
  console.log('🔍 開始 Puppeteer 詳細診斷...\n');

  // 1. 檢查 Puppeteer 版本和配置
  console.log('1️⃣ 檢查 Puppeteer 配置...');
  try {
    const puppeteerInfo = puppeteer.executablePath ? puppeteer.executablePath() : 'Not available';
    console.log(`   Puppeteer 可執行檔路徑: ${puppeteerInfo}`);
  } catch (error) {
    console.log(`   無法取得 Puppeteer 可執行檔路徑: ${error.message}`);
  }

  // 2. 檢查環境變數
  console.log('\n2️⃣ 檢查環境變數...');
  console.log(`   PUPPETEER_CACHE_DIR: ${process.env.PUPPETEER_CACHE_DIR || 'undefined'}`);
  console.log(`   PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'undefined'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);

  // 3. 測試不同的啟動配置
  const configs = [
    {
      name: '最簡單配置',
      options: {
        headless: 'new',
        args: []
      }
    },
    {
      name: '基本安全配置',
      options: {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      }
    },
    {
      name: '完整安全配置',
      options: {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ]
      }
    },
    {
      name: '指定可執行檔路徑',
      options: {
        headless: 'new',
        executablePath: '/Users/tnl-loso/.cache/puppeteer/chrome/mac_arm-121.0.6167.85/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      }
    }
  ];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    console.log(`\n${i + 3}️⃣ 測試配置: ${config.name}`);
    console.log(`   選項: ${JSON.stringify(config.options, null, 2)}`);
    
    let browser = null;
    try {
      console.log('   🚀 啟動瀏覽器...');
      browser = await puppeteer.launch(config.options);
      console.log('   ✅ 瀏覽器啟動成功！');
      
      console.log('   📄 創建新頁面...');
      const page = await browser.newPage();
      console.log('   ✅ 頁面創建成功！');
      
      console.log('   🌐 導航到 about:blank...');
      await page.goto('about:blank');
      console.log('   ✅ 導航成功！');
      
      console.log(`   🎉 配置 "${config.name}" 測試成功！`);
      
      // 如果成功，測試一個真實網站
      try {
        console.log('   🌍 測試導航到 Google...');
        await page.goto('https://www.google.com', { timeout: 10000 });
        console.log('   ✅ Google 導航成功！');
        
        // 成功的配置，保存到檔案
        const successConfig = {
          timestamp: new Date().toISOString(),
          configName: config.name,
          options: config.options,
          status: 'SUCCESS'
        };
        
        fs.writeFileSync(
          path.join(process.cwd(), 'working-puppeteer-config.json'),
          JSON.stringify(successConfig, null, 2)
        );
        console.log('   💾 成功配置已保存到 working-puppeteer-config.json');
        
      } catch (error) {
        console.log(`   ⚠️ 網路測試失敗: ${error.message}`);
      }
      
      break; // 找到工作配置就停止測試
      
    } catch (error) {
      console.log(`   ❌ 配置 "${config.name}" 失敗: ${error.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('   🔒 瀏覽器已關閉');
        } catch (error) {
          console.log(`   ⚠️ 關閉瀏覽器時出錯: ${error.message}`);
        }
      }
    }
  }

  console.log('\n🏁 診斷完成！');
}

// 執行診斷
diagnosePuppeteer()
  .then(() => {
    console.log('\n✅ 診斷程序完成');
  })
  .catch((error) => {
    console.error('\n❌ 診斷程序失敗:', error.message);
  });

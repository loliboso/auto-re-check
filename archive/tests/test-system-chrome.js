/**
 * 使用系統 Chrome 的測試
 * 避免 Puppeteer 內建的 Chrome 問題
 */

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

async function testWithSystemChrome() {
  console.log('🔍 測試使用系統 Chrome...\n');

  // 1. 檢查系統是否有 Chrome
  console.log('1️⃣ 檢查系統 Chrome...');
  const possibleChromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
  ];

  let systemChromePath = null;
  for (const path of possibleChromePaths) {
    try {
      execSync(`test -f "${path}"`, { stdio: 'ignore' });
      systemChromePath = path;
      console.log(`   ✅ 找到系統 Chrome: ${path}`);
      break;
    } catch (error) {
      // 繼續檢查下一個路徑
    }
  }

  if (!systemChromePath) {
    console.log('   ⚠️ 未找到系統 Chrome，將使用 Puppeteer 內建的 Chrome');
  }

  // 2. 測試配置
  const configs = [
    {
      name: '使用系統 Chrome (如果有)',
      options: systemChromePath ? {
        headless: false,
        executablePath: systemChromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      } : null
    },
    {
      name: '使用 Puppeteer Chrome (headless: false)',
      options: {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }
    },
    {
      name: '使用 Puppeteer Chrome (headless: true)',
      options: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }
    },
    {
      name: '最小配置',
      options: {
        headless: true,
        args: ['--no-sandbox']
      }
    }
  ];

  for (const config of configs) {
    if (!config.options) continue;

    console.log(`\n2️⃣ 測試配置: ${config.name}`);
    
    let browser = null;
    try {
      console.log('   🚀 啟動瀏覽器...');
      browser = await puppeteer.launch(config.options);
      console.log('   ✅ 瀏覽器啟動成功！');
      
      const page = await browser.newPage();
      console.log('   📄 頁面創建成功！');
      
      // 測試簡單導航
      await page.goto('data:text/html,<h1>Hello World</h1>');
      console.log('   🌐 簡單導航成功！');
      
      // 測試網路導航
      try {
        await page.goto('https://www.google.com', { timeout: 15000 });
        console.log('   🌍 網路導航成功！');
        
        const title = await page.title();
        console.log(`   📄 頁面標題: ${title}`);
        
        console.log(`\n🎉 配置 "${config.name}" 完全成功！`);
        
        // 保存成功配置
        const fs = require('fs');
        const successConfig = {
          timestamp: new Date().toISOString(),
          configName: config.name,
          options: config.options,
          status: 'SUCCESS'
        };
        
        fs.writeFileSync('working-config.json', JSON.stringify(successConfig, null, 2));
        console.log('   💾 成功配置已保存到 working-config.json');
        
        // 如果是非 headless 模式，等待一下讓使用者看到
        if (!config.options.headless) {
          console.log('   ⏳ 等待 5 秒讓您查看瀏覽器...');
          await page.waitForTimeout(5000);
        }
        
        break; // 成功就停止測試
        
      } catch (error) {
        console.log(`   ⚠️ 網路導航失敗: ${error.message}`);
        console.log('   但瀏覽器啟動是成功的！');
        
        // 即使網路失敗，瀏覽器啟動成功也算部分成功
        const fs = require('fs');
        const partialConfig = {
          timestamp: new Date().toISOString(),
          configName: config.name + ' (部分成功)',
          options: config.options,
          status: 'PARTIAL_SUCCESS',
          note: '瀏覽器啟動成功，但網路連接失敗'
        };
        
        fs.writeFileSync('working-config.json', JSON.stringify(partialConfig, null, 2));
        console.log('   💾 部分成功配置已保存');
        
        break; // 至少瀏覽器能啟動，就停止測試
      }
      
    } catch (error) {
      console.log(`   ❌ 配置 "${config.name}" 失敗: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
        console.log('   🔒 瀏覽器已關閉');
      }
    }
  }

  console.log('\n🏁 測試完成！');
}

// 執行測試
testWithSystemChrome()
  .then(() => {
    console.log('\n✅ 測試程序完成');
  })
  .catch((error) => {
    console.error('\n❌ 測試程序失敗:', error.message);
    console.error('完整錯誤信息:', error);
  });

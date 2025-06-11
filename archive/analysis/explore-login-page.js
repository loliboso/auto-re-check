/**
 * 登入頁面探索工具
 * 用於分析實際的登入頁面結構並找出正確的選擇器
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function exploreLoginPage() {
  console.log('🔍 開始探索登入頁面...\n');

  let browser = null;
  try {
    // 使用成功的配置啟動瀏覽器
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1280, height: 720 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    
    console.log('1️⃣ 導航到登入頁面...');
    await page.goto('https://apollo.mayohr.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const currentUrl = page.url();
    console.log(`   當前 URL: ${currentUrl}`);
    
    const title = await page.title();
    console.log(`   頁面標題: ${title}`);

    // 等待頁面完全載入
    await page.waitForTimeout(3000);

    console.log('\n2️⃣ 截圖當前頁面...');
    await page.screenshot({ 
      path: 'screenshots/current_page_analysis.png', 
      fullPage: true 
    });
    console.log('   截圖已保存到 screenshots/current_page_analysis.png');

    console.log('\n3️⃣ 分析頁面內容...');
    
    // 檢查是否有表單元素
    const forms = await page.$$('form');
    console.log(`   找到 ${forms.length} 個表單`);

    // 檢查所有輸入框
    const inputs = await page.$$eval('input', inputs => 
      inputs.map(input => ({
        type: input.type,
        id: input.id,
        name: input.name,
        className: input.className,
        placeholder: input.placeholder
      }))
    );
    
    console.log(`   找到 ${inputs.length} 個輸入框:`);
    inputs.forEach((input, index) => {
      console.log(`     ${index + 1}. Type: ${input.type}, ID: ${input.id}, Name: ${input.name}, Class: ${input.className}, Placeholder: ${input.placeholder}`);
    });

    // 檢查所有按鈕
    const buttons = await page.$$eval('button', buttons => 
      buttons.map(button => ({
        type: button.type,
        id: button.id,
        className: button.className,
        textContent: button.textContent.trim()
      }))
    );
    
    console.log(`   找到 ${buttons.length} 個按鈕:`);
    buttons.forEach((button, index) => {
      console.log(`     ${index + 1}. Type: ${button.type}, ID: ${button.id}, Class: ${button.className}, Text: ${button.textContent}`);
    });

    // 檢查頁面文字內容
    const bodyText = await page.$eval('body', el => el.textContent);
    const hasLoginKeywords = ['登入', 'login', '帳號', 'username', '密碼', 'password'].some(keyword => 
      bodyText.toLowerCase().includes(keyword.toLowerCase())
    );
    console.log(`   頁面包含登入相關關鍵字: ${hasLoginKeywords}`);

    // 嘗試常見的登入選擇器
    const commonSelectors = [
      '#username', '#user', '#account', '#email',
      'input[name="username"]', 'input[name="user"]', 'input[name="account"]',
      'input[type="text"]', 'input[type="email"]',
      '#password', '#pass', '#pwd',
      'input[name="password"]', 'input[name="pass"]', 'input[name="pwd"]',
      'input[type="password"]',
      '#companyCode', '#company', 'input[name="company"]',
      '#loginButton', '#login', 'button[type="submit"]',
      'input[type="submit"]'
    ];

    console.log('\n4️⃣ 測試常見選擇器...');
    const foundSelectors = [];
    
    for (const selector of commonSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const tagName = await element.evaluate(el => el.tagName);
          const type = await element.evaluate(el => el.type || '');
          const id = await element.evaluate(el => el.id || '');
          const name = await element.evaluate(el => el.name || '');
          const className = await element.evaluate(el => el.className || '');
          
          foundSelectors.push({
            selector,
            tagName,
            type,
            id,
            name,
            className
          });
          
          console.log(`   ✅ 找到: ${selector} -> ${tagName}${type ? `[${type}]` : ''}`);
        }
      } catch (error) {
        // 忽略錯誤，繼續測試
      }
    }

    // 保存分析結果
    const analysis = {
      timestamp: new Date().toISOString(),
      url: currentUrl,
      title: title,
      inputs: inputs,
      buttons: buttons,
      foundSelectors: foundSelectors,
      hasLoginKeywords: hasLoginKeywords
    };

    fs.writeFileSync('login-page-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n   📊 分析結果已保存到 login-page-analysis.json');

    console.log('\n5️⃣ 等待 10 秒讓您檢查頁面...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 探索失敗:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔒 瀏覽器已關閉');
    }
  }

  console.log('\n🏁 探索完成！請檢查截圖和分析結果檔案。');
}

// 執行探索
exploreLoginPage()
  .then(() => {
    console.log('\n✅ 探索程序完成');
  })
  .catch((error) => {
    console.error('\n❌ 探索程序失敗:', error.message);
  });

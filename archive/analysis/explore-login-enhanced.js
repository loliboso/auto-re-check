/**
 * 改良的登入頁面探索工具
 * 正確處理彈出視窗並分析登入表單
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function exploreLoginPageEnhanced() {
  console.log('🔍 開始改良的登入頁面探索...\n');

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

    // 截圖當前頁面（可能有彈出視窗）
    console.log('\n2️⃣ 截圖當前頁面（可能有彈出視窗）...');
    await page.screenshot({ path: 'screenshots/popup_page.png', fullPage: true });
    console.log('   截圖已保存到 screenshots/popup_page.png');

    // 處理彈出視窗
    console.log('\n3️⃣ 處理彈出視窗...');
    try {
      // 等待並點擊確定按鈕
      const confirmButton = await page.waitForSelector('.btn.btn-default', { timeout: 5000 });
      if (confirmButton) {
        console.log('   找到確定按鈕，點擊關閉彈出視窗...');
        await confirmButton.click();
        await page.waitForTimeout(3000); // 等待彈出視窗關閉和頁面載入
      }
    } catch (error) {
      console.log('   未找到彈出視窗或已關閉');
    }

    // 截圖處理彈出視窗後的頁面
    console.log('\n4️⃣ 截圖處理彈出視窗後的頁面...');
    await page.screenshot({ path: 'screenshots/after_popup_handled.png', fullPage: true });
    console.log('   截圖已保存到 screenshots/after_popup_handled.png');

    // 分析登入頁面內容
    console.log('\n5️⃣ 分析登入頁面內容...');
    
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
        placeholder: input.placeholder,
        value: input.value
      }))
    );
    
    console.log(`   找到 ${inputs.length} 個輸入框:`);
    inputs.forEach((input, index) => {
      console.log(`     ${index + 1}. Type: ${input.type}, ID: ${input.id}, Name: ${input.name}, Class: ${input.className}, Placeholder: ${input.placeholder}`);
    });

    // 檢查所有選擇框 (select)
    const selects = await page.$$eval('select', selects => 
      selects.map(select => ({
        id: select.id,
        name: select.name,
        className: select.className,
        options: Array.from(select.options).map(option => ({
          value: option.value,
          text: option.text
        }))
      }))
    );
    
    console.log(`   找到 ${selects.length} 個選擇框:`);
    selects.forEach((select, index) => {
      console.log(`     ${index + 1}. ID: ${select.id}, Name: ${select.name}, Class: ${select.className}`);
      console.log(`        選項: ${select.options.map(opt => `${opt.text}(${opt.value})`).join(', ')}`);
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
    const hasLoginKeywords = ['登入', 'login', '帳號', 'username', '密碼', 'password', '公司', 'company'].some(keyword => 
      bodyText.toLowerCase().includes(keyword.toLowerCase())
    );
    console.log(`   頁面包含登入相關關鍵字: ${hasLoginKeywords}`);

    // 嘗試常見的登入選擇器
    const commonSelectors = [
      // 帳號相關
      '#username', '#user', '#account', '#email', '#userId',
      'input[name="username"]', 'input[name="user"]', 'input[name="account"]', 'input[name="userId"]',
      'input[type="text"]', 'input[type="email"]',
      
      // 密碼相關
      '#password', '#pass', '#pwd',
      'input[name="password"]', 'input[name="pass"]', 'input[name="pwd"]',
      'input[type="password"]',
      
      // 公司代碼相關
      '#companyCode', '#company', '#companyId', '#corp', '#corpCode',
      'input[name="companyCode"]', 'input[name="company"]', 'input[name="companyId"]',
      'select[name="companyCode"]', 'select[name="company"]', 'select[name="companyId"]',
      
      // 登入按鈕
      '#loginButton', '#login', 'button[type="submit"]', 'input[type="submit"]',
      '.login-btn', '.btn-login'
    ];

    console.log('\n6️⃣ 測試常見選擇器...');
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
          const placeholder = await element.evaluate(el => el.placeholder || '');
          
          foundSelectors.push({
            selector,
            tagName,
            type,
            id,
            name,
            className,
            placeholder
          });
          
          console.log(`   ✅ 找到: ${selector} -> ${tagName}${type ? `[${type}]` : ''} (ID: ${id}, Name: ${name})`);
        }
      } catch (error) {
        // 忽略錯誤，繼續測試
      }
    }

    // 額外檢查：尋找所有可能的登入相關元素
    console.log('\n7️⃣ 深度搜尋登入相關元素...');
    const loginElements = await page.evaluate(() => {
      const elements = [];
      
      // 搜尋所有包含登入相關文字的元素
      const allElements = document.querySelectorAll('*');
      const keywords = ['登入', 'login', '帳號', 'account', 'username', '密碼', 'password', '公司', 'company'];
      
      allElements.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const id = el.id?.toLowerCase() || '';
        const name = el.name?.toLowerCase() || '';
        const className = el.className?.toLowerCase() || '';
        const placeholder = el.placeholder?.toLowerCase() || '';
        
        const hasKeyword = keywords.some(keyword => 
          text.includes(keyword) || id.includes(keyword) || 
          name.includes(keyword) || className.includes(keyword) || 
          placeholder.includes(keyword)
        );
        
        if (hasKeyword) {
          elements.push({
            tagName: el.tagName,
            type: el.type || '',
            id: el.id || '',
            name: el.name || '',
            className: el.className || '',
            textContent: el.textContent?.trim().substring(0, 50) || '',
            placeholder: el.placeholder || ''
          });
        }
      });
      
      return elements;
    });
    
    console.log(`   找到 ${loginElements.length} 個相關元素:`);
    loginElements.forEach((element, index) => {
      console.log(`     ${index + 1}. ${element.tagName}${element.type ? `[${element.type}]` : ''} - ID: ${element.id}, Name: ${element.name}, Text: ${element.textContent}`);
    });

    // 保存詳細分析結果
    const analysis = {
      timestamp: new Date().toISOString(),
      url: currentUrl,
      title: title,
      forms: forms.length,
      inputs: inputs,
      selects: selects,
      buttons: buttons,
      foundSelectors: foundSelectors,
      loginElements: loginElements,
      hasLoginKeywords: hasLoginKeywords
    };

    fs.writeFileSync('enhanced-login-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n   📊 詳細分析結果已保存到 enhanced-login-analysis.json');

    console.log('\n8️⃣ 等待 15 秒讓您檢查頁面...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('❌ 探索失敗:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔒 瀏覽器已關閉');
    }
  }

  console.log('\n🏁 改良探索完成！請檢查截圖和分析結果檔案。');
}

// 執行探索
exploreLoginPageEnhanced()
  .then(() => {
    console.log('\n✅ 改良探索程序完成');
  })
  .catch((error) => {
    console.error('\n❌ 改良探索程序失敗:', error.message);
  });

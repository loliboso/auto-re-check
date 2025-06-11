/**
 * 主頁面表單申請按鈕分析工具
 * 登入成功後分析主頁面找出正確的表單申請按鈕選擇器
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function analyzeMainPageButtons() {
  console.log('🔍 開始分析主頁面表單申請按鈕...\n');

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
    
    console.log('2️⃣ 處理彈出視窗...');
    try {
      const confirmButton = await page.waitForSelector('.btn.btn-default', { timeout: 5000 });
      if (confirmButton) {
        console.log('   點擊確定按鈕關閉彈出視窗...');
        await confirmButton.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
      }
    } catch (error) {
      console.log('   未找到彈出視窗，繼續流程');
    }

    console.log('3️⃣ 填寫登入表單...');
    
    // 等待登入表單載入
    await page.waitForTimeout(3000);
    
    // 檢查是否有登入表單
    const companyCodeField = await page.$('input[name="companyCode"]');
    const employeeNoField = await page.$('input[name="employeeNo"]');
    const passwordField = await page.$('input[name="password"]');
    const submitButton = await page.$('button[type="submit"]');
    
    console.log('   登入表單檢查:');
    console.log(`   - 公司代碼欄位: ${companyCodeField ? '✅ 找到' : '❌ 未找到'}`);
    console.log(`   - 工號欄位: ${employeeNoField ? '✅ 找到' : '❌ 未找到'}`);
    console.log(`   - 密碼欄位: ${passwordField ? '✅ 找到' : '❌ 未找到'}`);
    console.log(`   - 提交按鈕: ${submitButton ? '✅ 找到' : '❌ 未找到'}`);
    
    if (!companyCodeField || !employeeNoField || !passwordField || !submitButton) {
      console.log('   ⚠️  登入表單不完整，截圖檢查...');
      await page.screenshot({ path: 'screenshots/login_form_incomplete.png', fullPage: true });
      throw new Error('登入表單不完整');
    }
    
    // 填寫公司代碼
    await companyCodeField.click();
    await page.waitForTimeout(100);
    await companyCodeField.evaluate(el => el.value = '');
    await companyCodeField.type('TNLMG', { delay: 50 });
    console.log('   ✅ 公司代碼填寫完成');

    // 填寫工號
    await employeeNoField.click();
    await page.waitForTimeout(100);
    await employeeNoField.evaluate(el => el.value = '');
    await employeeNoField.type('TNL011', { delay: 50 });
    console.log('   ✅ 工號填寫完成');

    // 填寫密碼
    await passwordField.click();
    await page.waitForTimeout(100);
    await passwordField.evaluate(el => el.value = '');
    await passwordField.type('R9498LUoCoCcgF', { delay: 50 });
    console.log('   ✅ 密碼填寫完成');
    
    // 截圖登入表單填寫完成
    await page.screenshot({ path: 'screenshots/login_form_completed.png', fullPage: true });
    console.log('   📸 登入表單填寫完成截圖已保存');

    // 提交登入
    console.log('   🚀 提交登入表單...');
    await submitButton.click();
    
    try {
      // 等待導航到主頁面，增加超時時間
      console.log('   ⏳ 等待登入處理和頁面導航...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const postLoginUrl = page.url();
      console.log(`   📍 登入後的 URL: ${postLoginUrl}`);
      
      // 檢查是否登入成功
      if (postLoginUrl.includes('logout')) {
        console.log('   ❌ 登入失敗 - 被導向登出頁面');
        await page.screenshot({ path: 'screenshots/login_failed_logout.png', fullPage: true });
        throw new Error('登入失敗，被導向登出頁面');
      } else if (postLoginUrl.includes('apollo.mayohr.com')) {
        console.log('   ✅ 登入成功 - 到達主頁面');
      } else {
        console.log('   ⚠️  登入結果不明確');
      }
      
    } catch (navigationError) {
      console.log('   ⚠️  導航等待超時，檢查當前頁面...');
      const currentUrl = page.url();
      console.log(`   📍 當前 URL: ${currentUrl}`);
      await page.screenshot({ path: 'screenshots/navigation_timeout.png', fullPage: true });
    }

    console.log('4️⃣ 分析主頁面按鈕和連結...');
    
    const currentUrl = page.url();
    console.log(`   當前 URL: ${currentUrl}`);
    
    // 截圖主頁面
    await page.screenshot({ path: 'screenshots/main_page_analysis.png', fullPage: true });
    console.log('   截圖已保存到 screenshots/main_page_analysis.png');
    
    // 等待頁面完全載入
    await page.waitForTimeout(5000);

    // 分析所有連結
    const allLinks = await page.$$eval('a', links => 
      links.map(link => ({
        href: link.href || '',
        textContent: link.textContent?.trim() || '',
        className: link.className || '',
        outerHTML: link.outerHTML?.substring(0, 200) || ''
      }))
    );
    
    console.log(`   找到 ${allLinks.length} 個連結:`);
    
    // 過濾出可能的表單申請連結
    const formLinks = allLinks.filter(link => 
      link.href.includes('bpm') || 
      link.href.includes('applyform') ||
      link.href.includes('sso-redirect') ||
      link.textContent.includes('表單') ||
      link.textContent.includes('申請') ||
      link.className.includes('link-item')
    );
    
    console.log(`   找到 ${formLinks.length} 個可能的表單申請連結:`);
    formLinks.forEach((link, index) => {
      console.log(`     ${index + 1}. Text: "${link.textContent}"`);
      console.log(`        href: ${link.href}`);
      console.log(`        class: ${link.className}`);
      console.log(`        HTML: ${link.outerHTML}`);
      console.log('');
    });

    // 測試常見的表單申請選擇器
    const testSelectors = [
      'a.link-item__link',
      'a.link-item__link[href*="bpm"]',
      'a.link-item__link[href*="sso-redirect"]',
      'a.link-item__link[href*="applyform"]',
      'a[href*="bpm/applyform"]',
      'a[href*="sso-redirect"]',
      '.link-item__link',
      '[data-target*="bpm"]'
    ];

    console.log('5️⃣ 測試常見選擇器...');
    const foundElements = [];
    
    for (const selector of testSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`   ✅ 找到 ${elements.length} 個元素: ${selector}`);
          
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const href = await element.evaluate(el => el.href || '');
            const text = await element.evaluate(el => el.textContent?.trim() || '');
            const className = await element.evaluate(el => el.className || '');
            
            foundElements.push({
              selector,
              index: i,
              href,
              text,
              className
            });
            
            console.log(`     ${i + 1}. href: ${href}`);
            console.log(`        text: "${text}"`);
            console.log(`        class: ${className}`);
          }
        }
      } catch (error) {
        // 繼續測試下一個選擇器
      }
    }

    // 保存分析結果
    const analysis = {
      timestamp: new Date().toISOString(),
      url: currentUrl,
      allLinksCount: allLinks.length,
      formLinksCount: formLinks.length,
      formLinks: formLinks,
      foundElements: foundElements,
      testSelectors: testSelectors
    };

    fs.writeFileSync('main-page-button-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n   📊 分析結果已保存到 main-page-button-analysis.json');

    console.log('\n6️⃣ 等待 10 秒讓您檢查頁面...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 分析失敗:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔒 瀏覽器已關閉');
    }
  }

  console.log('\n🏁 主頁面按鈕分析完成！');
}

// 執行分析
analyzeMainPageButtons()
  .then(() => {
    console.log('\n✅ 分析程序完成');
  })
  .catch((error) => {
    console.error('\n❌ 分析程序失敗:', error.message);
  });

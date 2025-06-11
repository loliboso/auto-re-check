/**
 * 測試表單申請按鈕點擊行為
 * 檢查是否會開啟新分頁
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testFormApplicationButton() {
  console.log('🔍 測試表單申請按鈕點擊行為...\n');

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized'
      ]
    });

    const page = await browser.newPage();
    
    console.log('1️⃣ 登入流程...');
    await page.goto('https://apollo.mayohr.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('   頁面已載入，當前 URL:', page.url());
    
    // 處理彈出視窗
    console.log('   處理彈出視窗...');
    try {
      const confirmButton = await page.waitForSelector('.btn.btn-default', { timeout: 5000 });
      if (confirmButton) {
        console.log('   找到確定按鈕，點擊關閉彈出視窗...');
        await confirmButton.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log('   彈出視窗已處理，當前 URL:', page.url());
      }
    } catch (error) {
      console.log('   未找到彈出視窗，繼續流程');
    }

    // 等待登入表單載入
    console.log('   等待登入表單載入...');
    await page.waitForTimeout(3000);

    // 登入
    console.log('   填寫登入表單...');
    const companyCodeField = await page.$('input[name="companyCode"]');
    const employeeNoField = await page.$('input[name="employeeNo"]');
    const passwordField = await page.$('input[name="password"]');
    const submitButton = await page.$('button[type="submit"]');
    
    console.log(`   - 公司代碼欄位: ${companyCodeField ? '✅' : '❌'}`);
    console.log(`   - 工號欄位: ${employeeNoField ? '✅' : '❌'}`);
    console.log(`   - 密碼欄位: ${passwordField ? '✅' : '❌'}`);
    console.log(`   - 提交按鈕: ${submitButton ? '✅' : '❌'}`);
    
    if (companyCodeField && employeeNoField && passwordField && submitButton) {
      console.log('   - 填寫公司代碼...');
      await companyCodeField.click();
      await companyCodeField.evaluate(el => el.value = '');
      await companyCodeField.type('TNLMG', { delay: 50 });
      
      console.log('   - 填寫工號...');
      await employeeNoField.click();
      await employeeNoField.evaluate(el => el.value = '');
      await employeeNoField.type('TNL011', { delay: 50 });
      
      console.log('   - 填寫密碼...');
      await passwordField.click();
      await passwordField.evaluate(el => el.value = '');
      await passwordField.type('R9498LUoCoCcgF', { delay: 50 });
      
      console.log('   - 提交登入表單...');
      await submitButton.click();
      
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('   ✅ 登入成功 - 頁面已導航');
      } catch (error) {
        console.log('   ⚠️  導航超時，檢查當前頁面狀態...');
        const postLoginUrl = page.url();
        console.log(`   登入後 URL: ${postLoginUrl}`);
        
        if (postLoginUrl.includes('apollo.mayohr.com') && !postLoginUrl.includes('login')) {
          console.log('   ✅ 登入成功 - 已在主頁面');
        } else if (postLoginUrl.includes('logout')) {
          console.log('   ❌ 登入失敗 - 被導向登出頁面');
          await page.screenshot({ path: 'screenshots/login_failed_logout.png', fullPage: true });
          throw new Error('登入失敗');
        } else {
          console.log('   ⚠️  登入狀態不明');
        }
      }
    } else {
      console.log('   ❌ 登入表單不完整，截圖檢查...');
      await page.screenshot({ path: 'screenshots/login_form_incomplete.png', fullPage: true });
      throw new Error('登入表單不完整');
    }

    console.log('\n2️⃣ 尋找並測試表單申請按鈕...');
    
    // 等待頁面完全載入
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log(`   當前 URL: ${currentUrl}`);
    
    // 監聽新分頁開啟事件
    let newPage = null;
    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        newPage = await target.page();
        console.log('   🎯 偵測到新分頁開啟!');
        console.log(`   新分頁 URL: ${newPage.url()}`);
      }
    });
    
    // 尋找表單申請按鈕
    const formAppLink = await page.$('a.link-item__link[href*="targetPath=bpm%2Fapplyform%3FmoduleType%3Dapply"]');
    
    if (formAppLink) {
      const linkText = await formAppLink.evaluate(el => el.textContent?.trim());
      const linkHref = await formAppLink.evaluate(el => el.href);
      
      console.log(`   找到表單申請按鈕: "${linkText}"`);
      console.log(`   連結: ${linkHref}`);
      
      if (linkText && linkText.includes('表單申請')) {
        console.log('3️⃣ 點擊表單申請按鈕...');
        
        // 點擊按鈕
        await formAppLink.click();
        console.log('   ✅ 按鈕已點擊');
        
        // 等待一段時間看看會發生什麼
        console.log('   ⏳ 等待 10 秒觀察結果...');
        await page.waitForTimeout(10000);
        
        // 檢查結果
        const finalUrl = page.url();
        console.log(`   當前頁面 URL: ${finalUrl}`);
        
        if (newPage) {
          const newPageUrl = newPage.url();
          console.log(`   新分頁 URL: ${newPageUrl}`);
          
          if (newPageUrl.includes('bpm/applyform')) {
            console.log('   🎉 成功！表單申請頁面在新分頁中開啟');
            
            // 切換到新分頁
            await newPage.bringToFront();
            await newPage.screenshot({ path: 'screenshots/form_application_new_tab.png', fullPage: true });
            console.log('   📸 新分頁截圖已保存');
            
            return {
              success: true,
              behavior: 'new_tab',
              originalUrl: currentUrl,
              finalUrl: finalUrl,
              newTabUrl: newPageUrl
            };
          }
        } else if (finalUrl !== currentUrl) {
          console.log('   🎉 成功！在當前分頁中導航到表單申請頁面');
          await page.screenshot({ path: 'screenshots/form_application_same_tab.png', fullPage: true });
          
          return {
            success: true,
            behavior: 'same_tab',
            originalUrl: currentUrl,
            finalUrl: finalUrl
          };
        } else {
          console.log('   ❌ 點擊後沒有導航或開啟新分頁');
          await page.screenshot({ path: 'screenshots/form_application_no_change.png', fullPage: true });
          
          return {
            success: false,
            behavior: 'no_change',
            originalUrl: currentUrl,
            finalUrl: finalUrl
          };
        }
      }
    } else {
      console.log('   ❌ 未找到表單申請按鈕');
      await page.screenshot({ path: 'screenshots/form_button_not_found.png', fullPage: true });
      
      return {
        success: false,
        behavior: 'button_not_found'
      };
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    await page.screenshot({ path: 'screenshots/test_error.png', fullPage: true });
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      console.log('\n⏳ 等待 5 秒讓您檢查結果...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
      console.log('🔒 瀏覽器已關閉');
    }
  }
}

// 執行測試
testFormApplicationButton()
  .then((result) => {
    console.log('\n📊 測試結果:');
    console.log(JSON.stringify(result, null, 2));
    
    // 保存結果
    fs.writeFileSync('form-button-test-result.json', JSON.stringify(result, null, 2));
    console.log('結果已保存到 form-button-test-result.json');
  })
  .catch((error) => {
    console.error('\n❌ 測試程序失敗:', error.message);
  });

/**
 * 第一階段測試 - 使用 CommonJS 語法
 */

console.log('=== 第一階段功能測試 ===');

// 測試基本的日誌功能（不依賴外部模組）
const createSimpleLogger = () => {
  const fs = require('fs');
  const path = require('path');
  
  const logsDir = './logs/';
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
  const logFile = path.join(logsDir, `test-${timestamp}.log`);

  return {
    info: (message: string) => {
      const logLine = `[${new Date().toISOString()}] [INFO] ${message}\n`;
      fs.appendFileSync(logFile, logLine);
      console.log(`[INFO] ${message}`);
    },
    error: (message: string, error?: Error) => {
      const logLine = `[${new Date().toISOString()}] [ERROR] ${message} ${error?.message || ''}\n`;
      fs.appendFileSync(logFile, logLine);
      console.error(`[ERROR] ${message}`, error?.message || '');
    }
  };
};

// 測試範例配置檔案讀取
const testConfigFile = () => {
  const fs = require('fs');
  const configPath = './data/user-info.txt';
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      console.log('✅ 配置檔案讀取成功');
      console.log('配置檔案內容:');
      console.log(content);
      return true;
    } else {
      console.log('❌ 配置檔案不存在');
      return false;
    }
  } catch (error) {
    console.error('❌ 配置檔案讀取失敗:', error);
    return false;
  }
};

// 執行測試
async function runTests() {
  const logger = createSimpleLogger();
  
  logger.info('開始執行第一階段測試');
  
  // 測試 1: 配置檔案
  console.log('\n--- 測試 1: 配置檔案讀取 ---');
  const configTest = testConfigFile();
  
  // 測試 2: 目錄結構
  console.log('\n--- 測試 2: 目錄結構檢查 ---');
  const fs = require('fs');
  const requiredDirs = ['./logs', './screenshots', './data'];
  for (const dir of requiredDirs) {
    if (fs.existsSync(dir)) {
      console.log(`✅ ${dir} 目錄存在`);
    } else {
      console.log(`❌ ${dir} 目錄不存在，正在建立...`);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ ${dir} 目錄已建立`);
    }
  }
  
  // 測試 3: 基本環境
  console.log('\n--- 測試 3: 環境檢查 ---');
  console.log(`✅ Node.js 版本: ${process.version}`);
  console.log(`✅ 平台: ${process.platform}`);
  console.log(`✅ 工作目錄: ${process.cwd()}`);
  
  logger.info('第一階段測試完成');
  console.log('\n=== 第一階段基礎測試完成 ===');
  
  if (configTest) {
    console.log('\n下一步: 準備測試登入功能');
  } else {
    console.log('\n請確保 data/user-info.txt 檔案存在且格式正確');
  }
}

runTests().catch(console.error);

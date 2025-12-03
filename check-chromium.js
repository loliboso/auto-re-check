// 診斷腳本：檢查系統中的 Chromium 路徑
const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== Chromium 路徑診斷 ===\n');

const possiblePaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  process.env.PUPPETEER_EXECUTABLE_PATH
];

console.log('檢查可能的路徑：');
possiblePaths.forEach(path => {
  if (path && fs.existsSync(path)) {
    console.log(`✅ ${path} - 存在`);
  } else {
    console.log(`❌ ${path} - 不存在`);
  }
});

console.log('\n嘗試用 which 命令查找：');
['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].forEach(cmd => {
  try {
    const result = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
    console.log(`✅ ${cmd}: ${result}`);
  } catch (e) {
    console.log(`❌ ${cmd}: 未找到`);
  }
});

console.log('\n環境變數：');
console.log(`PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || '未設定'}`);
console.log(`Platform: ${process.platform}`);

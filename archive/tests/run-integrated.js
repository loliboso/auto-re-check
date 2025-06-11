#!/usr/bin/env node

/**
 * 整合版自動補卡程式執行器
 * 
 * 這個腳本提供一個簡單的方式來執行整合版自動補卡程式
 * 不需要修改任何現有的程式碼
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 啟動整合版自動補卡程式...');
console.log('📋 程式將依序執行：');
console.log('   1. Phase1: 登入功能');
console.log('   2. Phase2: 補卡功能');
console.log('   3. 在同一個瀏覽器 session 中完成所有流程');
console.log('');

// 執行 TypeScript 檔案
const tsxPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const scriptPath = path.join(__dirname, 'integrated-main.ts');

const child = spawn('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('');
    console.log('✅ 程式執行完成！');
  } else {
    console.log('');
    console.log('❌ 程式執行失敗，錯誤代碼:', code);
    console.log('請檢查日誌檔案了解詳細錯誤資訊');
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ 啟動程式時發生錯誤:', error.message);
  console.log('');
  console.log('🔧 可能的解決方案：');
  console.log('   1. 確保已安裝 Node.js 和 npm');
  console.log('   2. 執行 npm install 安裝相依套件');
  console.log('   3. 確保 tsx 套件已安裝：npm install -g tsx');
  process.exit(1);
});

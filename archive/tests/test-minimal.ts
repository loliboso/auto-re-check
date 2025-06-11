/**
 * 最小化的主程式測試
 * 用於驗證 TypeScript 編譯是否正常
 */

// 測試基本的 Node.js 匯入
import * as fs from 'fs';
import * as path from 'path';

// 簡單的測試類別
export class MinimalTest {
  constructor() {
    console.log('MinimalTest 建構完成');
  }

  async run(): Promise<void> {
    console.log('=== 最小化測試開始 ===');
    
    // 測試檔案系統操作
    const currentDir = process.cwd();
    console.log('當前目錄:', currentDir);
    
    // 測試資料夾是否存在
    const dataDir = path.join(currentDir, 'data');
    const logsDir = path.join(currentDir, 'logs');
    
    console.log('data 目錄是否存在:', fs.existsSync(dataDir));
    console.log('logs 目錄是否存在:', fs.existsSync(logsDir));
    
    // 測試配置檔案是否存在
    const configFile = path.join(dataDir, 'user-info.txt');
    console.log('配置檔案是否存在:', fs.existsSync(configFile));
    
    if (fs.existsSync(configFile)) {
      const content = fs.readFileSync(configFile, 'utf-8');
      console.log('配置檔案內容長度:', content.length);
    }
    
    console.log('=== 最小化測試完成 ===');
  }
}

// 主程式執行
async function main() {
  try {
    const test = new MinimalTest();
    await test.run();
    console.log('✅ 測試成功完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    process.exit(1);
  }
}

// 如果此檔案被直接執行，則執行主程式
if (require.main === module) {
  main().catch(console.error);
}

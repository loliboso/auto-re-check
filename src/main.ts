/**
 * 自動補卡程式入口點
 * 第一階段：登入功能實作
 */

import { MainService } from './services/main.service';

async function main() {
  const mainService = new MainService();

  try {
    await mainService.execute();
    console.log('\n程式執行完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n程式執行失敗:', (error as Error).message);
    process.exit(1);
  }
}

// 處理未捕獲的例外
process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕獲的例外:', error);
  process.exit(1);
});

// 執行主程式
main();

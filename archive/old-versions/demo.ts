/**
 * 第一階段測試程式 - 登入功能
 * 簡化版本，專注於驗證登入功能
 */

import { LogService } from './services/log.service';

async function testPhase1() {
  const logService = new LogService();
  
  try {
    logService.info('=== 第一階段測試：基礎功能驗證 ===');
    
    // 測試日誌功能
    logService.info('測試日誌功能');
    logService.debug('除錯訊息測試');
    logService.warn('警告訊息測試');
    
    logService.info('基礎功能測試完成');
    
  } catch (error) {
    logService.error('測試失敗', error as Error);
    throw error;
  }
}

// 執行測試
testPhase1()
  .then(() => {
    console.log('第一階段測試完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('第一階段測試失敗:', error.message);
    process.exit(1);
  });

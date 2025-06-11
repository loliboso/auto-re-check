/**
 * 第一階段測試 - 逐步測試模組匯入
 */

// 第1步：測試常數模組
console.log('步驟 1: 測試常數模組匯入...');
import { SYSTEM_CONFIG } from './config/constants';
console.log('✅ 常數模組匯入成功');
console.log(`   登入 URL: ${SYSTEM_CONFIG.URLS.LOGIN_URL}`);

// 第2步：測試型別模組
console.log('\n步驟 2: 測試型別模組匯入...');
import { AttendanceType } from './types';
console.log('✅ 型別模組匯入成功');
console.log(`   出勤類型: ${AttendanceType.CLOCK_IN}`);

// 第3步：測試日誌服務
console.log('\n步驟 3: 測試日誌服務...');
import { LogService } from './services/log.service';
const logService = new LogService();
logService.info('日誌服務測試訊息');
console.log('✅ 日誌服務測試成功');

console.log('\n=== 模組匯入測試完成 ===');

/**
 * 第一階段基礎測試
 * 測試 TypeScript 編譯和基本功能
 */

console.log('=== 第一階段測試開始 ===');
console.log('測試基礎 TypeScript 功能...');

// 測試基本的 TypeScript 功能
interface TestConfig {
  name: string;
  version: number;
}

const config: TestConfig = {
  name: '自動補卡程式',
  version: 1
};

console.log(`程式名稱: ${config.name}`);
console.log(`版本: ${config.version}`);
console.log('基礎功能測試完成');
console.log('=== 第一階段測試結束 ===');

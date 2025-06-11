/**
 * 型別定義統一匯出
 * 按照 TECHNICAL_SPEC.md 規格實作
 */

// 使用者配置相關型別
export type { LoginInfo, UserConfig } from './user-config';

// 出勤記錄相關型別
export { AttendanceType } from './attendance';
export type { AttendanceRecord } from './attendance';

// 系統狀態相關型別
export type { ExecutionState, FormState, RetryConfig, ValidationResult } from './system';

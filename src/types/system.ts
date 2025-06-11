/**
 * 系統狀態型別定義
 * 按照 TECHNICAL_SPEC.md 規格實作
 */

import type { AttendanceRecord } from './attendance';

/**
 * 執行狀態介面
 */
export interface ExecutionState {
  /** 當前處理的記錄 */
  currentRecord: AttendanceRecord | null;
  /** 當前子任務 */
  currentSubTask: 'CLOCK_IN' | 'CLOCK_OUT' | null;
  /** 已完成的記錄 */
  completedRecords: AttendanceRecord[];
  /** 失敗位置 */
  failedAt: string | null;
}

/**
 * 表單狀態介面
 */
export interface FormState {
  /** 表單是否已載入 */
  isFormLoaded: boolean;
  /** 主要 iframe 是否準備就緒 */
  isMainIframeReady: boolean;
  /** Banner iframe 是否準備就緒 */
  isBannerIframeReady: boolean;
  /** 是否有既有記錄警告 */
  hasExistingRecordAlert: boolean;
}

/**
 * 重試配置介面
 */
export interface RetryConfig {
  /** 最大重試次數 */
  maxRetries: number;
  /** 當前重試次數 */
  currentRetry: number;
}

/**
 * 驗證結果介面
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 錯誤訊息列表 */
  errors: string[];
}

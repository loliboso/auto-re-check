/**
 * 出勤記錄相關型別定義
 * 按照 TECHNICAL_SPEC.md 規格實作
 */

/**
 * 補卡類型枚舉
 */
export enum AttendanceType {
  /** 上班未打卡 */
  CLOCK_IN = 'CLOCK_IN',
  /** 下班未打卡 */
  CLOCK_OUT = 'CLOCK_OUT',
  /** 上班未打卡 / 下班未打卡 */
  BOTH = 'BOTH'
}

/**
 * 出勤記錄介面
 */
export interface AttendanceRecord {
  /** 日期 (yyyy/mm/dd 格式) */
  date: string;
  /** 補卡類型 */
  type: AttendanceType;
  /** 原始文字 */
  rawText: string;
}

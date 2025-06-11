/**
 * 使用者配置型別定義
 * 按照 TECHNICAL_SPEC.md 規格實作
 */

import type { AttendanceRecord } from './attendance';

/**
 * 登入資訊介面
 */
export interface LoginInfo {
  /** 公司代碼 */
  companyCode: string;
  /** 登入帳號 */
  username: string;
  /** 密碼 */
  password: string;
}

/**
 * 使用者配置介面
 * 包含登入資訊和出勤記錄
 */
export interface UserConfig {
  /** 登入資訊 */
  loginInfo: LoginInfo;
  /** 出勤記錄列表 */
  attendanceRecords: AttendanceRecord[];
}

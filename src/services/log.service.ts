/**
 * 日誌服務
 * 負責處理所有日誌記錄功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { SYSTEM_CONFIG } from '../config/constants';

export class LogService {
  private logFilePath: string;

  constructor() {
    // 確保 logs 目錄存在
    if (!fs.existsSync(SYSTEM_CONFIG.PATHS.LOGS_DIR)) {
      fs.mkdirSync(SYSTEM_CONFIG.PATHS.LOGS_DIR, { recursive: true });
    }

    // 建立日誌檔案名稱（包含時間戳記）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.logFilePath = path.join(SYSTEM_CONFIG.PATHS.LOGS_DIR, `auto-recheck-${timestamp}.log`);
  }

  /**
   * 記錄錯誤訊息
   */
  error(message: string, error?: Error, context?: any): void {
    this.log(SYSTEM_CONFIG.LOG_LEVELS.ERROR, message, { error: error?.message, stack: error?.stack, ...context });
  }

  /**
   * 記錄警告訊息
   */
  warn(message: string, context?: any): void {
    this.log(SYSTEM_CONFIG.LOG_LEVELS.WARN, message, context);
  }

  /**
   * 記錄資訊訊息
   */
  info(message: string, context?: any): void {
    this.log(SYSTEM_CONFIG.LOG_LEVELS.INFO, message, context);
  }

  /**
   * 記錄除錯訊息
   */
  debug(message: string, context?: any): void {
    this.log(SYSTEM_CONFIG.LOG_LEVELS.DEBUG, message, context);
  }

  /**
   * 內部日誌記錄方法
   */
  private log(level: string, message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const logLine = `[${timestamp}] [${level}] ${message}${contextStr}\n`;

    // 寫入檔案
    fs.appendFileSync(this.logFilePath, logLine);

    // 也輸出到控制台
    console.log(`[${level}] ${message}`, context || '');
  }
}

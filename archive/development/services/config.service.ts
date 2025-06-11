/**
 * 配置服務
 * 負責讀取和解析使用者配置檔案
 */

import * as fs from 'fs';
import { LogService } from './log.service';
import { UserConfig, LoginInfo, AttendanceRecord, AttendanceType, ValidationResult } from '../types';
import { SYSTEM_CONFIG } from '../config/constants';

export class ConfigService {
  private logService: LogService;

  constructor(logService: LogService) {
    this.logService = logService;
  }

  /**
   * 讀取並解析使用者配置檔案
   */
  async loadUserConfig(): Promise<UserConfig> {
    try {
      this.logService.info('正在讀取使用者配置檔案...');
      
      if (!fs.existsSync(SYSTEM_CONFIG.PATHS.USER_CONFIG)) {
        throw new Error(`配置檔案不存在: ${SYSTEM_CONFIG.PATHS.USER_CONFIG}`);
      }

      const fileContent = fs.readFileSync(SYSTEM_CONFIG.PATHS.USER_CONFIG, 'utf-8');
      const userConfig = this.parseUserConfig(fileContent);
      
      // 驗證配置
      const validation = this.validateUserConfig(userConfig);
      if (!validation.isValid) {
        throw new Error(`配置檔案驗證失敗: ${validation.errors.join(', ')}`);
      }

      this.logService.info('使用者配置載入成功', {
        loginInfo: { username: userConfig.loginInfo.username, companyCode: userConfig.loginInfo.companyCode },
        recordsCount: userConfig.attendanceRecords.length
      });

      return userConfig;
    } catch (error) {
      this.logService.error('載入使用者配置失敗', error as Error);
      throw error;
    }
  }

  /**
   * 解析配置檔案內容
   */
  private parseUserConfig(content: string): UserConfig {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let loginInfo: LoginInfo | null = null;
    const attendanceRecords: AttendanceRecord[] = [];
    let currentSection = '';

    for (const line of lines) {
      // 判斷區段
      if (line.includes('登入資訊：')) {
        currentSection = 'login';
        continue;
      } else if (line.includes('補卡日期：')) {
        currentSection = 'attendance';
        continue;
      }

      if (currentSection === 'login') {
        // 解析登入資訊
        if (line.includes('公司代碼：')) {
          const companyCode = line.split('：')[1]?.trim();
          if (!loginInfo) loginInfo = { companyCode: '', username: '', password: '' };
          loginInfo.companyCode = companyCode || '';
        } else if (line.includes('登入帳號：')) {
          const username = line.split('：')[1]?.trim();
          if (!loginInfo) loginInfo = { companyCode: '', username: '', password: '' };
          loginInfo.username = username || '';
        } else if (line.includes('密碼：')) {
          const password = line.split('：')[1]?.trim();
          if (!loginInfo) loginInfo = { companyCode: '', username: '', password: '' };
          loginInfo.password = password || '';
        }
      } else if (currentSection === 'attendance') {
        // 解析補卡記錄
        const record = this.parseAttendanceRecord(line);
        if (record) {
          attendanceRecords.push(record);
        }
      }
    }

    if (!loginInfo) {
      throw new Error('未找到登入資訊');
    }

    return {
      loginInfo,
      attendanceRecords
    };
  }

  /**
   * 解析補卡記錄
   */
  private parseAttendanceRecord(line: string): AttendanceRecord | null {
    // 正則表達式匹配日期和類型
    // 格式: yyyy/mm/dd\t上班未打卡 或 yyyy/mm/dd\t上班未打卡 / 下班未打卡 等
    const dateMatch = line.match(/(\d{4}\/\d{2}\/\d{2})/);
    if (!dateMatch) {
      return null;
    }

    const date = dateMatch[1];
    const typeText = line.replace(date, '').trim().replace(/^\t+/, '');

    let type: AttendanceType;
    if (typeText.includes('上班未打卡') && typeText.includes('下班未打卡')) {
      type = AttendanceType.BOTH;
    } else if (typeText.includes('上班未打卡')) {
      type = AttendanceType.CLOCK_IN;
    } else if (typeText.includes('下班未打卡')) {
      type = AttendanceType.CLOCK_OUT;
    } else {
      this.logService.warn(`無法解析補卡類型: ${typeText}`);
      return null;
    }

    return {
      date,
      type,
      rawText: line
    };
  }

  /**
   * 驗證使用者配置
   */
  private validateUserConfig(userConfig: UserConfig): ValidationResult {
    const errors: string[] = [];

    // 驗證登入資訊
    if (!userConfig.loginInfo.companyCode) {
      errors.push('公司代碼不能為空');
    }
    if (!userConfig.loginInfo.username) {
      errors.push('登入帳號不能為空');
    }
    if (!userConfig.loginInfo.password) {
      errors.push('密碼不能為空');
    }

    // 驗證補卡記錄
    if (userConfig.attendanceRecords.length === 0) {
      errors.push('至少需要一筆補卡記錄');
    }

    // 驗證每筆記錄的日期格式
    for (const record of userConfig.attendanceRecords) {
      if (!this.isValidDateFormat(record.date)) {
        errors.push(`無效的日期格式: ${record.date}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證日期格式 (yyyy/mm/dd)
   */
  private isValidDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!dateRegex.test(date)) {
      return false;
    }

    // 進一步驗證日期是否有效
    const [year, month, day] = date.split('/').map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    return dateObj.getFullYear() === year &&
           dateObj.getMonth() === month - 1 &&
           dateObj.getDate() === day;
  }

  /**
   * 建立範例配置檔案
   */
  async createSampleUserConfig(): Promise<void> {
    const sampleContent = `登入資訊：
    公司代碼：TNLMG
    登入帳號：TNL011
    密碼：R9498LUoCoCcgF

補卡日期：
    2025/06/04	上班未打卡		
    2025/06/03	上班未打卡 / 下班未打卡	
    2025/06/02	下班未打卡`;

    try {
      // 確保目錄存在
      const dataDir = SYSTEM_CONFIG.PATHS.USER_CONFIG.substring(0, SYSTEM_CONFIG.PATHS.USER_CONFIG.lastIndexOf('/'));
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(SYSTEM_CONFIG.PATHS.USER_CONFIG, sampleContent, 'utf-8');
      this.logService.info(`範例配置檔案已建立: ${SYSTEM_CONFIG.PATHS.USER_CONFIG}`);
    } catch (error) {
      this.logService.error('建立範例配置檔案失敗', error as Error);
      throw error;
    }
  }
}

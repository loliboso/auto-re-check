/**
 * 系統常數配置
 * 按照 TECHNICAL_SPEC.md 規格實作
 */

export const SYSTEM_CONFIG = {
  // URL 配置
  URLS: {
    BASE_URL: 'https://apollo.mayohr.com',
    LOGIN_URL: 'https://apollo.mayohr.com',
    MAIN_URL: 'https://apollo.mayohr.com',
    FORM_LIST_URL_PREFIX: 'https://flow.mayohr.com/GAIA/BPM/Form/List?muid',
    APPLY_FORM_URL: 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b'
  },
  
  // 等待時間配置 (毫秒)
  TIMEOUTS: {
    PAGE_LOAD: 30000,           // 頁面載入等待時間
    LOGIN: 15000,               // 登入等待時間
    ELEMENT_WAIT: 10000,        // 元素出現等待時間
    DIALOG_WAIT: 5000,          // 對話框等待時間
    FORM_SUBMIT: 10000,         // 表單提交等待時間
    DEFAULT_WAIT: 3000,         // 預設等待時間
    FORM_LOAD_WAIT: 5000,       // 表單載入等待時間
    NAVIGATION_WAIT: 15000      // 頁面導航等待時間
  },
  
  // 延遲配置 (毫秒)
  DELAYS: {
    INPUT_DELAY: 100,           // 輸入延遲
    CLICK_DELAY: 500,           // 點擊延遲
    NAVIGATION_DELAY: 1000,     // 導航延遲
    BETWEEN_RECORDS: 2000       // 記錄間延遲
  },
  
  // 重試配置
  RETRY: {
    MAX_ATTEMPTS: 2,            // 最大重試次數
    DELAY: 1000                 // 重試間隔
  },
  
  // 行為配置
  BEHAVIOR: {
    STRICT_ERROR_HANDLING: true // 嚴格錯誤處理（失敗即終止）
  },
  
  // 表單配置
  FORM: {
    COMPANY_CODE: 'TNLMG',
    LOCATION: 'TNLMG',
    ATTENDANCE_TYPE: {
      CLOCK_IN: '1',            // 上班
      CLOCK_OUT: '2'            // 下班
    }
  },
  
  // 檔案路徑
  PATHS: {
    USER_CONFIG: './data/user-info.txt',
    LOGS_DIR: './logs/',
    SCREENSHOTS_DIR: './screenshots/'
  },
  
  // 時間格式
  TIME_FORMATS: {
    DATETIME_FORMAT: 'YYYY/MM/DD HH:mm:ss',
    FILENAME_DATETIME_FORMAT: 'YYYYMMDD_HHmmss',
    DATE_FORMAT: 'YYYY/MM/DD'
  },
  
  // 日誌級別
  LOG_LEVELS: {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  }
} as const;

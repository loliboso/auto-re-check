# 自動補卡程式技術規格書

## 專案概述
基於 SOLID 原則，使用 TypeScript 建構適合 AI agent 執行的自動補卡程式。
⚠️ 請一律用台灣中文回應我
⚠️ 請優先與我討論方案以及解法，不要自行實作，除非我同意。

## 技術架構

### 技術選型
- **程式語言**: TypeScript
- **自動化框架**: Puppeteer (支援 headless 模式)
- **執行環境**: Node.js (Mac 環境)
- **架構原則**: SOLID 原則

### 專案結構
```
auto-re-check/
├── src/
│   ├── types/              # TypeScript 型別定義
│   │   ├── index.ts        # 主要型別匯出
│   │   ├── user-config.ts  # 使用者配置型別
│   │   ├── attendance.ts   # 補卡相關型別
│   │   └── system.ts       # 系統狀態型別
│   ├── config/             # 可調整的常數設定 (需求1)
│   │   ├── constants.ts    # 系統常數
│   │   └── selectors.ts    # DOM 選擇器
│   ├── services/           # 核心服務模組
│   │   ├── config.service.ts      # 個人資訊檔案管理
│   │   ├── login.service.ts       # 登入服務
│   │   ├── form.service.ts        # 表單處理服務
│   │   ├── date.service.ts        # 日期解析服務
│   │   ├── loop.service.ts        # 循環處理服務 (需求3)
│   │   ├── action.service.ts      # 後續動作處理 (需求4)
│   │   └── main.service.ts        # 主要執行服務 (需求2)
│   ├── validators/         # 驗證函數 (需求5)
│   │   ├── form.validator.ts
│   │   ├── login.validator.ts
│   │   └── config.validator.ts
│   ├── utils/              # 工具函數
│   │   ├── logger.ts       # 日誌工具
│   │   ├── screenshot.ts   # 截圖工具
│   │   └── retry.ts        # 重試機制
│   └── main.ts             # 程式入口點
├── data/
│   └── user-info.txt       # 個人資訊檔案
├── logs/                   # 執行日誌 (./logs/)
├── screenshots/            # 失敗截圖 (./screenshots/)
├── package.json
├── tsconfig.json
└── PRD.md
```

## 核心型別定義

### 使用者配置型別
```typescript
// src/types/user-config.ts
export interface LoginInfo {
  companyCode: string;      // 公司代碼
  username: string;         // 登入帳號
  password: string;         // 密碼
}

export interface AttendanceRecord {
  date: string;            // yyyy/mm/dd 格式
  type: AttendanceType;    // 補卡類型
  rawText: string;         // 原始文字
}

export enum AttendanceType {
  CLOCK_IN = 'CLOCK_IN',                    // 上班未打卡
  CLOCK_OUT = 'CLOCK_OUT',                  // 下班未打卡
  BOTH = 'BOTH'                             // 上班未打卡 / 下班未打卡
}

export interface UserConfig {
  loginInfo: LoginInfo;
  attendanceRecords: AttendanceRecord[];
}
```

### 系統狀態型別
```typescript
// src/types/system.ts
export interface ExecutionState {
  currentRecord: AttendanceRecord | null;
  currentSubTask: 'CLOCK_IN' | 'CLOCK_OUT' | null;
  completedRecords: AttendanceRecord[];
  failedAt: string | null;
}

export interface FormState {
  isFormLoaded: boolean;
  isMainIframeReady: boolean;
  isBannerIframeReady: boolean;
  hasExistingRecordAlert: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  currentRetry: number;
}
```

## 常數配置 (需求1: 可調整的input應該做成const)

### 系統常數
```typescript
// src/config/constants.ts
export const SYSTEM_CONFIG = {
  // URL 配置
  BASE_URL: 'https://apollo.mayohr.com',
  FORM_LIST_URL_PREFIX: 'https://flow.mayohr.com/GAIA/BPM/Form/List?muid',
  APPLY_FORM_URL: 'https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b',
  
  // 等待時間配置 (毫秒)
  TIMEOUTS: {
    FORM_LOAD_WAIT: 5000,           // 表單載入等待時間
    DEFAULT_WAIT: 3000,             // 預設等待時間
    ELEMENT_WAIT: 10000,            // 元素出現等待時間
    NAVIGATION_WAIT: 15000          // 頁面導航等待時間
  },
  
  // 重試配置
  RETRY: {
    MAX_ATTEMPTS: 2,                // 最大重試次數
    DELAY: 1000                     // 重試間隔
  },
  
  // 表單配置
  FORM: {
    COMPANY_CODE: 'TNLMG',
    LOCATION: 'TNLMG',
    ATTENDANCE_TYPE: {
      CLOCK_IN: '1',               // 上班
      CLOCK_OUT: '2'               // 下班
    }
  },
  
  // 檔案路徑
  PATHS: {
    USER_CONFIG: './data/user-info.txt',
    LOGS_DIR: './logs/',
    SCREENSHOTS_DIR: './screenshots/'
  }
} as const;
```

### DOM 選擇器
```typescript
// src/config/selectors.ts
export const SELECTORS = {
  // 登入頁面
  LOGIN: {
    POPUP_CONFIRM: 'button:contains("確定")',
    COMPANY_CODE: '#companyCode',
    USERNAME: '#username',
    PASSWORD: '#password',
    LOGIN_BUTTON: '#loginButton'
  },
  
  // 主頁面
  MAIN_PAGE: {
    FORM_APPLICATION_LINK: 'a.link-item__link[href*="bpm/applyform"]'
  },
  
  // 表單申請頁面
  FORM_LIST: {
    FORGET_CARD_LINK: 'a[data-formkind="TNLMG9.FORM.1001"]'
  },
  
  // 表單頁面 (iframe 內)
  FORM: {
    MAIN_IFRAME: '#main',
    BANNER_IFRAME: '#banner',
    ATTENDANCE_TYPE_SELECT: '#fm_attendancetype',
    DATETIME_INPUT: '#fm_datetime',
    DATETIME_CALENDAR_BUTTON: '.k-link-date .k-icon-calendar',
    LOCATION_SELECT: '#fm_location',
    SUBMIT_BUTTON: '#SUBMIT',
    EXISTING_RECORD_ALERT: '.alert, .k-dialog'
  },
  
  // 日期選擇器 (Kendo UI)
  DATE_PICKER: {
    CALENDAR_CONTAINER: '.k-calendar',
    MONTH_YEAR_HEADER: '.k-header .k-link',
    PREV_MONTH: '.k-nav-prev',
    NEXT_MONTH: '.k-nav-next',
    DAY_CELL: '.k-calendar td[role="gridcell"]'
  }
} as const;
```

## 核心服務模組

### 1. 配置服務 (ConfigService)
```typescript
// src/services/config.service.ts
export class ConfigService {
  /**
   * 讀取並解析 user-info.txt 檔案
   * 支援原始格式：
   * - 2025/06/04 上班未打卡
   * - 2025/06/03 上班未打卡 / 下班未打卡  
   * - 2025/06/02 下班未打卡
   */
  async loadUserConfig(): Promise<UserConfig>
  
  /**
   * 解析補卡日期文字
   */
  private parseAttendanceRecord(line: string): AttendanceRecord
  
  /**
   * 驗證配置檔案格式
   */
  private validateConfig(config: UserConfig): boolean
}
```

### 2. 主要執行服務 (需求2: 主要fn)
```typescript
// src/services/main.service.ts
export class MainService {
  /**
   * 程式主要執行入口
   * 控制整個補卡流程的執行順序
   */
  async execute(): Promise<void>
  
  /**
   * 初始化瀏覽器和頁面
   */
  private async initializeBrowser(): Promise<void>
  
  /**
   * 執行登入流程
   */
  private async performLogin(): Promise<void>
  
  /**
   * 執行補卡循環
   */
  private async executeAttendanceLoop(): Promise<void>
  
  /**
   * 清理資源
   */
  private async cleanup(): Promise<void>
}
```

### 3. 循環處理服務 (需求3: 根據input跑回圈的fn)
```typescript
// src/services/loop.service.ts
export class LoopService {
  /**
   * 處理所有補卡記錄的主循環
   */
  async processAllRecords(records: AttendanceRecord[]): Promise<void>
  
  /**
   * 處理單一補卡記錄
   * 支援 BOTH 類型的兩次補卡
   */
  async processSingleRecord(record: AttendanceRecord): Promise<void>
  
  /**
   * 處理單次補卡動作 (上班或下班)
   */
  private async processSingleAttendance(
    date: string, 
    type: 'CLOCK_IN' | 'CLOCK_OUT'
  ): Promise<void>
}
```

### 4. 後續動作服務 (需求4: 接受回傳執行後續動作的fn)
```typescript
// src/services/action.service.ts
export class ActionService {
  /**
   * 處理送簽後的各種回應情況
   */
  async handleSubmissionResponse(): Promise<'SUCCESS' | 'EXISTING_RECORD' | 'ERROR'>
  
  /**
   * 處理已有打卡記錄的情況
   * 關閉提示後切換補卡類型
   */
  async handleExistingRecordAlert(): Promise<void>
  
  /**
   * 處理成功送簽的情況
   * 確認表單關閉並返回申請頁面
   */
  async handleSuccessfulSubmission(): Promise<void>
  
  /**
   * 處理錯誤情況
   * 截圖並終止程式
   */
  async handleError(error: Error): Promise<never>
}
```

### 5. 驗證服務 (需求5: 驗證fn)
```typescript
// src/validators/form.validator.ts
export class FormValidator {
  /**
   * 驗證表單是否正確載入
   */
  async validateFormLoaded(): Promise<boolean>
  
  /**
   * 驗證表單欄位是否正確填寫
   */
  async validateFormFields(
    attendanceType: string,
    date: string,
    location: string
  ): Promise<boolean>
  
  /**
   * 驗證送簽按鈕是否可點擊
   */
  async validateSubmitButton(): Promise<boolean>
  
  /**
   * 驗證頁面導航是否成功
   */
  async validateNavigation(expectedUrl: string): Promise<boolean>
}
```

## 關鍵技術實作策略

### 1. iframe 處理
```typescript
// 處理 main iframe (表單欄位)
const mainFrame = await page.frame('main');
await mainFrame.waitForSelector('#fm_attendancetype');

// 處理 banner iframe (送簽按鈕)
const bannerFrame = await page.frame('banner');
await bannerFrame.click('#SUBMIT');
```

### 2. Kendo UI 日期選擇器處理
```typescript
// 模擬點擊日期選擇器
await page.click('.k-link-date .k-icon-calendar');
await page.waitForSelector('.k-calendar');

// 導航到正確的月份和年份
await navigateToTargetMonth(targetDate);

// 選擇特定日期
await page.click(`td[data-value="${targetDateValue}"]`);
```

### 3. formno 動態偵測
```typescript
// 透過 URL 前綴偵測表單頁面
const isFormPage = page.url().startsWith(SYSTEM_CONFIG.FORM_LIST_URL_PREFIX);

// 動態獲取當前表單的 formno
const currentFormNo = new URL(page.url()).searchParams.get('formno');
```

### 4. 重複打卡記錄處理邏輯
```typescript
/**
 * 處理同一天的上班下班補卡邏輯：
 * 1. 嘗試上班補卡
 * 2. 如果出現「當日已有上班打卡記錄」→ 切換到下班補卡
 * 3. 如果出現「當日已有下班打卡記錄」→ 該日期已完成
 * 4. 如果都沒有提示 → 補卡成功，繼續下一步驟
 */
async handleSameDayAttendance(date: string, type: AttendanceType): Promise<void> {
  if (type === AttendanceType.BOTH) {
    // 先處理上班
    const clockInResult = await this.processSingleAttendance(date, 'CLOCK_IN');
    if (clockInResult === 'SUCCESS') {
      // 上班成功，繼續處理下班
      await this.processSingleAttendance(date, 'CLOCK_OUT');
    }
  } else {
    // 單一補卡類型
    await this.processSingleAttendance(date, type === AttendanceType.CLOCK_IN ? 'CLOCK_IN' : 'CLOCK_OUT');
  }
}
```

### 5. 錯誤處理和重試機制
```typescript
// 帶重試的操作包裝器
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 2
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        // 最後一次嘗試失敗，截圖並拋出錯誤
        await takeScreenshot(`error_attempt_${attempt}`);
        throw error;
      }
      // 等待後重試
      await delay(SYSTEM_CONFIG.RETRY.DELAY);
    }
  }
}
```

## 執行流程

### 主要執行流程
1. **初始化** → 載入配置、啟動瀏覽器
2. **登入** → 處理登入頁面和可能的彈窗
3. **導航** → 進入表單申請頁面
4. **循環補卡** → 處理每個補卡記錄
5. **清理** → 關閉瀏覽器、儲存日誌

### 單一補卡記錄流程
1. **開啟表單** → 點擊忘打卡申請單
2. **等待載入** → 5秒等待 + iframe 準備就緒
3. **填寫表單** → 類型、日期、地點
4. **送簽** → 點擊送簽按鈕
5. **處理回應** → 成功/已有記錄/錯誤
6. **驗證結果** → 確認操作完成

## 錯誤處理策略

### 嚴格的失敗終止原則
- 任何步驟失敗都立即終止程式
- 失敗時自動截圖並記錄詳細錯誤資訊
- 最多重試 2 次，失敗後直接終止

### 日誌記錄
- 每個關鍵步驟都記錄時間戳記
- 記錄當前處理的日期和補卡類型
- 失敗時記錄完整的錯誤堆疊

## 檔案和目錄說明

### 執行過程產生的檔案
- `logs/execution_YYYYMMDD_HHMMSS.log` - 執行日誌
- `screenshots/error_YYYYMMDD_HHMMSS.png` - 錯誤截圖
- `screenshots/step_*.png` - 關鍵步驟截圖（除錯模式）

### 使用者需要維護的檔案
- `data/user-info.txt` - 個人資訊檔案，使用者直接編輯

## 技術依賴

### 主要依賴套件
```json
{
  "dependencies": {
    "puppeteer": "^21.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

這個技術規格書涵蓋了您需求中的所有要點，並且特別針對 AI agent 執行進行了優化設計。每個模組都有明確的職責劃分，符合 SOLID 原則，同時提供了詳細的型別定義和實作策略。

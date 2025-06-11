/**
 * DOM 選擇器配置
 * 根據 Apollo HR 系統的實際 DOM 結構定義
 */
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

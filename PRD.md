# 自動化程式規格書：

⚠️ 以 solid 原則建構
⚠️ 以適合 AI agent 執行為原則，規劃架構
⚠️ 以適合 AI agent 執行為原則，建議需要哪些元件跟服務會是最穩定最有彈性的
⚠️ 以 typescipt 先把型別都確定下來
⚠️ 依照以下需求產出適合 ai agent 執行的程式規格書

⚠️ 專案會需要幾個部分
1. 可以調整的input 應該做成const
2. 主要fn
3. 根據input 跑回圈的fn
4. 接受回傳執行後續動作的fn
5. 驗證fn

⚠️ !!!請一律用台灣中文回應我!!!
⚠️ !!!請一律用台灣中文回應我!!!
⚠️ !!!請一律用台灣中文回應我!!!

⚠️ 請優先與我討論方案以及解法，不要自行實作，除非我同意。
⚠️ 請優先與我討論方案以及解法，不要自行實作，除非我同意。
⚠️ 請優先與我討論方案以及解法，不要自行實作，除非我同意。

⚠️ 每次測試回報錯誤的時候，請不要直接修改，而是先與我討論，詢問我觀察到的實際執行情形，確認問題後再進行修改。
⚠️ 每次測試回報錯誤的時候，請不要直接修改，而是先與我討論，詢問我觀察到的實際執行情形，確認問題後再進行修改。
⚠️ 每次測試回報錯誤的時候，請不要直接修改，而是先與我討論，詢問我觀察到的實際執行情形，確認問題後再進行修改。

⚠️ 如果過程需要截圖、小型測試、log等，請以子資料夾的方式儲存，並在程式碼中註明路徑，保持專案資料夾整潔、結構清晰。

# 需求：
我想要在 Mac 電腦的環境做一個自動補卡的程式，需求有：

0.讓使用者可以自行維護的「個人資訊檔案」，包含登入資訊、補卡日期等 

1.登入功能：
- 以「個人資訊檔案」中的「登入資訊」進入 https://apollo.mayohr.com 的網頁服務
- 登入前若遇到 pop-out 提示需要重新登入，要先點選「確定」來關閉，才會進到登入畫面
- 請注意登入有三個欄位，不是一般帳號密碼的兩個欄位：
    - 公司代碼
    - 登入帳號
    - 密碼
- 若本來就已經登入，則會直接跳轉到 https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b，這時候可以直接進行後續操作
- 登入後等待網頁讀取完成
- 確認登入後，點擊「表單申請」按鈕，這時候不會開啟新分頁，而是登入後的頁面直接變成 https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b 

2.補卡日期確認：
- 以「個人資訊檔案」中的「補卡日期」確認需要補卡功能需要處理的日期
- 日期的格式分為三種，這將由使用者直接從系統裡面複製並貼上，所以格式是固定的，如果需要額外格式，請程式讀取以後自行解析：
    - yyyy/mm/dd 上班未打卡
    - yyyy/mm/dd 上班未打卡 / 下班未打卡
    - yyyy/mm/dd 下班未打卡

3.補卡功能：
- 選擇「忘打卡申請單」，會開啟新分頁 https://flow.mayohr.com/GAIA/BPM/Form/List?muid=b154c3d6-7337-4af6-aff2-49cf849cde9b&formkind=TNLMG9.FORM.1001&formno=26733&callphaseid=apply&viewphaseid=apply，請注意這裡的 26733 可能會隨著時間而改變
- 來到這個新分頁，等待5秒讓網頁加載
- 表單包含：申請人、申請單位、類型、日期/時間、地點、事由，請注意這些欄位位於  <iframe id="main"> 的內部
- 只處理「類型」、「日期/時間」、「地點」三個欄位即可，其他欄位不需要處理
- 填寫的順序為
    1. 「類型」
    2. 「日期/時間」
    3. 「地點」
- 在「類型」選擇上班或下班，對應「補卡日期」中的上班未打卡或下班未打卡
    - 若「補卡日期」為 yyyy/mm/dd 上班未打卡，則選擇「類型」為上班
    - 若「補卡日期」為 yyyy/mm/dd 上班未打卡 / 下班未打卡，則先選擇「類型」為上班，完成送簽以後再重複一次選擇同一天的「類型」為下班
    - 若「補卡日期」為 yyyy/mm/dd 下班未打卡，則選擇「類型」為下班
- 在「日期/時間」選擇對應的日期，此日期選擇器應該是 Kendo UI，限制是只能使用滑鼠點選才能叫出月曆選擇器，不能以文字填入，需要模擬點選行為或其他方式來選擇日期
- 「日期/時間」雖然包含時間，但只需要選擇日期即可，時間可以忽略，因為補卡的時間是由系統自動處理的
- 在「地點」選擇 TNLMG
- 最後按下畫面最上方的「送簽」，這個按鈕會觸發送簽動作，請注意此按鈕跟表單欄位是位於 <iframe id="banner"> 的內部
- 送簽如果順利完成，此表單分頁會關閉，回到「表單申請」按鈕的 https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b
- 此為一個補卡的循環

4.重複送簽的情形：
- 送簽以後，網頁可能會跳出瀏覽器提示（並非網頁自己的 pop-out）「當日已有 上班 打卡紀錄」或「當日已有 下班 打卡紀錄」的提示訊息，這時候需要點選「確定」來關閉提示訊息
- 關閉以後，畫面會回到剛剛已經填寫過的表單
- 重新選擇類型、日期/時間、地點，但這次處理的是下一個 補卡日期
- 選擇完畢後，按下「送簽」按鈕
- 送簽如果順利完成，此表單分頁會關閉，回到「表單申請」按鈕的 https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b

5.循環補卡功能：
- 送簽如果順利完成，此表單分頁會關閉，回到「表單申請」按鈕的 https://flow.mayohr.com/GAIA/bpm/applyform?moduleType=apply&companyCode=TNLMG&muid=b154c3d6-7337-4af6-aff2-49cf849cde9b
- 回到此頁後，重複執行 3. 補卡功能，直到所有需要的 補卡日期 全數處理完畢
- 當所有需要的 補卡日期 全數處理完畢後，程式結束
- 不管有幾天補卡日期，只要程式偵測到補卡表單無法填寫無法送簽的錯誤，一律直接終止程式，不容許任何失敗的跳過

# 個人資訊檔案範例：
    登入資訊：
        公司代碼：TNLMG
        登入帳號：TNL011
        密碼：R9498LUoCoCcgF

    補卡日期：
        2025/06/04	上班未打卡		
        2025/06/03	上班未打卡 / 下班未打卡	
        2025/06/02	下班未打卡

# 選擇器的原始碼：

- 公司代碼欄位: input[name="companyCode"] - placeholder: "公司代碼"
    - 工號欄位: input[name="employeeNo"] - placeholder: "工號"
    - 密碼欄位: input[name="password"] - placeholder: "請輸入您的密碼"
    - 登入按鈕: button[type="submit"] - class: "btn btn-default submit-btn marginT-20"

- 表單申請：<a class="link-item__link" href="https://apollo.mayohr.com/backend/pt/api/bpm/sso-redirect?targetPath=bpm%2Fapplyform%3FmoduleType%3Dapply&amp;lang=zh-tw"><div class="link-item__icon"><img src="data:image/png;base64,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" width="80px" height="80px"></div><h6 class="link-item__title">表單申請</h6></a>

- 忘打卡申請單：<a href="javascript:void(0);" onmouseover="bg.bpm.applyFormList.over(this);return false;" onmouseout="bg.bpm.applyFormList.out(this);return false;" data-isgaiabpm="true" data-sitecode="LOCAL" data-sitepath="" data-formkind="TNLMG9.FORM.1001" data-para="oen0IxhHWRD55F+5f2490b+Xfv+uIY2nZR94Ynt9GQk=" data-toggle="tooltip" title="" style="color: black;"><img style="padding:0px 0px 5px 0px;" src="/GAIA/Content/images/bpm/formheader.gif">忘打卡申請單<span style="margin-left:4px; padding: 0 1px;" class="label label-info"></span></a>

- 類型：<td colspan="3" class="element-input elementTdClassCommon" id="attendancetype_input">             
                        <span title="" class="k-widget k-dropdown k-header bg-fm-row_static" unselectable="on" role="listbox" aria-haspopup="true" aria-expanded="false" aria-owns="fm_attendancetype_listbox" aria-disabled="false" aria-busy="false" style="" aria-activedescendant="73eed704-aa0e-4df9-a0ef-6c44f64c1347" tabindex="0"><span unselectable="on" class="k-dropdown-wrap k-state-default"><span unselectable="on" class="k-input">請選擇</span><span unselectable="on" class="k-select" aria-label="select"><span class="k-icon k-i-arrow-s"></span></span></span><select id="fm_attendancetype" name="attendancetype" class="bg-fm-row_static" data-area="main" data-bg-val="{ required:true, messages:{ required:'類型不能為空' } } " style="display: none;" data-role="dropdownlist"><option value="" selected="selected">請選擇</option><option value="1">上班</option><option value="2">下班</option><option value="6">休息結束</option><option value="5">休息開始</option></select></span>
                    </td>
- 日期/時間：<td colspan="3" class="element-input elementTdClassCommon" id="datetime_input">
                <span class="k-widget k-datetimepicker k-header bg-fm-row_static_date k-input" style="width: 100%;"><span class="k-picker-wrap k-state-default"><input id="fm_datetime" name="datetime" type="text" class="bg-fm-row_static_date k-input" maxlength="19" data-area="main" data-isdatetime="true" data-bg-val="{ required:true, date:true, messages:{ required:'日期/時間不能為空',date:'日期格式不正確' } 
                }" style="width: 100%;" data-role="datetimepicker" role="combobox" aria-expanded="false" aria-disabled="false" readonly="readonly" aria-activedescendant="49787e87-5b6f-4870-bff3-88e5f79809b0_cell_selected"><span unselectable="on" class="k-select"><span class="k-link k-link-date" aria-label="Open the date view"><span unselectable="on" class="k-icon k-i-calendar" aria-controls="fm_datetime_dateview"></span></span><span class="k-link k-link-time" aria-label="Open the time view"><span unselectable="on" class="k-icon k-i-clock" aria-controls="fm_datetime_timeview"></span></span></span></span></span>
            </td>
- 地點：<td colspan="3" class="element-input elementTdClassCommon" id="location_input">
            <span title="" class="k-widget k-dropdown k-header bg-fm-row_static" unselectable="on" role="listbox" aria-haspopup="true" aria-expanded="false" aria-owns="fm_location_listbox" aria-disabled="false" aria-busy="false" style="" aria-activedescendant="9ddac459-9423-4620-a618-8bf10f4a9717" tabindex="0"><span unselectable="on" class="k-dropdown-wrap k-state-default"><span unselectable="on" class="k-input">請選擇</span><span unselectable="on" class="k-select" aria-label="select"><span class="k-icon k-i-arrow-s"></span></span></span><select id="fm_location" name="location" class="bg-fm-row_static" data-area="main" data-bg-val="{ required:true, messages:{ required:'地點不能為空' } } " style="display: none;" data-role="dropdownlist"><option value="" selected="selected">請選擇</option><option value="518ee0c2-a787-40a6-bb94-5a081250e896">TNLMG</option><option value="00000000-0000-0000-0000-000000000000">其他</option><option value="802d7fed-ca0b-4e13-8856-62684f81c584">士奇</option></select></span>
        </td>
- 送簽：<div class="buttonDiv" data-bind="attr: { id: buttonName }" id="SUBMIT" style="cursor: pointer;">
                        <div data-bind="attr: { 'class': backgrandImage }" style="margin: 0px 13px; width: 32px; height: 32px;" class="Button_Submit">
                        </div>
                        <div style="line-height: 15px;" data-bind="text: text">送簽</div>
                    </div>


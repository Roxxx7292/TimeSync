# TimeSync × Test1102

網站預設連接 Test1102，公開設定在 `supabase-config.js`。
訪客不需要註冊、登入或輸入 API key。

1. 開啟「建立行事曆」，填寫會議資料。
2. 按「儲存會議」直接新增到 `public.timesync_meetings`。
3. 當次成功儲存的會議會顯示於「本次已儲存的會議」，可按「套用」載回表單。
4. 「下載行事曆檔案 (.ics)」可匯出檔案；此按鈕不會自動寫入資料庫。

訪客僅可新增指定表單欄位，不能透過公開 API 讀取、修改或刪除資料。
清單僅存在目前頁面的記憶體，重新整理即清空；後台資料不會因此刪除。
完整紀錄請在 Supabase Dashboard 的 Table Editor 查看 `timesync_meetings`。

`user_id` 允許為空以支援訪客送出，舊有帳號資料與其讀取隔離規則保留。
`supabase-anonymous-submissions.sql` 是本次已套用的遷移紀錄。
`supabase-schema.sql` 是新專案的首次建表參考，請勿在現有專案重複執行同名 policy。

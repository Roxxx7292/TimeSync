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

## 常用城市、工作時間與團隊

- 「城市與排序」可調整常用城市順序，也可新增或移除。
- 「工作時間」可設定工作日與上下班時間，支援跨夜班。各城市以當地日期判斷工作日。
- 「團隊與成員」可建立／重新命名／刪除團隊，並新增／編輯／移除及排序成員，為每位成員設定時區與工作日。套用團隊後，時間軸會按成員顯示，即使兩人同城市也會分別計算。
- 推薦時間會檢查整段會議時長，而非只檢查開始時間。
- 未登入時，以上資料保存在瀏覽器 localStorage，依網域／瀏覽器隔離；清除網站資料後會失去本機設定。
- Google 登入為選用，正式啟用步驟見 `GOOGLE-LOGIN.md`。
- 登入後設定存在 `timesync_preferences`、`timesync_teams`、`timesync_team_members`。三張表都啟用 RLS，僅擁有者可存取。名單不是跨帳號共享群組。
- `save_timesync_workspace` 以使用者權限、單一交易儲存，並檢查 revision，防止跨裝置變更被舊版本覆蓋。
- `supabase-workspaces.sql` 已套用到 Test1102；請勿重複執行。
- SDK 固定為 `@supabase/supabase-js@2.118.0`，隨附於 `vendor/`，附原始 MIT 授權。

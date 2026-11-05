# 啟用 Google 帳號登入

網站已加入 Supabase Google OAuth（PKCE）與帳號資料同步。Test1102 目前尚未啟用 Google provider，所以目前可使用本機的城市、工作日與團隊功能，但 Google 登入需完成下列設定後才能測試。

## 1. 建立 Google OAuth 用戶端

1. 開啟 https://console.cloud.google.com/ ，選擇或建立你的應用程式專案。
2. 進入 Google Auth Platform，設定 Branding（應用程式名稱、支援信箱）、Audience，以及 Data Access。
3. 只需基本登入範圍 `openid`、`email`、`profile`。不需要 Gmail 或 Google Calendar 權限。
4. 在 Clients 建立 OAuth client，應用程式類型選「Web application」。
5. Authorized JavaScript origins 填入實際網站的 origin，例如正式網站的 `https://你的網域`。本機測試可另加 `http://127.0.0.1:8765` 或 `http://localhost:8765`；請與瀏覽器開啟的網址一致。
6. Authorized redirect URIs 加入以下精確網址：

   `https://ksvyaxiibmgbagxzevke.supabase.co/auth/v1/callback`

7. 保存 Client ID 與 Client Secret。如果 Audience 還在 Testing 模式，將要登入的 Google 帳號加入 Test users。

## 2. 在 Test1102 啟用 Google

1. 開啟 https://supabase.com/dashboard/project/ksvyaxiibmgbagxzevke/auth/providers ，找到 Google provider。
2. 啟用 Google，填入上一節的 Client ID、Client Secret，然後儲存。
3. Client Secret 只填入 Supabase 的 provider 設定，不要放在前端程式或聊天中。

## 3. 設定登入後返回網址

1. 在 Supabase Authentication → URL Configuration：
   https://supabase.com/dashboard/project/ksvyaxiibmgbagxzevke/auth/url-configuration
2. Site URL 填正式網站網址。
3. Redirect URLs 加入網站實際頁面完整網址（包括路徑、結尾斜線），以及使用中的本機測試網址，例如：
   - `http://127.0.0.1:8765/`
   - `http://localhost:8765/`
4. 正式部署到其他網域時，同時更新 Google 的 Authorized JavaScript origins 和 Supabase 的 Redirect URLs。

## 4. 測試

從這個專案資料夾執行 `python3 -m http.server 8765 --bind 127.0.0.1`，用瀏覽器開啟 `http://127.0.0.1:8765/`。不要直接以 `file://` 開啟檔案來測試登入。

按右上角「Google 登入」→「使用 Google 帳號登入」。授權後應回到同一頁，顯示帳號名稱與雲端同步狀態。

- 若該帳號還沒有設定，會將此裝置目前的規劃設定存入帳號。
- 若已有雲端設定，而此裝置也有未同步內容，介面會讓你選擇保留此裝置設定，或載入雲端設定。
- 登入後新增城市、變更工作時間、管理團隊會自動同步。
- 團隊為個人管理的規劃名單；目前不會寄送邀請，也不會讓其他帳號共同編輯。
- 儲存會議仍採用免登入的送出流程，與個人設定同步獨立。

官方文件：https://supabase.com/docs/guides/auth/social-sign-in/auth-google

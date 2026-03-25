# 🏔️ 北海道旅遊拆帳 — Google 雲端版

> 前端：GitHub Pages（免費） · 後端：Google Apps Script（免費） · 資料庫：Google Sheets（免費）

## 🚀 部署步驟（5 分鐘）

### Step 1：建立 Google Sheets 資料庫

1. 開啟 [Google Sheets](https://sheets.google.com) → 建立新的空白試算表
2. 將試算表命名為 `北海道拆帳`
3. 點選上方選單 **擴充功能 → Apps Script**
4. 刪除編輯器中預設的所有程式碼
5. 把 `gas-backend.js` 的**全部內容**複製貼上
6. 按 **Ctrl+S** 儲存
7. 在 Apps Script 編輯器上方的函式選擇器中，選擇 `initSheet` → 按 ▶️ 執行
   - 首次執行會要求授權，全部按「允許」
   - 這會自動建立「花費明細」和「成員」兩個工作表

### Step 2：部署 Google Apps Script 為 Web App

1. 在 Apps Script 編輯器中，點選右上角 **部署 → 新增部署**
2. 類型選擇 **網頁應用程式**
3. 設定如下：
   - 說明：`北海道拆帳 API`
   - 執行身分：`我`
   - 存取權限：**所有人**
4. 點選 **部署**
5. 複製產生的 **Web App URL**（長得像 `https://script.google.com/macros/s/xxxxx/exec`）

### Step 3：設定前端

1. 打開 `app.js`
2. 找到第一行：
   ```js
   const API_URL = "在這裡貼上你的 Google Apps Script Web App URL";
   ```
3. 把 Step 2 複製的 URL 貼進去（替換引號內的中文）

### Step 4：啟用 GitHub Pages

1. 到 GitHub 上這個 repo 的 **Settings → Pages**
2. Source 選擇 `Deploy from a branch`
3. Branch 選 `main`，資料夾選 `/ (root)`
4. 點 **Save**
5. 等 1~2 分鐘後，你的網址就是：
   ```
   https://neolinnnn.github.io/google版本/
   ```

### Step 5：匯入既有資料

在 Google Sheet 的「花費明細」工作表中，直接手動輸入或複製貼上你的花費資料。欄位順序：

| id | 日期 | 項目 | 備註 | 代墊人 | 應付人員 | 金額-台幣 | 金額-日幣 | 類別 | 狀態 |
|----|------|------|------|--------|----------|-----------|-----------|------|------|

---

## 📱 使用方式

- **手機**：直接在瀏覽器開啟 GitHub Pages 網址
- **電腦**：同上
- **加到手機桌面**：在手機瀏覽器中選「加入主畫面」，就像一個 App 一樣！

## ⚠️ 注意事項

- Google Apps Script 有每日配額限制（免費帳戶約 20,000 次/天），一般旅遊拆帳完全足夠
- 如果修改了 `gas-backend.js`，需要到 Apps Script 重新部署一個**新版本**
- 所有資料都存在你的 Google Sheet 裡，隨時可以直接打開 Sheet 查看/編輯

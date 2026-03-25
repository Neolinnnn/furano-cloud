import csv
import json
import requests
import time
import os

API_URL = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec"
CSV_PATH = r"d:\VSCODE\拆帳用\北海道花費(資料庫).csv"

def upload_data():
    print(f"正在讀取本地檔案: {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print("❌ 找不到 CSV 檔案！")
        return

    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"📦 找到 {len(rows)} 筆花費紀錄，準備上傳至雲端...")
    
    success_count = 0
    for i, row in enumerate(rows, 1):
        # 準備 Payload
        payload = {
            "日期": row.get("日期", ""),
            "項目": row.get("項目", ""),
            "備註": row.get("備註", row.get("內容", "")), # 相容舊欄位名
            "代墊人": row.get("代墊人", ""),
            "應付人員": row.get("應付人員", ""),
            "金額-台幣": row.get("金額-台幣", "").replace(',', ''),
            "金額-日幣": row.get("金額-日幣", "").replace(',', ''),
            "類別": row.get("類別", "")
        }
        
        print(f"[{i}/{len(rows)}] 上傳: {payload['項目']} ... ", end="", flush=True)
        
        try:
            # GAS doPost 針對 JSON payload 的標準呼叫方式
            url = f"{API_URL}?action=addExpense"
            headers = {"Content-Type": "text/plain"} # GAS requires text/plain for postData.contents sometimes
            res = requests.post(url, data=json.dumps(payload), headers=headers, allow_redirects=True)
            
            if res.status_code == 200:
                print("✅ OK")
                success_count += 1
            else:
                print(f"❌ 失敗 (狀態碼: {res.status_code})")
        except Exception as e:
            print(f"❌ 錯誤: {e}")
        
        # 避免觸發 GAS 的 rate limit
        time.sleep(1)

    print(f"\n🎉 上傳完成！成功上傳 {success_count}/{len(rows)} 筆。")
    print("👉 現在你可以重整網頁確認資料：https://neolinnnn.github.io/furano-cloud/")

if __name__ == "__main__":
    upload_data()

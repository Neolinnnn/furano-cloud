import csv

# 讀取 CSV
filename = r"d:\VSCODE\拆帳用\北海道花費(資料庫).csv"
NICKNAME_MAP = {
    "翰": "林廷翰", "林廷翰": "林廷翰",
    "君翰": "林君翰", "君": "林君翰", "林君翰": "林君翰",
    "定": "定定", "定定": "定定",
    "祥": "李鴻祥", "祥哥": "李鴻祥", "李鴻祥": "李鴻祥",
    "智": "張銘智", "阿智": "張銘智", "張銘智": "張銘智",
    "儒": "黃珮儒", "黃珮儒": "黃珮儒",
    "巧衣": "王巧衣", "王巧衣": "王巧衣",
    "大為": "林大為", "林大為": "林大為", "大維": "林大為",
    "雨玄": "王雨玄", "王雨玄": "王雨玄",
    "辣椒": "辣椒", "椒": "辣椒",
}

ALL_MEMBERS = ["林廷翰", "林君翰", "定定", "李鴻祥", "張銘智", "黃珮儒", "王巧衣", "林大為", "王雨玄", "辣椒"]
JPY_TO_TWD = 0.2038

def normalize(name):
    return NICKNAME_MAP.get(name.strip(), name.strip())

with open(filename, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

dawei_pay = 0
dawei_owe = 0

print("林大為 (Lin Da-wei) - 計算明細")
print("-" * 50)
for r in rows:
    status = r.get("狀態", "ok").strip()
    if status == "各自負擔" or status == "待確認":
        continue
        
    twd = r.get("金額-台幣", "").replace(",", "")
    jpy = r.get("金額-日幣", "").replace(",", "")
    twd = float(twd) if twd else 0
    jpy = float(jpy) if jpy else 0
    
    total = twd + (jpy * JPY_TO_TWD if jpy else 0)
    if total == 0:
        continue
        
    payer_str = r.get("代墊人", "")
    import re
    payers = [normalize(x) for x in re.split(r'[&＆、]+', payer_str) if x.strip()]
    if not payers:
        continue
        
    debtor_str = r.get("應付人員", "")
    debtors = [normalize(x) for x in re.split(r'[\s,，、]+', debtor_str) if x.strip()]
    if not debtors:
        debtors = ALL_MEMBERS[:]
        
    per_payer = total / len(payers)
    per_debtor = total / len(debtors)
    
    if "林大為" in payers:
        dawei_pay += per_payer
        print(f"[代墊] {r.get('項目')} (總額: {total:.2f}) -> 為 {len(payers)} 人代墊, 分配代墊: +{per_payer:.2f}")
        
    if "林大為" in debtors:
        dawei_owe += per_debtor
        print(f"[應付] {r.get('項目')} (總額: {total:.2f}) -> {len(debtors)} 人平分, 分擔: -{per_debtor:.2f}")

print("-" * 50)
print(f"總代墊: {dawei_pay:.2f}")
print(f"總應付: {dawei_owe:.2f}")
print(f"結算淨額: {dawei_pay - dawei_owe:.2f}")

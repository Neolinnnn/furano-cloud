import requests
import json
import re

URL = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec?action=getExpenses"

res = requests.get(URL, allow_redirects=True)
expenses = res.json()

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

def resolveName(n):
    return NICKNAME_MAP.get(n.strip(), n.strip())

def parsePayers(s):
    if not s or s.strip() == "各自負擔": return []
    return [resolveName(x) for x in re.split(r'[&＆、]', s) if x.strip()]

def parseDebtors(s):
    if not s or not s.strip(): return ALL_MEMBERS[:]
    return [resolveName(x) for x in re.split(r'[\s,，、]+', s) if x.strip()]

for exp in expenses:
    if exp.get("status") in ["各自負擔", "待確認"]: continue
    if not exp.get("amount_twd_total"): continue
    
    total = exp["amount_twd_total"]
    raw_payer = exp.get("payer", "")
    raw_debtor = exp.get("debtor_str", "")
    
    payers = parsePayers(raw_payer)
    debtors = parseDebtors(raw_debtor)
    
    for p in payers:
        if p not in ALL_MEMBERS:
            print(f"[{exp['item']}] ERROR: 找不到代墊人 {p} (原始: {raw_payer})")
            
    for d in debtors:
        if d not in ALL_MEMBERS:
            print(f"[{exp['item']}] ERROR: 找不到應付人 '{d}' (原始: {raw_debtor})")

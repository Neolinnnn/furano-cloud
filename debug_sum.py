import requests
import json

URL = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec?action=getSettlement"

res = requests.get(URL, allow_redirects=True)
data = res.json()

print("Analyzing sum of details...")

net_sum = 0
for name, details in data["user_details"].items():
    member_net = 0
    for d in details:
        if d["type"] == "pay":
            member_net += d["amount"]
            net_sum += d["amount"]
        elif d["type"] == "owe":
            member_net -= d["amount"]
            net_sum -= d["amount"]
            
print(f"Total calculated sum from details: {net_sum}")

print("\nMissing from allMembers check:")
# Check getExpenses
URL_EXP = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec?action=getExpenses"
exps = requests.get(URL_EXP, allow_redirects=True).json()

allMembers = ["林廷翰", "林君翰", "定定", "李鴻祥", "張銘智", "黃珮儒", "王巧衣", "林大為", "王雨玄", "辣椒"]

for exp in exps:
    if exp["status"] in ["各自負擔", "待確認"]: continue
    if exp["amount_twd_total"] is None: continue
    
    total = exp["amount_twd_total"]
    
    payers = exp["payers"]
    debtors = exp["debtors"]
    if not debtors: debtors = allMembers
    
    for p in payers:
        if p not in allMembers:
            print(f"[{exp['item']}] Missing payer: {p} (Amount per payer: {total/len(payers)})")
            
    for d in debtors:
        if d not in allMembers:
            print(f"[{exp['item']}] Missing debtor: {d} (Amount per debtor: {total/len(debtors)})")

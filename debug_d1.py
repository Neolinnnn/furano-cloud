import requests

URL = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec?action=getExpenses"

res = requests.get(URL, allow_redirects=True)
expenses = res.json()

for exp in expenses:
    if exp.get("item") == "富良野D1晚餐":
        print("富良野D1晚餐")
        print("Raw debtor string:", exp.get("debtor_str"))
        print("Parsed debtors array:", exp.get("debtors"))

import requests
import json

URL = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec?action=getSettlement"

res = requests.get(URL, allow_redirects=True)
data = res.json()

# Look at Dawei
print("林大為 Balance:", data["balance"].get("林大為"))

print("\nAll Balances:")
total_bal = 0
for name, amt in data["balance"].items():
    print(f"{name}: {amt}")
    total_bal += amt
    
print(f"Total Sum of Balances: {total_bal}")

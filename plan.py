"""Run-forward cash flow for BoA checking from data/events.json. Usage: python3 plan.py"""
import json
from datetime import date

d = json.load(open("data/events.json"))
bal = d["start_balance"]
print(f"Start {d['as_of']}: ${bal:,.2f}  ({d['start_balance_note']})\n")
print(f"{'Date':<11}{'Item':<52}{'Amount':>11}{'Balance':>12}")
low = (bal, d["as_of"])
for e in sorted(d["events"], key=lambda e: e["d"]):
    bal += e["amt"]
    flag = "  <-- NEGATIVE" if bal < 0 else ""
    if bal < low[0]:
        low = (bal, e["d"])
    print(f"{e['d']:<11}{e['label'][:51]:<52}{e['amt']:>11,.2f}{bal:>12,.2f}{flag}")
back = sum(b["amt"] for b in d["backlog"])
print(f"\nLowest balance: ${low[0]:,.2f} on {low[1]}")
print(f"Balance at horizon: ${bal:,.2f}")
print(f"Unscheduled backlog: ${back:,.2f}  ->  net after backlog: ${bal - back:,.2f}")
for b in d["backlog"]:
    print(f"   {b['label']:<48}{b['amt']:>10,.2f}")

"""Run-forward cash flow for BoA checking.
Usage: python3 plan.py [data/recommended.json]   (no arg = baseline: everything due, paid on time)"""
import json, sys

d = json.load(open("data/events.json"))
events, backlog, title = d["events"], d["backlog"], "Baseline (all bills paid as due, ComEd in full)"
if len(sys.argv) > 1:
    r = json.load(open(sys.argv[1]))
    events = [e for e in events if not any(e["label"].startswith(p) for p in r.get("remove_prefix", []))] + r["add"]
    backlog, title = r["backlog"], r["name"]
bal = d["start_balance"]
print(f"{title}\nStart {d['as_of']}: ${bal:,.2f}  ({d['start_balance_note']})\n")
print(f"{'Date':<11}{'Item':<52}{'Amount':>11}{'Balance':>12}")
low = (bal, d["as_of"])
for e in sorted(events, key=lambda e: e["d"]):
    bal += e["amt"]
    if bal < low[0]:
        low = (bal, e["d"])
    print(f"{e['d']:<11}{e['label'][:51]:<52}{e['amt']:>11,.2f}{bal:>12,.2f}{'  <-- NEGATIVE' if bal < 0 else ''}")
back = sum(b["amt"] for b in backlog)
print(f"\nLowest balance: ${low[0]:,.2f} on {low[1]}")
print(f"Balance at horizon: ${bal:,.2f}")
print(f"Still owed after horizon: ${back:,.2f}  ->  net: ${bal - back:,.2f}")
for b in backlog:
    print(f"   {b['label'][:60]:<62}{b['amt']:>10,.2f}")

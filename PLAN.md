# Bill Plan: Oct 16 - Nov 14, 2026

Built from `data/events.json` (run `python3 plan.py` to recompute). Pool = BoA checking *4265.
Paychecks: $2,604.28 on Oct 23, Nov 6, Nov 20. Uphold $250 on Oct 21, Nov 4, Nov 18 (separate account; must be moved to BoA to count).

## Bottom line
- Autopays + the mortgage + the ComEd shutoff payment fit **if** the paycheck lands Oct 23 and nothing else is added.
- Checking dips about **$157 negative** Oct 27 - Nov 4 (overdraft risk).
- **$1,960.91 of bills cannot be paid on time** in October. They have to be negotiated/split, then cleared from the Nov 6 and Nov 20 paychecks.
- Assumed starting balance $834.18 (last seen Oct 14). **Correct this first**; everything shifts with it.

## Priority order (consequence if missed)
1. **Mortgage ~$1,591** - modification fails. Pay Oct 23 (payday) once servicer confirms Oct receipt deadline. Pay exact amount, **one payment per month** (don't double up).
2. **ComEd $690.31 by Oct 28** - shutoff. Pay Oct 26 or get a payment arrangement / energy assistance first.
3. **Autopays** (Nicor, Xfinity Mobile, Dave, Earnin, Brigit, Capital One) - they fire on schedule; keep money in account.
4. **Arivo $952.17** (due 10/20, manual) - largest backlog item; call for a due-date change or one-payment deferral.
5. **Upstart $6,700 loan $213 (Nov 5, manual)**, Walmart card min $30 (Oct 25).
6. Water, garbage, Xfinity internet, ComEd current bill - small late fees; split into halves across Nov 6 / Nov 20.

## Day-by-day (BoA)
```
Start 2026-10-16: $834.18  (BoA checking *4265 balance after last txn seen on 2026-10-14. Oct 15-16 activity unknown - CONFIRM.)

Date       Item                                                     Amount     Balance
2026-10-19 Nicor Gas (autopay)                                     -106.00      728.18
2026-10-19 GitHub (autopay, worst case $4 + usage)                  -33.00      695.18
2026-10-21 Xfinity Mobile (autopay)                                -167.85      527.33
2026-10-21 Uphold deposit -> move to BoA                            250.00      777.33
2026-10-23 PAYCHECK (JLL)                                         2,604.28    3,381.61
2026-10-23 Dave ExtraCash settlement (autopay)                     -654.97    2,726.64
2026-10-23 Earnin repayment (autopay)                              -150.00    2,576.64
2026-10-23 Brigit Plus (autopay)                                     -8.99    2,567.65
2026-10-23 Crunchyroll (autopay)                                     -9.99    2,557.66
2026-10-23 MORTGAGE - October (modification)                     -1,591.00      966.66
2026-10-23 Zelle to wife                                           -150.00      816.66
2026-10-24 Walmart Spend Card minimum (due 10/25)                   -30.00      786.66
2026-10-26 ComEd past due (shutoff deadline 10/28)                 -690.31       96.35
2026-10-27 American Dance (autopay)                                -192.62      -96.27  <-- NEGATIVE
2026-10-27 Blizzard (autopay)                                       -16.08     -112.35  <-- NEGATIVE
2026-10-31 Dave membership (autopay)                                 -3.00     -115.35  <-- NEGATIVE
2026-11-01 Capital One minimum (autopay)                            -25.00     -140.35  <-- NEGATIVE
2026-11-01 Blizzard (autopay)                                       -16.53     -156.88  <-- NEGATIVE
2026-11-04 Uphold deposit -> move to BoA                            250.00       93.12
2026-11-05 Upstart $6,700 loan (manual)                            -213.00     -119.88  <-- NEGATIVE
2026-11-06 PAYCHECK (JLL)                                         2,604.28    2,484.40
2026-11-06 Life insurance                                          -126.10    2,358.30
2026-11-06 Zelle to wife                                           -150.00    2,208.30
2026-11-06 MORTGAGE - November (modification; due date TBD)      -1,591.00      617.30
2026-11-10 American Dance (autopay)                                -192.62      424.68
2026-11-12 Walmart Pay Later - tires (autopay)                      -49.66      375.02
2026-11-12 Claude subscription                                      -22.05      352.97
2026-11-14 Upstart $1,500 loan (autopay)                            -50.71      302.26

Lowest balance: $-156.88 on 2026-11-01
Balance at horizon: $302.26
Unscheduled backlog: $1,960.91  ->  net after backlog: $-1,658.65
   Arivo loan - October (was due 10/20)                952.17
   Water (due 10/20)                                   375.19
   Garbage - quarterly (due 10/20)                     141.57
   ComEd current bill (due 10/16)                      321.64
   Xfinity internet (was due 10/14)                    170.34
```

## Calls to make (before payday)
| Who | Ask |
|---|---|
| Mortgage servicer | Exact Oct receipt deadline for the modification payment; confirm exact amount; ask for it in writing. |
| ComEd (800-EDISON1 per ComEd's flyer) | Deferred payment arrangement on the $1,011.95 balance; confirm shutoff date and winter protections. |
| Illinois LIHEAP via CEDA Cook County (800-571-2332) | Apply now; households with a disconnect notice can apply. |
| Arivo | Move due date to ~25th (after payday) or defer the Oct payment; ask about late fee/grace. |
| Water / Homewood Disposal | Pay-in-two arrangement; garbage late fee is 1.5%/month. |
| Xfinity | Pay $170.34 on Nov 6; ask if service suspends before then. |

## Bridging the Oct 27 - Nov 4 dip (~$157)
Smallest tool first: Grant ($25-250, free plan, owe nothing now) -> repay on Nov 6 payday. Thrive (up to $500) and Brigit (up to $170) are backups. Each repayment lands on a payday, so use only what is needed.

## Stop the leak
- Dave ExtraCash cycle costs ~$40 in fees per advance + $3/mo; Brigit $8.99/mo. Break the cycle once the October hole is closed.
- Recurring extras to review: Prime Video $19.99, Claude $22.05, Crunchyroll $9.99, Blizzard ~$16 (maybe two charges), GitHub ~$29 extra, American Dance $192.62 biweekly (~$417/mo).

## Open questions
Current BoA balance, mortgage due date and servicer, Arivo grace/late fee, what GitHub's extra ~$29 is, Uphold -> BoA transfer method/time, savings balance in acct 8937, Capital One / Walmart / Upstart APRs.

Sources: [CUB: ComEd/Illinois utility protections](https://www.citizensutilityboard.org/covid-19-protections-for-utility-customers/) (older; confirm current terms with ComEd) - [Illinois LIHEAP: how to apply](https://dceo.illinois.gov/communityservices/utilitybillassistance/howtoapply.html) - [Mr. Cooper trial-plan tips](https://www.mrcooper.com/help-center/mortgage-assistance/trial-period-plan-success) (one servicer's rules; yours may differ)

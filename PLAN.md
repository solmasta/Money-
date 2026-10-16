# Bill Plan: Oct 16 - Nov 23, 2026

Built from `data/events.json` (run `python3 plan.py` to recompute). Pool = BoA checking *4265.
Paychecks: $2,604.28 on Oct 23, Nov 6, Nov 20. Uphold $250 on Oct 21, Nov 4, Nov 18 goes to the Uphold debit card and is spent directly (daily spending) - **not** counted in the BoA numbers below.

## Bottom line
- **It does not fully work on income alone.** Without Uphold in BoA, checking goes negative from Oct 26 (ComEd paid in full) and bottoms at **-$967 on Nov 5**; it recovers on the Nov 6 paycheck.
- By Nov 23 checking is **+$695**, but the **$1,960.91 backlog** is still unpaid, so the true gap through Nov 23 is about **-$1,266**.
- Not modeled: gas/food/other spending from BoA (Amoco, Walmart, etc. show up in your transactions). Uphold's $250 covers some of it; anything BoA pays makes this worse.
- Mortgage is **autopay $1,548.91 on Oct 23 and Nov 20** (both paydays - the paycheck must post before the draw).
- Starting balance is real: checking $422.95, savings $29.32 (Oct 16).

## Priority order (consequence if missed)
1. **Mortgage $1,548.91** - modification fails if missed. Autopay Oct 23. Make sure the paycheck is in before the draw (payday is also Oct 23), keep the exact amount, **one payment per month**. Ask the servicer for the receipt cutoff for each month.
2. **ComEd $690.31 by Oct 28** - shutoff. Pay Oct 26 or get a payment arrangement / energy assistance first.
3. **Autopays** (Nicor, Xfinity Mobile, Dave, Earnin, Brigit, Capital One) - they fire on schedule; keep money in account.
4. **Arivo $952.17** (due 10/20, manual) - largest backlog item; call for a due-date change or one-payment deferral.
5. **Upstart $6,700 loan $213 (Nov 5, manual)**, Walmart card min $30 (Oct 25).
6. Water, garbage, Xfinity internet, ComEd current bill - small late fees; split into halves across Nov 6 / Nov 20.

## Day-by-day (BoA)
```
Start 2026-10-16: $422.95  (BoA checking *4265 per app screenshot (Oct 16 evening). Savings *8937 = $29.32.)

Date       Item                                                     Amount     Balance
2026-10-19 Nicor Gas (autopay)                                     -106.00      316.95
2026-10-19 GitHub (autopay, $4/mo; old Copilot sub ended)            -4.00      312.95
2026-10-21 Xfinity Mobile (autopay)                                -167.85      145.10
2026-10-23 PAYCHECK (JLL)                                         2,604.28    2,749.38
2026-10-23 Dave ExtraCash settlement (autopay)                     -654.97    2,094.41
2026-10-23 Earnin repayment (autopay)                              -150.00    1,944.41
2026-10-23 Brigit Plus (autopay)                                     -8.99    1,935.42
2026-10-23 Crunchyroll (autopay)                                     -9.99    1,925.43
2026-10-23 MORTGAGE - October (autopay, modification)            -1,548.91      376.52
2026-10-23 Zelle to wife                                           -150.00      226.52
2026-10-24 Walmart Spend Card minimum (due 10/25)                   -30.00      196.52
2026-10-26 ComEd past due (shutoff deadline 10/28)                 -690.31     -493.79  <-- NEGATIVE
2026-10-27 American Dance (autopay, planned at high end $200;      -200.00     -693.79  <-- NEGATIVE
2026-10-27 Blizzard (autopay)                                       -16.08     -709.87  <-- NEGATIVE
2026-10-31 Dave membership (autopay)                                 -3.00     -712.87  <-- NEGATIVE
2026-11-01 Capital One minimum (autopay)                            -25.00     -737.87  <-- NEGATIVE
2026-11-01 Blizzard (autopay)                                       -16.53     -754.40  <-- NEGATIVE
2026-11-05 Upstart $6,700 loan (manual)                            -213.00     -967.40  <-- NEGATIVE
2026-11-06 PAYCHECK (JLL)                                         2,604.28    1,636.88
2026-11-06 Life insurance                                          -126.10    1,510.78
2026-11-06 Zelle to wife                                           -150.00    1,360.78
2026-11-10 American Dance (autopay, planned at high end $200;      -200.00    1,160.78
2026-11-12 Walmart Pay Later - tires (autopay)                      -49.66    1,111.12
2026-11-12 Claude subscription                                      -22.05    1,089.07
2026-11-14 Upstart $1,500 loan (autopay)                            -50.71    1,038.36
2026-11-19 Nicor Gas (autopay)                                     -106.00      932.36
2026-11-19 GitHub (autopay)                                          -4.00      928.36
2026-11-20 PAYCHECK (JLL)                                         2,604.28    3,532.64
2026-11-20 Zelle to wife                                           -150.00    3,382.64
2026-11-20 Arivo loan - November                                   -952.17    2,430.47
2026-11-20 MORTGAGE - November (autopay, modification)           -1,548.91      881.56
2026-11-21 Xfinity Mobile (autopay)                                -167.85      713.71
2026-11-23 Brigit Plus + Crunchyroll                                -18.98      694.73

Lowest balance: $-967.40 on 2026-11-05
Balance at horizon: $694.73
Unscheduled backlog: $1,960.91  ->  net after backlog: $-1,266.18
   Arivo loan - October (was due 10/20)                952.17
   Water (due 10/20)                                   375.19
   Garbage - quarterly (due 10/20)                     141.57
   ComEd current bill (due 10/16)                      321.64
   Xfinity internet (was due 10/14)                    170.34
```

## Calls to make (before payday)
| Who | Ask |
|---|---|
| Mortgage servicer | Confirm $1,548.91 autopay on Oct 23 and Nov 20 and the receipt cutoff; ask for it in writing. |
| ComEd (800-EDISON1 per ComEd's flyer) | Deferred payment arrangement on the $1,011.95 balance; confirm shutoff date and winter protections. |
| Illinois LIHEAP via CEDA Cook County (800-571-2332) | Apply now; households with a disconnect notice can apply. |
| Arivo | Move due date to ~25th (after payday) or defer the Oct payment; ask about late fee/grace. |
| Water / Homewood Disposal | Pay-in-two arrangement; garbage late fee is 1.5%/month. |
| Xfinity | Pay $170.34 on Nov 6; ask if service suspends before then. |

## Closing the hole (Oct 26 - Nov 5 dip of up to ~$967, plus ~$1,266 backlog)
Do these in order; each one shrinks the next:
1. **ComEd arrangement / energy assistance** - replace the $690.31 payment with a small down payment. Saves roughly $500+ right at the dip.
2. **Arivo deferral or due-date move** and **water / garbage / Xfinity payment plans** - pushes ~$1,960 of backlog past Nov 20 instead of into the dip.
3. **Bridge the remainder** with Grant ($250) + Thrive (up to $500) (+ Brigit up to $170 if needed), repaid on the Nov 6 payday. These are repaid from the same paychecks, so borrow the minimum.
4. **Close the leak** (below) so the Oct 23 hole does not repeat on Nov 6 / Nov 20.

## Stop the leak
- Dave ExtraCash cycle costs ~$40 in fees per advance + $3/mo; Brigit $8.99/mo. Break the cycle once the October hole is closed.
- Recurring extras to review: Prime Video $19.99, Claude $22.05, Crunchyroll $9.99, Blizzard ~$16 (maybe two charges), American Dance $150-200 biweekly (~$325-433/mo; planned at $200).

## Open questions
Mortgage servicer, Arivo grace/late fee, Uphold -> BoA transfer method/time, savings balance in acct 8937, Capital One / Walmart / Upstart APRs.

Sources: [CUB: ComEd/Illinois utility protections](https://www.citizensutilityboard.org/covid-19-protections-for-utility-customers/) (older; confirm current terms with ComEd) - [Illinois LIHEAP: how to apply](https://dceo.illinois.gov/communityservices/utilitybillassistance/howtoapply.html) - [Mr. Cooper trial-plan tips](https://www.mrcooper.com/help-center/mortgage-assistance/trial-period-plan-success) (one servicer's rules; yours may differ)

## Payoff order for the backlog (after Nov 6 paycheck)
Nov 6: Xfinity internet $170.34 + ComEd current $321.64. Nov 9: water $375.19 + garbage $141.57. Nov 20 paycheck: Arivo October $952.17 alongside the Nov payment (or whatever Arivo agrees to).

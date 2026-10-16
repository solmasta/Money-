# Bill Plan: Oct 16 - Nov 23, 2026

Source data: `data/events.json` + `data/recommended.json`. Recompute: `python3 plan.py` (baseline) or `python3 plan.py data/recommended.json`.
Account = BoA checking *4265 ($422.95 on Oct 16; savings *8937 = $29.32). Paychecks $2,604.28 on Oct 23, Nov 6, Nov 20. Uphold $250 (Oct 21, Nov 4, Nov 18) goes to the Uphold card for daily spending and is **not** in these numbers.

## The honest picture
- Income covers the **fixed** bills, but not October's **backlog** ($1,960.91) on top of a $805 advance repayment on Oct 23 (Dave $654.97 + Earnin $150).
- If everything is paid on time, checking goes to about **-$967 on Nov 5** and you end Nov 23 about **$1,266 short** (baseline, bottom of this file).
- The recommended plan keeps the account **positive the whole way** (lowest about $30), with **zero overdrafts**, but it ends Nov 23 with only ~$90 and still owes Arivo October ($952.17) and ComEd installments (~$490). Dec 4 and Dec 18 paychecks have to carry those.
- Not modeled: gas/food from BoA, the third Blizzard sub, late fees (a $75 allowance is included), real ComEd/Thrive/Grant terms.

## Priority order (what happens if missed)
1. **Mortgage $1,548.91 autopay Oct 23 and Nov 20** - modification fails. Both are paydays: confirm the paycheck posts before the draw. One payment per month only.
2. **ComEd shutoff by Oct 28** - get an arrangement/assistance instead of paying $690.31 in full.
3. **Autopays** (Nicor, Xfinity Mobile, Dave, Earnin, Brigit, Capital One) - keep money in the account.
4. **Arivo $952.17** (manual, due 10/20) - biggest backlog item; ask for a deferral.
5. **Upstart $6,700 ($213, Nov 5)**, Walmart card min $30 (Oct 25).
6. Water, garbage, Xfinity internet, ComEd current bill - small late fees; pay Nov 6-13.

## Action checklist
| When | Do |
|---|---|
| **Today / Mon Oct 19** | Call mortgage servicer: confirm $1,548.91 on Oct 23 and Nov 20, receipt cutoff, get it in writing. |
| **Mon Oct 19** | Call **ComEd (800-EDISON1)**: payment arrangement on the $1,011.95 balance; ask the shutoff date to be held while it's set up. Apply for LIHEAP via CEDA Cook County (800-571-2332); a disconnect notice qualifies you to apply. |
| **Mon Oct 19** | Call **Arivo**: move due date to ~25th or defer October to the end of the loan; ask about late fee/grace. |
| Oct 19-22 | **Do not spend from BoA** - it drops to ~$145 before payday. Live off Uphold ($250 lands Oct 21). |
| Oct 20 | Water ($375.19), garbage ($141.57): call, ask to pay Nov 9-13; note garbage's late fee is only 1.5%/mo. |
| Fri Oct 23 | Payday. Check the paycheck posted, then mortgage/Dave/Earnin draw. Zelle wife $150. |
| Oct 24 | Walmart Spend Card $30 minimum (due Oct 25). |
| Oct 25 | Grant advance ($250) in, so Oct 26 does not overdraft. |
| Oct 26 | ComEd arrangement down payment (amount depends on the call; plan assumes $200). |
| Oct 30 | Thrive advance ($300) in (covers Oct 31 - Nov 5 until payday). |
| Nov 5 | Upstart $6,700 $213 (manual). |
| Fri Nov 6 | Payday: repay Grant $250 and Thrive $300, Xfinity internet $170.34. |
| Nov 9-13 | ComEd current $321.64, garbage $141.57, water $375.19. |
| Fri Nov 20 | Payday + mortgage + Arivo November. |

## Ways to build margin (your call)
| Item | Saves / mo |
|---|---|
| Cancel Brigit Plus (after Oct 23, once the advance is repaid) | $8.99 |
| Drop Dave membership once off the advance cycle | $3.00 |
| Crunchyroll / Prime Video | $9.99 / $19.99 |
| Blizzard (three subs, ~$16 each) | ~$16 each |
| Claude | $22.05 |
| American Dance at $150 vs $200 per bill | ~$100 (two bills) |
| Break the Dave/Earnin cycle (~$40 fees per advance + ~$805 hit every payday) | the biggest lever |
| Zelle to wife (your decision) | $300 |

Other ideas: ask Arivo/Upstart about lower rates (Upstart loans are 29-32% APR; Arivo 18.88%), and ask Capital One/Walmart for a payment-date change to align with paydays.

## Recommended plan day by day
```
Recommended plan
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
2026-10-25 Grant advance IN                                         250.00      446.52
2026-10-26 ComEd payment arrangement: DOWN PAYMENT (assumed $2     -200.00      246.52
2026-10-27 American Dance (autopay, planned at high end $200;      -200.00       46.52
2026-10-27 Blizzard (autopay)                                       -16.08       30.44
2026-10-30 Thrive advance IN                                        300.00      330.44
2026-10-31 Dave membership (autopay)                                 -3.00      327.44
2026-11-01 Capital One minimum (autopay)                            -25.00      302.44
2026-11-01 Blizzard (autopay)                                       -16.53      285.91
2026-11-05 Upstart $6,700 loan (manual)                            -213.00       72.91
2026-11-06 PAYCHECK (JLL)                                         2,604.28    2,677.19
2026-11-06 Life insurance                                          -126.10    2,551.09
2026-11-06 Zelle to wife                                           -150.00    2,401.09
2026-11-06 Repay Grant                                             -250.00    2,151.09
2026-11-06 Repay Thrive                                            -300.00    1,851.09
2026-11-06 Advance fees allowance (unknown)                         -10.00    1,841.09
2026-11-06 Xfinity internet (backlog)                              -170.34    1,670.75
2026-11-09 ComEd current bill (backlog)                            -321.64    1,349.11
2026-11-09 Garbage - quarterly (backlog)                           -141.57    1,207.54
2026-11-10 American Dance (autopay, planned at high end $200;      -200.00    1,007.54
2026-11-12 Walmart Pay Later - tires (autopay)                      -49.66      957.88
2026-11-12 Claude subscription                                      -22.05      935.83
2026-11-13 Water (backlog)                                         -375.19      560.64
2026-11-13 Late fees allowance (unknown)                            -75.00      485.64
2026-11-14 Upstart $1,500 loan (autopay)                            -50.71      434.93
2026-11-19 Nicor Gas (autopay)                                     -106.00      328.93
2026-11-19 GitHub (autopay)                                          -4.00      324.93
2026-11-20 PAYCHECK (JLL)                                         2,604.28    2,929.21
2026-11-20 Zelle to wife                                           -150.00    2,779.21
2026-11-20 Arivo loan - November                                   -952.17    1,827.04
2026-11-20 MORTGAGE - November (autopay, modification)           -1,548.91      278.13
2026-11-21 Xfinity Mobile (autopay)                                -167.85      110.28
2026-11-23 Brigit Plus + Crunchyroll                                -18.98       91.30

Lowest balance: $30.44 on 2026-10-27
Balance at horizon: $91.30
Still owed after horizon: $1,442.48  ->  net: $-1,351.18
   Arivo October - deferral requested (pay at end of loan or sp      952.17
   ComEd arrangement installments (~$490 over ~4 months, from l      490.31
```

## Baseline (nothing negotiated, everything paid on time)
```
Baseline (all bills paid as due, ComEd in full)
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
Still owed after horizon: $1,960.91  ->  net: $-1,266.18
   Arivo loan - October (was due 10/20)                              952.17
   Water (due 10/20)                                                 375.19
   Garbage - quarterly (due 10/20)                                   141.57
   ComEd current bill (due 10/16)                                    321.64
   Xfinity internet (was due 10/14)                                  170.34
```

Sources: [CUB: ComEd/Illinois utility protections](https://www.citizensutilityboard.org/covid-19-protections-for-utility-customers/) (older; confirm current terms with ComEd) - [Illinois LIHEAP: how to apply](https://dceo.illinois.gov/communityservices/utilitybillassistance/howtoapply.html) - [Mr. Cooper trial-plan tips](https://www.mrcooper.com/help-center/mortgage-assistance/trial-period-plan-success) (one servicer's rules; yours may differ).

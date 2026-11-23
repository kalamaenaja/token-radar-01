# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/kalamaenaja/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/kalamaenaja/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-3) ranks 198 genuine pre-token DeFi protocols by implied token-launch value from the sealed 14 November 2026 DefiLlama snapshot, with a sortable and filterable dashboard, a detail view and a six-step farm plan for every protocol.

The model is a function of the snapshot, never a fixed list: implied value = TVL x category multiple x (1 + clamped 7-day TVL change / 100 x 0.6) x maturity (days listed with no token) x chain breadth. The category multiple is calibrated from the snapshot itself: the median market-cap/TVL of the live protocols in that category (five or more live to count; otherwise the whole-market median x0.169), clamped to 0.05–0.70 — a lending token is not priced like a DEX token, and the market says so. The board ranks only genuine pre-token candidates: a protocol must record no token at all, and wrapped, staked and bridged products of tokens that already trade are never ranked, however large their TVL. The dashboard's model sandbox re-runs the same function live, so a reader can move a slider and watch the board re-rank.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=38pbyq6n&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

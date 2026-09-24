# Wick — Name the chart in 5 guesses

Free daily browser game. Every day, everyone gets the same unlabelled price chart of a **famous market moment** and 5 guesses to name the asset. Wrong guesses unlock hints. At the end, the story is revealed with a share grid and a link to the real chart on TradingView.

- Launch: **Wed Oct 14, 2026, 00:00 UTC**. 100 puzzles through Jan 21, 2027.
- Static site on **GitHub Pages**. No backend, no accounts, no cookies, no API keys.
- A game about market history. **Not investment advice.**

## Play

`https://<owner>.github.io/wick/` (or your custom domain). New chart at 00:00 UTC.

## How puzzles are built (GitHub only)

Real data only. `scripts/build-puzzles.ts` runs **only in GitHub Actions**, fetches daily closes with `yahoo-finance2` (no key), verifies every `expect`, and writes `public/puzzles.json` + `data/build-report.md`.

1. Edit `data/puzzles.catalog.json` or `scripts/` via PR.
2. `Build puzzles` Action runs tests, builds, swaps failing puzzles with same-class reserves (`--swap`), commits results.
3. `Deploy to GitHub Pages` publishes `dist/`.
4. A founder reads `data/build-report.md` before launch.

Nobody runs anything locally. The site stores only dates + an index (first = 100), never prices.

## Data note

Charts built from public market data. After each game, **Open on TradingView ↗** links to the real chart (`tvUrl`). No widget is embedded (it would spoil tickers/dates).

## Analytics

Cookieless visitor counts by Cloudflare Web Analytics.

## Security

- No `innerHTML`/`eval` (lint-enforced), guess text rendered as text.
- CSP via meta tag. `rel="noopener"` on external links.
- Actions pinned to SHAs, minimal permissions, branch protection + Dependabot on.
- See `SECURITY.md` (gate checklist) before launch.

## Dev (web only; data builds on GitHub)

```bash
npm install
npm run dev
npm test
```

Site-only changes deploy via **Deploy to GitHub Pages**, which runs after a
successful **Build puzzles** run (or manual dispatch). After upload, set:
Pages › Source to **GitHub Actions**, Actions › Workflow permissions to
**Read and write**, and add the `CF_BEACON_TOKEN` repository variable.

## License

MIT — see `LICENSE` (© The Wick contributors).

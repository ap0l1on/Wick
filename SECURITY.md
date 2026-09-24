# Security gate (M8) — auditor signs PASS or BLOCK before launch

- [ ] `gitleaks` shows no secrets (repo has no keys by design; the Cloudflare beacon token is public by design).
- [ ] No `innerHTML` or `eval` (`npm run lint` green; guess text rendered as text).
- [ ] Hostile `localStorage` values reset cleanly (schema-checked `wick:*` keys; corrupt → defaults).
- [ ] `npm audit` shows no high or critical advisories.
- [ ] Actions pinned to commit SHAs; workflow `permissions` minimal (see both workflows).
- [ ] Branch protection on `main` (PRs for humans; `wick-bot` bypass via ruleset, or switch commit step to PR).
- [ ] Dependabot on (see `.github/dependabot.yml`).
- [ ] Day N+1's answer not readable from DOM on day N (answer stays XOR-obfuscated; decode only in memory; title/URL/share never contain it pre-reveal).
- [ ] External links use `rel="noopener"` (TradingView, GitHub).
- [ ] Analytics check: the Cloudflare beacon tag is hard-coded in `index.html`; no game state in URLs; CSP allows `static.cloudflareinsights.com` / `cloudflareinsights.com`.

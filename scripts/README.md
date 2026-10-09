# Scripts

| Script | npm | Purpose |
|---|---|---|
| `check-client-secrets.mjs` | `npm run check:secrets` | After `next build`: fails if any server-only secret value (from the current environment) appears in `.next/static` (browser bundles). Values are never printed. |
| `check-dodo-prices.mjs` | `npm run check:dodo-prices` | Read-only: GETs the Dodo products named by `DODO_PRODUCT_STARTER/PLUS/PRO` (with `DODO_PAYMENTS_API_KEY` / `DODO_PAYMENTS_ENVIRONMENT`) and fails unless each is a non-recurring USD product at exactly the `/pricing` price ($9.99 / $19.99 / $29.99). Run against sandbox and live before deploying a price change. Never prints the key. |
| `scan-git-history-secrets.mjs` | `npm run scan:history` | Scans every commit for credential patterns (incl. providers used in the project's history) and reports type, fingerprint and commit range — never the value. |

## funnel-report.mjs

Read-only paid-acquisition funnel by day and by ad (UTM): landing → sign-up → confirmed → founding seat → party →
activated → checkout → purchase. `SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/funnel-report.mjs --since 2026-10-10 --until 2026-10-14`.
Counts only; test/smoke/staff accounts excluded.

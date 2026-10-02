# Scripts

| Script | npm | Purpose |
|---|---|---|
| `check-client-secrets.mjs` | `npm run check:secrets` | After `next build`: fails if any server-only secret value (from the current environment) appears in `.next/static` (browser bundles). Values are never printed. |
| `scan-git-history-secrets.mjs` | `npm run scan:history` | Scans every commit for credential patterns (incl. providers used in the project's history) and reports type, fingerprint and commit range — never the value. |

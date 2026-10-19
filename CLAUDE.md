# Engineering rules: Magical Birthday Planner

Read @docs/AI_AGENT_HANDOFF.md and @README.md at the start of any non-trivial task.

## Stack
Next.js 15, TypeScript, Supabase (Postgres + RLS), Tailwind, Vercel, Sentry, Dodo Payments,
Resend, Google Places/Maps. Product model source of truth: lib/entitlements.ts.

## Environments (never mix them)
- LOCAL (this MacBook): feature branches, local Supabase in Docker, AI_PROVIDER=mock. This is
  where all development and testing happens.
- PREVIEW: Vercel branch deploys. Test keys only.
- PRODUCTION: master branch -> https://magicalbirthdayplanner.app. Every push to master deploys.
- .env.local must NEVER contain production keys. Never read, print or edit .env files.
- Never run commands against the production database. Never run supabase db reset against anything
  except the local database.

## Git workflow (non-negotiable)
- master is production. Never commit or push to master directly. Never force push.
- Every task starts on a new branch: git switch -c type/short-name (feat/, fix/, chore/, docs/).
- Make small commits with clear messages. Open a pull request to master when done; the founder merges.
- Never edit an already-applied Supabase migration. New migrations are additive and re-runnable.
- Migrations are applied to production BEFORE the code that needs them is deployed. Say so in the PR.

## Definition of done
- npm run check passes (lint, typecheck, unit tests, build, secret scan).
- If the change touches supabase/migrations, lib/entitlements.ts, lib/billing, lib/ai or app/api:
  also npm run test:integration. If UI flows changed: npm run test:e2e.
- The PR description states: what changed, why, tests run, and risk to entitlements, billing,
  AI limits, security, and migrations.
- Update CHANGELOG.md and any affected file in docs/.

## Safety rules
- Payment and entitlement logic is server-side only. Never move checks to the client.
- Never log or send prompts, emails, phone numbers, tokens or child details to Sentry or analytics.
- Server-only secrets stay in server-only modules. Run npm run check:secrets after touching env code.
- Don't add dependencies without saying why and what they cost in bundle size.

## How to work
- For anything bigger than a small fix: propose a short plan first and wait for approval.
- Explain changes in plain language; the founder is not a full-time engineer.
- If unsure whether something affects production, stop and ask.

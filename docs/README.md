# Documentation

Start with the repository [README](../README.md), then [AI_AGENT_HANDOFF.md](AI_AGENT_HANDOFF.md) and
[LAUNCH_BASELINE.md](LAUNCH_BASELINE.md) (v1.0, frozen). Files are kept flat (plus `ai/`, `experience/`, `brand/`,
`archive/`) so existing links stay valid; this index groups them by topic.

## Product
| Document | What it covers |
|---|---|
| [FEATURES.md](FEATURES.md) | Current feature inventory |
| [ai/AI_FEATURES.md](ai/AI_FEATURES.md) | Every AI feature (LIVE / disabled), architecture, limits, security |
| [experience/README.md](experience/README.md) | Party Experience layer: data model, flags, design |
| [MOBILE_UX.md](MOBILE_UX.md) · [PWA.md](PWA.md) | Route groups, navigation, mobile patterns, PWA |
| [ROADMAP.md](ROADMAP.md) | Now / near / medium / long term |
| [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) | Confirmed limitations, labelled blocking / non-blocking / future |
| [PRODUCT_MODEL_AUDIT.md](PRODUCT_MODEL_AUDIT.md) | Free / Starter / Plus / Pro model, validation, per-party billing |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Typography, colour tokens, components, navigation, mobile rules |
| [screenshots/](screenshots/README.md) | 42 product screenshots by area |

## Architecture & data
| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System, data model, migrations, key flows |
| [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) | Tables and policies used by the app |
| [LOCAL_DISCOVERY.md](LOCAL_DISCOVERY.md) | How venue discovery plans, ranks and caches |
| [GOOGLE_PLACES.md](GOOGLE_PLACES.md) · [GOOGLE_PLACES_COST_CONTROL.md](GOOGLE_PLACES_COST_CONTROL.md) | Google APIs, keys, field masks, cost guards |

## Security
| Document | What it covers |
|---|---|
| [SECURITY.md](SECURITY.md) | Security model, AI usage, RSVP, billing/admin, open items and trade-offs |
| [BILLING_SECURITY.md](BILLING_SECURITY.md) | Dodo checkout, webhook and entitlement design |

## Integrations, deployment & operations
| Document | What it covers |
|---|---|
| [INTEGRATIONS.md](INTEGRATIONS.md) | Status and setup of Supabase, Google, Resend, Dodo, AI provider, Sentry, Vercel, DNS |
| [RELEASE.md](RELEASE.md) | Deployment runbook: env vars, migrations, smoke test, device QA, rollback |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | Every variable: purpose, secret/public, production/preview (names only) |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Sentry setup, events, privacy, alerts, uptime |

## Testing
| Document | What it covers |
|---|---|
| [TESTING.md](TESTING.md) | Test layers, counts, commands, coverage |
| [ai/MANUAL_QA.md](ai/MANUAL_QA.md) | Manual AI QA script |

## Launch
| Document | What it covers |
|---|---|
| [LAUNCH_BASELINE.md](LAUNCH_BASELINE.md) | **v1.0 production baseline** (frozen): commit, deployment, migrations, tests, rollback |
| [AI_AGENT_HANDOFF.md](AI_AGENT_HANDOFF.md) | Orientation for future AI coding agents and rules for changes |
| [LAUNCH_STATUS.md](LAUNCH_STATUS.md) | Launch status history: completed, remaining, deferred |
| [LAUNCH_STRESS_TEST_REPORT.md](LAUNCH_STRESS_TEST_REPORT.md) | Pre-launch audit of 2026-10-03 (point-in-time; some findings since fixed) |
| [LAUNCH_READINESS_REPORT.md](LAUNCH_READINESS_REPORT.md) | Earlier launch review with evidence |
| [ai/LAUNCH_LOG.md](ai/LAUNCH_LOG.md) · [ai/LAUNCH_CHECKLIST.md](ai/LAUNCH_CHECKLIST.md) | AI launch log and checklist |
| [ai/AI_PRODUCTION_READINESS_REPORT.md](ai/AI_PRODUCTION_READINESS_REPORT.md) · [ai/PRODUCTION_AUDIT.md](ai/PRODUCTION_AUDIT.md) | AI readiness and audit |
| [ai/DECISIONS.md](ai/DECISIONS.md) · [ai/AUDIT.md](ai/AUDIT.md) · [ai/PROGRESS.md](ai/PROGRESS.md) · [ai/REPORT.md](ai/REPORT.md) | AI design decisions and build history |
| [LEGACY_CLEANUP_REPORT.md](LEGACY_CLEANUP_REPORT.md) | What was removed when the repository was consolidated |
| [archive/](archive/) | Dated audit reports from earlier phases (historical, not current instructions) |
| [../CHANGELOG.md](../CHANGELOG.md) | Milestones |

## Brand
| Path | What |
|---|---|
| [brand/](brand/) | Source icon (`MBP.png`, 96 px) and the 1024 px master; regenerate icons with `python3 scripts/brand-icons.py` |

# Party Experience layer — design, flags and launch

Branch `feat/party-experience` (on top of `style/nunito-footer`). Nothing here is in production. The goal: a parent
describes the birthday and every AI-created piece (activities, timeline, food, shopping, budget, what to say)
connects to the same party, but **nothing changes the party until the parent taps Add / Use / Save**.

## Data model (migration `20251004001000_party_experience.sql`, local only)
| Object | Table | Notes |
|---|---|---|
| Activity (AI or parent) | `party_ai_activities` (extended) | category, ages, setting, difficulty, cleanup, `status` idea/planned, `origin` ai/user, `user_edited`, `approved_at`, `designed_for_guests/theme`, `sort_order`; long sections (prep, instructions, host script, safety, variations, backup) in `details` |
| Prep task | `checklist_items.source_activity_id` | stable task key `act-<activity>-<n>`; re-adding is a no-op |
| Supply | `party_shopping_items.source_activity_id` | dedupe by item name |
| Cost estimate | `party_budget_lines.source_activity_id` | planned `amount` only; `actual_amount` is parent-only |
| Timeline | `party_timeline_items` (new) | single ordered timeline; activity rows have no duration of their own — they follow the activity, so editing an activity moves the schedule |
| Host content | `party_host_content` (new) | welcome / activity intro / cake / closing / reminder / thank-you (all or per guest) |
| Menu | `party_food_items` (new) | name, category, quantity, unit, cost, dietary tags, designed_for_guests |

RLS: `owns_party()` on every table; same-party triggers stop linking another party's activity or guest;
`remove_party_activity()` (security invoker) removes an activity with its timeline slot, unfinished prep tasks and
estimate-only budget lines (supplies and money already spent stay).

## AI features (existing factory: auth → strict body → ownership → flag → plan → limits → validated JSON → apply)
| Feature id | Route | What | Min plan (proposal) |
|---|---|---|---|
| `activity_studio` | `/api/ai/activity` | create one activity from the parent's words; or revise one (cheaper, more exciting, easier, shorter, longer, indoor, outdoor, less messy, younger, older, guests, theme, free text). Target activity is set by the server. | Plus |
| `host_content` | `/api/ai/host` | speeches and messages; may use the child's and confirmed guests' first names (like the invitation writer) | Starter |
| `party_experience` | `/api/ai/party-experience` | theme, activities, timeline, food, shopping, host lines, checklist, budget — separate sections, applied one by one; 55 s budget | Plus |
| `food` (changed) | `/api/ai/food` | structured menu items for the real headcount (RSVP kids/adults when they exceed the plan) | Pro (unchanged) |
| `timeline` (changed) | `/api/ai/timeline` | entries now carry kind + duration; "Add timeline" writes the single timeline | Starter (unchanged) |

New apply targets: `activity_update` (explicit replace, undo restores), `timeline`, `food`, `host`.
Context engine additions: effective guests, RSVP aggregates (counts + dietary tags, never names), start time,
planned activities with length/setting, timeline, menu, saved venue count. Empty sections are omitted.

Measured on the real model (2026-10-03): create activity 13 s / ~660 tokens, revise 6 s, welcome speech 3 s,
thank-yous 4 s, food 16 s / ~1,800 tokens, full experience 27 s / ~3,350 tokens (cap 4,000).

## Flags
- `NEXT_PUBLIC_EXPERIENCE_ENABLED=true` (build time, not secret): Activities tab (6-item nav), Party Magic hub on Plan,
  timeline / menu / "what to say" rows. Off → the current production UI (verified: 5-item nav, Planning help,
  `/activities` shows not-found).
- `AI_ENABLED_FEATURES` gains `activity_studio`, `host_content`, `party_experience` (server; each optional).
- The Activities tab works without AI (parents add their own activities); AI cards appear only when enabled.

## Launch order (do not skip step 1)
1. Apply `20251004001000_party_experience.sql` to production **before** deploying this code. The existing "Your party
   plan" now reads `party_ai_activities.status` and removes activities through `remove_party_activity()` — without
   the migration those two calls fail even with the experience flag off.
2. Merge `style/nunito-footer`, then this branch, deploy with the flag off; smoke-test.
3. Turn on `NEXT_PUBLIC_EXPERIENCE_ENABLED` (redeploy), then add AI features one at a time
   (`activity_studio` → `host_content` → `party_experience`), checking cost against `AI_GLOBAL_DAILY_LIMIT`
   (an experience call costs ~2× a Plan My Party call).

## Known limitations
- Guest-count / theme changes are flagged per activity ("Adjust it" / "Update for …"); food and shopping
  quantities are not auto-rescaled — the parent regenerates or edits (by design: approved content is never rewritten).
- Timeline reordering is up/down (no drag); no per-step start-time override.
- Thank-you messages are copy-only (no sending); per-guest uses confirmed guests' first names only.
- Discover integration is deep links (`/discover?chip=…`); there is no "party supplies" category to link to.
- A future "Party Rescue" and streaming responses are not built.

## Production launch log (2026-10-03)
| Step | Result |
|---|---|
| Migration `20251004001000` | applied with `supabase db push` (dry run first); recorded; 4 tables RLS-on with 4 policies each; `remove_party_activity` invoker-only for `authenticated`; existing rows' original columns byte-identical before/after (backfill removed in 1f8cf70) |
| Deploy, experience OFF | `dpl_ExJACbzKHfNufFSqcbfLy6cno5rU` (1f8cf70): full regression + P0 AI + Super Admin + Dodo test mode pass |
| `NEXT_PUBLIC_EXPERIENCE_ENABLED=true` | `dpl_3hsYsY6vSrapeomuW6oSpNcpkxpT`: 6-item nav at 375/390/393/430/1280 |
| `activity_studio` → `host_content` → `party_experience` | enabled one at a time, each verified on production before the next |
| Fixes found by the production checks | d468329 toast Undo under an open sheet · 0ae24d8 timeline step kept an old activity name · 838ff96 failure cause recorded · adce66b 44 px chips/footer/inputs · a3ac12f 55 s for long answers |
| Final | `dpl_J6eKxt3846MxoAJqL5xrZaLQ7Lrn` (a3ac12f) |

Rollback: set `NEXT_PUBLIC_EXPERIENCE_ENABLED=false` and remove the three features from `AI_ENABLED_FEATURES`, redeploy
(UI returns to the pre-experience look; data stays). Full code rollback: promote `dpl_9JwJKw7rGULTnAiz3SUC1Fpfm21g`
(78d24f1) — safe with migration 1000 applied (it only adds tables/columns that old code ignores).

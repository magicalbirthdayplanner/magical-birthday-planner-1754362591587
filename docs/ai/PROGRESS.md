# AI upgrade — progress

Branch: `feat/ai-upgrade` (from `mobile-first` @ a50a5fb). Production branch `master` is never touched by this work.

| Phase | Started (UTC) | Status | Commit | Notes |
|---|---|---|---|---|
| 0 Audit | 04:14 | done | 5c57764 | AUDIT.md |
| 1 Provider abstraction | 04:18 | done | 0e06637 | 19 unit tests |
| 2 Context engine | 04:23 | done | 7e687c6 | migration 0800 (local only) + context + 8 integration tests |

## Next
- Phase 0: write AUDIT.md.
| 3 Party planner | 04:27 | done | (see git log) | factory + capabilities + planner route/UI; 11 integration tests |
| 4 Contextual actions | — | done | (see git log) | theme_ideas + generic AIToolSheet + Plan AI tools registry |
| 5 Apply/save/edit/dismiss/undo | — | done | (see git log) | /api/ai/apply POST+DELETE, ApplyControls; 4 integration tests |
| 6 Usage controls | — | done | (see git log) | breaker, hourly cap, trial=Free, admin switching; 5 integration tests |
| P0 checkpoint | 04:54 | GREEN | (see git log) | lint, typecheck, unit 188, integration 158, E2E 31 (6 AI @375-430), build, secret+bundle scan clean |

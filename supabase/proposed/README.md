# Proposed migrations (NOT applied automatically)

Files here are **not** in `supabase/migrations/`, so `supabase db reset` / `db push` and CI never apply
them. Each one needs explicit owner approval and a production backup before it's moved into
`supabase/migrations/` with a new timestamp.

# Live database security baseline

Verified on 21 July 2026 against the configured production Supabase database.

- All 111 `fkh_` tables and views declared by `src/db/schema.ts` exist; none were missing or extra.
- All 110 physical `fkh_` tables have RLS enabled.
- The offline operation ledger and session record-version column were applied directly because the
  historical Drizzle journal stopped at migration 0022 while later schema changes had already been
  applied outside that journal.
- The journal was baselined at migration 0043 only after the complete table/view inventory matched.
  A subsequent `drizzle-kit migrate` completed successfully with no pending changes.
- The live `anon` and `authenticated` roles can execute the policy helper functions they need, while
  `PUBLIC` cannot.
- `npm run security:rls-live` creates random rollback-only fixtures for an owner, coach, viewer,
  editor, friend, stranger, blocked user, group moderator and administrator. It proved owner-only
  writes, delegated read access, editor-only delegated writes, friend/private-data separation,
  social blocking, private-group moderation, self-only admin-role visibility and anonymous denial.
- Coach Workspace evidence proves that only an assigned coach can create or update interaction rows,
  the player sees only `player_visible` rows, viewers see none, and removing the coach membership
  revokes access immediately. Coach-only notes are excluded from the player's personal export.
- An administrator role in application data does not automatically bypass user-data RLS. Privileged
  operational access remains an explicit audited server responsibility.

Run the live persona check after every RLS or policy-helper change. It requires `DATABASE_URL` and
must report all persona assertions plus `"transaction":"rolled-back"`.

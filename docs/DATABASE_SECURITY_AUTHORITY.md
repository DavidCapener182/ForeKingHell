# Database security authority

ForeKingHell uses two complementary trust boundaries. They are deliberately not interchangeable.

## Supabase client/API traffic

Requests made as `anon` or `authenticated` are protected by PostgreSQL row-level security. The JWT
subject is the application user id, and policy helpers grant only the documented owner, delegated,
social or group relationship. `scripts/live-rls-persona-check.mjs` verifies those policies against
the configured live database with rollback-only fixtures.

The live matrix covers:

- owner read/write and cross-tenant denial;
- coach and viewer read-only delegated access;
- editor delegated read/write access;
- friend versus private golf-data separation;
- stranger, blocked-user and anonymous denial;
- private group moderator access;
- administrator self-role visibility without an implicit private-data bypass.

## Application-server traffic

`DATABASE_URL` is a trusted server credential and may be connected as a role that is not constrained
in the same way as an end-user Supabase role. Therefore RLS is defence in depth for client/API role
traffic, not permission to issue an unscoped server query.

Every user-facing server repository or query must:

1. authenticate the caller before querying private data;
2. carry the caller or selected account id into the query;
3. constrain reads and writes by the owning user/account column;
4. treat delegated access as an explicit relationship check;
5. keep administrative operations separate and audit them;
6. never expose `DATABASE_URL` or the Supabase service-role key to browser code.

Schema changes use the migration credential only. Background work must use the narrowest practical
credential and keep user/account scope in every resumable job payload. A future separate-role rollout
should use `fkh_migrator`, `fkh_application`, `fkh_background_job` and `fkh_admin_operation`; changing
production ownership or connection-pool roles is an infrastructure migration, not an application
code assumption.

Run `npm run security:rls-live` after any RLS, grant or policy-helper change. Run the migrated-from-zero
CI job for every migration. A passing policy-source test without the live behavioural matrix is not
sufficient release evidence.

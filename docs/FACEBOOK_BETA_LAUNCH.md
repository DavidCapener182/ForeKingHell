# Facebook/Rapsodo Beta Launch

## Posting Criteria

Post to wider Facebook/Rapsodo groups only after:

- `npm run production:check` passes with `PLAYWRIGHT_AUTH_STATE`.
- Supabase Auth and RLS have been verified in the production project.
- Stripe billing is either fully configured or hidden from the tester cohort.
- Rapsodo import has been tested with at least one real tester CSV.
- Export/delete paths work.
- Privacy defaults have been checked from a signed-out browser and a second test account.

## Suggested Small-Batch Rollout

1. Invite 3-5 trusted testers.
2. Watch the import path and first coach action.
3. Fix any data mapping, mobile spacing or privacy confusion.
4. Invite 10-20 testers from Rapsodo/Facebook groups.
5. Keep billing expectations clear if paid plans are visible.

## Tester Message

LM World Tour turns Rapsodo sessions into stock yardages, progress signals and practice priorities. Social, challenges and leaderboards are optional. Your profile is private by default, and you choose what appears publicly or to friends.

Ask testers to try:

- Sign up.
- Import a Rapsodo CSV.
- Check club mapping.
- Review stock yardages.
- Follow the next practice action.
- Optional: share a PB or join a challenge.

## Watch During Launch

- Import errors or unsupported CSV formats.
- Confusing club mapping.
- Low Data Health scores without clear explanation.
- Mobile first-screen spacing issues.
- Any privacy surprise.
- Stripe entitlement mismatch.
- Course enrichment quota or provider API failures.

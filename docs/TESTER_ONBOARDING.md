# Tester Onboarding

Use this path for first public testers from Rapsodo and Facebook groups.

## First Session

1. Create an account or sign in.
2. Follow the dashboard first-run Rapsodo path if no shot data is present.
3. Open `/import`.
4. Upload a Rapsodo CSV or connect/sync Rapsodo if cloud sync is configured.
5. Confirm club mapping.
6. Review Import Quality and Data Health.
7. Open `/bag` to see stock yardages and gapping.
8. Open `/coach` or `/today` for the next practice action.
9. Optionally post a PB, join a challenge, enter a tournament or compare with friends.

## What To Tell Testers

LM World Tour is a data-first golf performance app. It should answer:

- What are my stock yardages?
- Can I trust this data?
- Am I improving?
- What should I practise next?
- What can I share or compete in if I want to?

## Data Visibility

- Profiles are private by default.
- Friends do not get account access.
- Public profile, feed and leaderboard visibility are controlled separately.
- Coach/viewer/editor access is managed in Settings and is separate from friendship.

## Tester Tasks

- Import one Rapsodo practice CSV.
- Import one round or simulated-course CSV if available.
- Check whether clubs are mapped correctly.
- Confirm that stock yardages make sense.
- Check Data Health and Import Quality.
- Follow the first coach next action.
- Try one optional social action: PB share, friend request, group, challenge, tournament or leaderboard.

## Feedback To Collect

- Was the import path obvious?
- Did the Import Quality score explain what was trusted?
- Did the Data Health score explain what still needed work?
- Did the first coach action feel specific enough?
- Was anything visible that felt private or surprising?
- Did any mobile page feel cramped, blank, duplicated or table-heavy?

## Capturing Authenticated Test State

Before declaring a tester build ready, capture a logged-in browser state and run the production gate with it:

```bash
npm run test:e2e:capture-auth
PLAYWRIGHT_AUTH_STATE=.playwright/auth/forekinghell-state.json npm run production:check
```

The capture helper opens `/login`, lets the tester account sign in, verifies the session can reach `/dashboard`, and stores the cookie-backed Supabase session in the ignored `.playwright/auth/` folder.

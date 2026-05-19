# Privacy And Data Visibility

ForeKingHell should be safe for first public testers because data visibility is explicit and conservative.

## Defaults

- Profile visibility is private by default.
- Generated feed cards are private/friend-controlled by default.
- Leaderboard visibility is opt-in through profile/settings controls.
- Friendships do not grant account access.
- Coach, viewer and editor roles are separate account memberships.

## What Different Audiences Can See

| Audience            | Expected access                                                |
| ------------------- | -------------------------------------------------------------- |
| Signed-out visitor  | Only public pages and public profiles/cards explicitly enabled |
| Stranger account    | Public profile/cards only, no private feed or exact shot data  |
| Friend              | Friend-visible profile, feed and leaderboard surfaces only     |
| Blocked user        | No friend-scoped access                                        |
| Group member        | Group-visible posts/challenges for that group                  |
| Coach/viewer/editor | Role-scoped account access from Settings invitations           |
| Admin/partner       | Gated admin/partner routes only                                |

## Verification Checklist

- Settings Visibility Simulator shows public, friend, coach/viewer/editor and shared-with-me states.
- Settings Data export/delete status shows export availability, delete confirmation and shared-account counts.
- Private profile defaults.
- Public profile visibility.
- Friend-only profile/feed visibility.
- Leaderboard opt-in.
- Blocked user access removal.
- Group membership access.
- Challenge/tournament visibility.
- Friendship separate from account access.
- Coach/viewer/editor role checks.
- Admin/partner route gating.
- Billing entitlement checks.
- Stripe webhook signature verification.
- Export/delete paths.

## Tester-Facing Copy

Use this wording in onboarding and settings:

Private by default. You control profile, feed and leaderboard visibility. Friends do not get account access. Coach, viewer and editor access is separate.

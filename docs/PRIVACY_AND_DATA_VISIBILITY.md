# Privacy And Data Visibility

LM World Tour should be safe for first public testers because data visibility is explicit and conservative.

## Defaults

- Profile visibility is private by default.
- Generated feed cards are private/friend-controlled by default.
- Leaderboard visibility is opt-in through profile/settings controls.
- Friendships do not grant account access.
- Coach, viewer and editor roles are separate account memberships.
- Reset golf data keeps the sign-in identity and preferences; permanent account deletion requires
  recent reauthentication and removes the Supabase Auth identity after revoking sessions, provider
  credentials and share links.

## External AI Processing

- Golf metrics are calculated by application code. External-model output explains or structures
  evidence and is not the system of record.
- Coach and Data Chat requests send only question-relevant golf evidence; unrelated account data and
  secrets are excluded.
- Scorecard extraction sends the scorecard image selected by the golfer to the configured external
  model after server-side decode/re-encode strips embedded metadata. The extraction route accepts
  only validated JPEG, PNG or WebP payloads, applies a pixel ceiling, does not persist the raw image,
  and stores a signed proof hash plus the approved derived scorecard data.
- AI-backed routes are authenticated, size-limited and rate-limited. Raw prompts, scorecard images,
  provider tokens and CSV contents must not be included in telemetry.

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
- Golf-data reset versus permanent auth-identity deletion.
- AI scorecard-image disclosure and no-persistence boundary.

## Tester-Facing Copy

Use this wording in onboarding and settings:

Private by default. You control profile, feed and leaderboard visibility. Friends do not get account access. Coach, viewer and editor access is separate. Scorecard extraction sends only the image you choose to the configured AI provider and does not keep the raw image.

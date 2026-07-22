# Route security matrix

This matrix is the minimum control contract for new endpoints. `proxy.ts` is deny-by-default: only
explicit public paths bypass authentication, and each public mutation must still enforce its own
signature, token, expiry, or rate-limit checks.

| Route class                      | Required controls                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Login, callback, and magic links | Generic errors, safe local return paths, provider callback validation, rate limiting, expired-session recovery         |
| AI generation                    | Authenticated owner, request-size limit, quota, server-side model allow-list, cost/usage event without prompt secrets  |
| Imports and provider sync        | Authenticated owner, byte/row/field limits, numeric bounds, source validation, sanitized rejection reason, idempotency |
| Scorecard and image proof        | Authenticated owner, signed proof token, exact JPEG/PNG/WebP, byte/pixel limits, metadata-stripping decode/re-encode   |
| Social mutations                 | Authenticated owner, rate limit, block and visibility checks, spam controls                                            |
| Invites and share links          | Single-purpose hashed token, expiry, revocation, owner-scoped lookup                                                   |
| Administrative operations        | Active admin authorization, recent authentication for destructive actions, sanitized audit event                       |
| Billing webhooks                 | Exact public path, Stripe signature, stored event id, duplicate-event idempotency                                      |
| Cron                             | Exact public path, `CRON_SECRET` bearer comparison, no wildcard cron namespace                                         |
| CSP violation reports            | Exact public path, 16 KB body limit, best-effort IP rate limit, directive/category-only logging                        |
| Offline replay                   | Authenticated owner header match, `(user_id, operation_id)` ledger, saved response replay, stale-write conflict        |
| Export and deletion              | Recent auth for deletion, manifest coverage, no-store response, secret redaction, global session revocation            |

New `/api` routes are private unless added to the explicit allow-list with a test explaining why the
route can be reached without a user session.

Launch-monitor imports are capped at 10 MB, 25,000 raw rows, 5,000 parsed shots and 4,096 characters
per CSV field. Rejections report only a sanitized row/column location and limit, never the field
contents.

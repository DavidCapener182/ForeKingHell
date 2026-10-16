# Independent acceptance-boundary review

Reviewed checkpoint `48c1c619` against the original three-feature specification. No production database, Stripe account mutation, deployment or remote push was performed. All new provider responses in tests are mocked.

## Material findings corrected

| Finding                                                   | Reproduction before the fix                                                                                                                           | Corrected behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import uses a plan read before acquiring the account lock | Hold the user row lock; start a sixth import while Pro; downgrade before releasing the lock. The old implementation saved it.                         | Re-read the plan through the same transaction executor after the lock. A downgraded account gets `IMPORT_LIMIT_REACHED`; premium-provider authorization is also checked there.                                                                                                                                                                                                                                                                                                                       |
| UTC check and charge can use different months             | Application check is in the next UTC month while PostgreSQL transaction-start `now()` is earlier. The old ledger is not charged in the checked month. | Check and ledger/import receipt inserts share one explicit post-lock timestamp. The clock regression observes exactly one current-month charge.                                                                                                                                                                                                                                                                                                                                                      |
| Opaque event IDs decide same-second billing state         | Apply cancellation, then a lexicographically greater stale trialing event with the same `created` second. The old implementation restores Pro.        | Serialise billing writes through the account lock. Same-second conflicts retrieve the current subscription resource with an eight-second timeout; errors fail the event for retry without changing the previous verified state. Once canonical reconciliation is needed, later updates also reconcile to prevent stale snapshots from overwriting a newer provider resource. Event IDs are used for identity, never chronology. A Checkout introduction cannot overwrite subscription/invoice state. |
| Old subscription can erase current entitlements           | New subscription active; deliver an older subscription's cancellation later. The old implementation removes the current plan entitlements.            | Store trusted provider subscription creation time and change plan entitlements only for the current subscription. Late history updates and trial-consumption records remain stored.                                                                                                                                                                                                                                                                                                                  |

The quota and UTC cases each failed against the preceding implementation and passed after correction. Both billing defects also failed before correction and passed afterward. Logs are retained in the task directory as `feature-review-red.log`, `feature-review-quota-red.log`, `feature-review-utc-red.log`, and `feature-review-green.log`.

The same-second regression additionally proves legitimate paid activation despite an earlier-sorting event ID, provider503 rollback, and successful retry. Current subscription reads expand the latest invoice; a payment-failed trigger still immediately revokes access unless a current payment is confirmed, preserving the existing failure policy. Existing tests still cover locked trial reservations across five devices, one-shot consumption without a pre-existing row, provider-confirmed expired Checkout replacement, atomic grant/consumption rollback, paid conversion without extending the trial window, and unconverted expiry.

## Owner and hole-gating inspection

- Round-plan save/load authenticate on the server, require Pro/Coach/Full, resolve course visibility for the current user, and filter persisted plans by both owner and course. Clients can supply only an intent, not user IDs or hole evidence. The actual database test verifies private-course denial, shared-course owner isolation, append history, insufficient evidence and trial-expiry rejection.
- Strategy requests validate integer holes1–18. Every hole2–18 is now explicitly tested as forbidden for both Free and Plus, and every mapped hole1–18 succeeds for Pro/Coach/Full. Invalid bounds/fractions/NaN fail400; preview remains hole1 only. Trialing and expired plan behavior is separately verified against real subscription rows.
- Duplicate imports still return before charging. A final-slot race still produces one saved import and one quota response. New paid-plan reads use the held transaction connection, avoiding pool starvation.
- No additional material owner-isolation or direct-hole-gating defect was found in this pass. This is a targeted acceptance review, not an exhaustive repository security audit.

## Operational consequence

Ambiguous subscription updates now make an authenticated **read** of Stripe's current subscription API at runtime. This uses the existing `STRIPE_SECRET_KEY`; no secret was created or changed here. Missing configuration or provider errors cause webhook retry, not an inferred grant. Operational acceptance must exercise this on an authorized Stripe test-mode deployment; no live provider call was made in this task.

Release remains blocked by the original high-severity lint dependency audit; see `LINT_EQUIVALENCE_REVIEW_2026_10_16.md`. Production migration0062 remains unapplied and needs the approved rollout before deploying dependent code. Full nightly runtime verification remains outstanding.

Primary reference: [Stripe webhook ordering and current-resource retrieval](https://docs.stripe.com/webhooks#event-ordering). Stripe does not guarantee event delivery order; current resources can be retrieved when snapshots are insufficient.

## Final local validation

- Full unit suite:3,199 passed;211 skipped (including opt-in DB tests).
- Explicit PostgreSQL acceptance:16 passed.
- Feature acceptance:9 browser flows passed across Chromium, Firefox and mobile WebKit.
- Affected Chromium accessibility/app flows:44 passed.
- Formatting, TypeScript, migration consistency, production build and route budgets passed.
- ESLint:zero errors;one pre-existing unused-variable warning.
- Restored dependency audit:11 moderate,five high,zero critical;release remains blocked.

# ForeKingHell — Codex-ready build plans

Original supplied specification, message Sentinel_5385f75b6b2c8191903ba8432cd535b0, received in three parts on 16 October 2026. Content below preserves the supplied scope, implementation prompts, acceptance criteria, product choices and exclusions. PR labels denote local chunks only; no remote changes are authorised. The original malformed repository link is preserved.

**Repo:** `[github.com/DavidCapener182/ForeKingHell\`](https://github.com/DavidCapener182/ForeKingHell%60)
**Local clone studied:** `/workspace/forekinghell/repo` @ `bb43ba1`
**Date:** 2026-10-16
**Scope:** Three features only. Do not push. Do not change remote state.

## Features

1. **Course Twin “Plan your next round”** as a **Pro** feature
2. **Fair Free import upgrade loop** at the **5 imports / month** limit
3. **7-day Pro trial** after the **first successful import** (Stripe Checkout `trial_period_days`)

---

## Shared foundation (read this first)

These three features share billing, entitlements, and post-import surfaces. Implement shared pieces once, then layer product UX.

### What already exists (do not reinvent)

| Area                                | Source of truth                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan catalogue & prices             | `src/lib/billing-plan-catalog.ts` — Free / Plus £6.99 / Pro £12.99 / Coach £49                                                                                                                                                       |
| Entitlement values                  | `src/lib/plan-entitlements.ts` — Free has `max_monthly_imports: 5`                                                                                                                                                                   |
| Feature gates (named paid features) | `src/lib/plan-access.ts` + `src/lib/require-plan-access.ts`                                                                                                                                                                          |
| Active plan resolution              | `src/lib/billing.ts` → `getActivePlanKeyForUser` / `resolveActivePlanKey` — **already treats `trialing` like `active`**                                                                                                              |
| Checkout session create             | `src/lib/billing.ts` → `createCheckoutSession` (form-urlencoded Stripe API)                                                                                                                                                          |
| Billing actions                     | `src/app/billing/actions.ts`                                                                                                                                                                                                         |
| Billing UI                          | `src/app/(app)/billing/page.tsx`, `src/app/billing/billing-checkout.tsx`                                                                                                                                                             |
| **Live** Stripe webhook             | `src/app/api/stripe/webhook/route.ts` → **`src/lib/stripe-webhook.ts`** (idempotent `fkh_stripe_webhook_events`)                                                                                                                     |
| Alternate/older webhook helpers     | `src/lib/stripe-billing.ts` — **do not extend for product work**; keep tests green if touched incidentally                                                                                                                           |
| Import quota                        | `src/lib/imports/import-allowance.ts` + enforcement in `src/lib/imports/save-rapsodo-import.ts` via `usageEvents` type `subscription_import`                                                                                         |
| Course Twin strategy API            | `src/app/api/course-twins/[courseId]/strategy/route.ts` — **currently ungated** (auth only)                                                                                                                                          |
| Mobile hole plan UI                 | `src/app/play/[courseId]/course-twin-mobile-plan.tsx` + `src/lib/course-twin-mobile-plan.ts`                                                                                                                                         |
| Strategy model                      | `src/lib/course-twin-strategy.ts` (`dispersion-monte-carlo-v1`)                                                                                                                                                                      |
| Bag evidence                        | `getCourseTwinBagProfiles` / `getMobileCourseTwinBagProfiles`                                                                                                                                                                        |
| Product analytics pattern           | Prefer `recordUsageEvent` in `src/lib/billing.ts` for account-scoped events. `trackPlausibleEvent` in `src/lib/analytics.ts` **only emits `Public *` events on public paths** — do not rely on it for billing/import product funnels |
| Latest migration tag                | `drizzle/0061_round_load_weighting.sql` → next is **`0062_...`**                                                                                                                                                                     |

### Shared schema / entitlement additions (one migration preferred)

Add a single migration `drizzle/0062_pro_trial_and_round_plan.sql` (and matching Drizzle schema updates in `src/db/schema.ts`) that covers trial eligibility **and** any persisted round-plan saves if Feature 1 needs them.

Recommended columns on `fkh_users` (or a 1:1 `fkh_billing_trials` table — prefer dedicated table to keep `users` lean):

```sql
-- Preferred: dedicated table
CREATE TABLE fkh_billing_trials (
  user_id uuid PRIMARY KEY REFERENCES fkh_users(id) ON DELETE CASCADE,
  pro_trial_eligible_after_import_at timestamptz, -- set on first successful import
  pro_trial_started_at timestamptz,
  pro_trial_ends_at timestamptz,
  pro_trial_consumed_at timestamptz, -- set when trial Checkout succeeds OR trial ends (one-shot)
  stripe_subscription_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fkh_billing_trials_consumed_idx ON fkh_billing_trials (pro_trial_consumed_at);
```

Optional for Feature 1 (round plan persistence):

```sql
CREATE TABLE fkh_course_twin_round_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES fkh_users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  tee_label varchar(80),
  intent varchar(24) NOT NULL DEFAULT 'normal', -- safe|normal|aggressive
  holes_json jsonb NOT NULL DEFAULT '[]',
  evidence_basis varchar(40) NOT NULL DEFAULT 'latest-reliable',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fkh_course_twin_round_plans_user_course_idx
  ON fkh_course_twin_round_plans (user_id, course_id, created_at DESC);
```

### Shared entitlement / gate keys

Extend `src/lib/plan-access.ts`:

```ts
course_twin_round_plan: {
  minimumPlan: "pro",
  label: "Course Twin round plan (all 18 holes)",
},
```

Extend `src/lib/plan-entitlements.ts` for Pro/Coach/Full:

```ts
["course_twin_round_plan", { value: true }],
```

Free/Plus: omit or `{ value: false }`. Soft teaser (1 hole) is **not** an entitlement — it is product UX that calls strategy for hole 1 only without requiring Pro.

### Shared Checkout helper changes (`createCheckoutSession`)

File: `src/lib/billing.ts`

Add optional input:

```ts
{
  planKey, interval, origin,
  trialDays?: 7,           // only for Pro
  trialReason?: "post_first_import" | "manual",
}
```

When `trialDays` set:

1. Assert `planKey === "pro"`.
2. Assert user eligible via `getProTrialEligibility(userId)` (Feature 3).
3. Add Stripe params:
   - `subscription_data[trial_period_days]=7`
   - `subscription_data[metadata][trial]=pro_7d`
   - `subscription_data[metadata][trial_reason]=...`
   - `metadata[trial]=pro_7d`
4. Success URL: `/billing?checkout=success&trial=1&session_id={CHECKOUT_SESSION_ID}`

### Shared webhook fix (critical for trials)

File: `src/lib/stripe-webhook.ts` — `handleCheckoutSessionCompleted`

**Today:** `payment_status === "paid"` → active entitlements; otherwise status `checkout_completed` and `active: false`.

**Stripe trials** often complete Checkout with `payment_status: "no_payment_required"` (card collected, £0 due). Current code would **not** grant Pro until `customer.subscription.created/updated` with `status: "trialing"`. That usually works _if_ subscription events arrive, but Checkout-alone leaves a window of “paid checkout, no access”.

**Required change:** treat as entitled when:

- `payment_status === "paid"`, **or**
- `payment_status === "no_payment_required"` and metadata/subscription indicates trial, **or**
- fetch/infer subscription status `trialing`

Set subscription row `status` to `trialing` when appropriate; `activeSubscriptionStatuses` already includes `trialing`.

Also mark `fkh_billing_trials.pro_trial_consumed_at` when a Pro trial subscription is first applied.

### Shared usage-event names

Use `recordUsageEvent` / direct `usageEvents` inserts (server-side):

| eventType                        | When                                           |
| -------------------------------- | ---------------------------------------------- |
| `subscription_import`            | Already exists — count toward Free limit       |
| `import_limit_warning_shown`     | 4/5 banner shown                               |
| `import_limit_reached`           | 5/5 block / upgrade panel shown                |
| `import_upgrade_cta_clicked`     | CTA to Plus/Pro/trial                          |
| `pro_trial_offer_shown`          | Post-first-import or limit panel               |
| `pro_trial_checkout_started`     | Checkout session created with trial            |
| `pro_trial_activated`            | Webhook applied trialing Pro                   |
| `pro_trial_expired`              | Webhook moved off trialing without paid active |
| `course_twin_plan_opened`        | Round plan screen opened                       |
| `course_twin_plan_hole_viewed`   | Hole card viewed                               |
| `course_twin_plan_saved`         | Plan persisted                                 |
| `course_twin_plan_upgrade_shown` | Free/Plus hit paywall after teaser             |

---

# Feature 1 — Course Twin “Plan your next round” (Pro)

## Goal

Let a Pro (or trialing Pro) golfer open a mapped Course Twin and get an **18-hole club plan** driven by **their measured bag evidence**, with safe / normal / aggressive intents, honesty about modelled vs measured data, and a save/export for the round.

Free/Plus may preview **one demo hole** then hit a fair upgrade path (Plus is not enough — minimum is Pro; trial offer if eligible).

## User stories

1. As a **Pro** player with stock/latest-reliable bag numbers, I can open a Course Twin and tap **Plan this round**, walk holes 1–18, and see recommended club + carry window + hazard risk per hole.
2. As a Pro, I can switch intent **Safe / Normal / Aggressive** and the recommendations update from existing simulation options (no invented distances).
3. As a Pro, I can **save the plan** and reopen it before tee-off on mobile.
4. As a **Free/Plus** player, I can try **Hole 1 only**, then see why Pro unlocks the full plan (and a 7-day Pro trial CTA if eligible).
5. As any player without enough bag evidence, I see a clear empty state linking to Import / Quick Bag — not a fake plan.

## UX flow (screen by screen + copy)

### A. Catalogue — `/course-twins`

**File:** `src/app/(app)/course-twins/page.tsx` + `src/app/course-twins/course-twin-catalogue.tsx`

On each twin card (or detail), add secondary CTA:

- Label: **Plan this round**
- Subcopy: `Club suggestions from your measured bag. Pro feature.`
- Link: `/play/{courseId}?mode=plan` (new mode; keep existing `strategy` / `replay`)

If Free/Plus: same CTA (teaser starts on hole 1).

### B. Entry — `/play/[courseId]?mode=plan`

**Files:**

- `src/app/(app)/play/[courseId]/page.tsx`
- `src/app/play/[courseId]/course-twin-runtime.tsx`
- New: `src/app/play/[courseId]/course-twin-round-plan.tsx` (client shell)
- Reuse: `course-twin-mobile-plan.tsx` per hole

**Header copy:**

- Title: `Round plan`
- Subtitle: `{Course name} · evidence: latest reliable bag`
- Intent segmented control: `Safe` | `Normal` | `Aggressive`
- Helper: `Options compare your simulated landings. They are not guaranteed on-course results.`

**Toolbar:**

- `Hole 1 of 18` with prev/next
- `Save plan` (Pro only)
- `Bag confidence` link → `/bag` or Quick Bag

### C. Hole card (reuse mobile plan visuals)

For each hole show:

- Map / overhead (existing)
- **Play:** `{Club} · {carryMedian}y carry`
- Confidence chip: `measured` / `developing` / `low_sample` (from strategy doc)
- Hazard line: `Modelled hazard chance ~{n}%`
- Disclosure (from `document.disclosure`): keep existing honesty string
- If estimated surfaces: badge `Estimated outline — treat hazards cautiously` (already partially in mobile plan)

**Empty / error copy (422 from API):**

> Strategy needs trusted full-swing carry and side readings. Import a range session, then check Quick Bag.

### D. Free/Plus teaser end (after hole 1 Next)

Fullscreen or bottom sheet:

- Title: `Hole 1 unlocked. Full 18 is Pro.`
- Body: `You’ve seen how your bag maps to this hole. Pro unlocks the rest of the round plan, AI coach, and Data Chat.`
- Primary: `Start 7-day Pro trial` (if eligible)
- Secondary: `Compare plans` → `/billing?required=pro&feature=course_twin_round_plan`
- Tertiary: `Back to Course Twin`

### E. Saved plans list (optional stretch in same epic)

`/play` or course twin catalogue section **Saved plans** — list latest saved plan per course.

## Exact files to create / modify

| Action | Path                                                                               | Change                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `src/lib/plan-access.ts`                                                           | Add `course_twin_round_plan` paid feature                                                                                                       |
| Modify | `src/lib/plan-entitlements.ts`                                                     | Pro/Coach/Full entitlement flag                                                                                                                 |
| Modify | `src/lib/plan-access.test.ts` / entitlements tests                                 | Cover new feature                                                                                                                               |
| Modify | `src/app/api/course-twins/[courseId]/strategy/route.ts`                            | Gate full use: allow hole 1 for all authed; holes 2–18 require Pro via `planFeatureRejection` / plan check. Accept `?preview=1` only for hole 1 |
| Create | `src/lib/course-twin-round-plan.ts`                                                | Assemble 18-hole plan document from bag + manifest; save/load helpers                                                                           |
| Create | `src/app/api/course-twins/[courseId]/round-plan/route.ts`                          | `GET` latest / `POST` save — Pro gated                                                                                                          |
| Create | `src/app/play/[courseId]/course-twin-round-plan.tsx`                               | 18-hole planner UI                                                                                                                              |
| Modify | `src/app/play/[courseId]/course-twin-runtime.tsx`                                  | Honour `mode=plan`                                                                                                                              |
| Modify | `src/app/(app)/play/[courseId]/page.tsx`                                           | Pass initialMode `plan`                                                                                                                         |
| Modify | `src/app/course-twins/course-twin-catalogue.tsx`                                   | CTA                                                                                                                                             |
| Modify | `src/lib/billing-plan-catalog.ts`                                                  | Add Pro bullet: `Course Twin round plan (all 18 holes)`                                                                                         |
| Modify | `src/components/marketing/pricing-section.tsx`                                     | Mirror catalogue bullet if marketing lists features from catalog                                                                                |
| Create | `drizzle/0062_...sql` + schema                                                     | `fkh_course_twin_round_plans` (+ trials table shared)                                                                                           |
| Tests  | `src/lib/course-twin-round-plan.test.ts`, route tests, Playwright smoke if present |

## Data / schema

- Table `fkh_course_twin_round_plans` as above.
- `holes_json` shape (suggested):

```json
[
  {
    "holeNumber": 1,
    "intent": "normal",
    "clubId": "...",
    "clubType": "7i",
    "carryMedianYd": 165,
    "confidence": "measured",
    "hazardChance": 0.12,
    "modelVersion": "dispersion-monte-carlo-v1"
  }
]
```

- No change to twin geometry packages.

## Entitlement / gating

- `requirePlanFeature(userId, "course_twin_round_plan")` on save + on strategy for holes ≥ 2.
- `getActivePlanKeyForUser` already grants Pro during `trialing`.
- Preview: authenticated Free/Plus may call strategy **only** with `holeNumber=1`.

## Stripe

None specific beyond sharing trial eligibility CTAs.

## Edge cases

- Twin missing hole geometry → skip hole with `Unavailable` card, don’t invent.
- Bag empty / low sample → 422 empty state.
- User upgrades mid-teaser → continue to hole 2 without reload loss (re-check plan on Next).
- Coach/Full inherit Pro via `planRank`.
- Concurrent saves → last-write-wins on `updated_at`; or insert new row each save (prefer append history, show latest).

## Analytics

`course_twin_plan_opened`, `_hole_viewed`, `_saved`, `_upgrade_shown` via `usageEvents`.

## Test plan

- Unit: round-plan assembler; gate helper (hole 1 free, hole 2 blocked).
- API: strategy route 401/422/403/200 matrix.
- Component: intent switching uses `mobileCourseTwinPlanOptions` only.
- E2E (optional auth): Pro completes 3-hole navigate + save; Free stopped after hole 1.

## Acceptance criteria

- [ ] Pro can open `?mode=plan` and navigate all holes with clubs from **their** bag evidence.
- [ ] Free/Plus limited to hole 1 preview + upgrade/trial CTA.
- [ ] Copy discloses modelled vs measured.
- [ ] Save requires Pro; reload shows last plan.
- [ ] Pricing catalogue mentions the feature under Pro.
- [ ] No strategy for holes 2–18 without Pro (API enforced, not UI-only).

## Implementation order (PR-sized chunks) + Codex prompts

### PR1.1 — Entitlement + strategy API gate

**Prompt:**

```
In ForeKingHell, add paid feature `course_twin_round_plan` (minimumPlan: pro) to src/lib/plan-access.ts and Pro/Coach/Full flags in src/lib/plan-entitlements.ts. Update tests. Gate src/app/api/course-twins/[courseId]/strategy/route.ts so holeNumber>=2 requires planHasFeature(course_twin_round_plan); hole 1 remains available to any authenticated user. Return 403 JSON via planFeatureRejection style {code:PLAN_REQUIRED,minimumPlan:pro}. Do not change Stripe. Keep honesty errors for empty bag.
```

### PR1.2 — Round plan lib + save API + migration

**Prompt:**

```
Add drizzle migration 0062 (or extend if 0062 trials already merged) creating fkh_course_twin_round_plans. Update src/db/schema.ts. Create src/lib/course-twin-round-plan.ts to build an 18-hole plan by calling buildCourseTwinStrategy per hole with getMobileCourseTwinBagProfiles/getCourseTwinBagProfiles. Add POST/GET src/app/api/course-twins/[courseId]/round-plan/route.ts gated with requirePlanFeature course_twin_round_plan. Include vitest coverage for JSON shape and gating.
```

### PR1.3 — Planner UI + catalogue CTA

**Prompt:**

```
Add mode=plan to Course Twin play: create course-twin-round-plan.tsx that reuses CourseTwinMobilePlan / mobile plan helpers, intent Safe|Normal|Aggressive, hole prev/next, Save plan calling round-plan API. Wire page.tsx + course-twin-runtime.tsx. For Free/Plus after hole 1, show upgrade sheet with billing?required=pro&feature=course_twin_round_plan and optional trial CTA hook (leave trial wiring stubbed if Feature 3 not merged). Add catalogue CTA Plan this round. Update billing-plan-catalog Pro features list. Follow PageShell full-width rules in AGENTS.md.
```

### PR1.4 — Tests + analytics events

**Prompt:**

```
Record usageEvents course_twin_plan_* from server actions/API. Extend route and UI tests. Add source tests ensuring strategy holes>=2 remain gated. No remote push.
```

---

# Feature 2 — Fair Free import upgrade loop (5 / month)

## Goal

When a Free user approaches and hits the existing **5 monthly imports (UTC month)** limit, show a **fair, value-first upgrade loop**: remaining count, what they’ve already earned from imports, clear Plus unlimited-imports path, and optional Pro trial if eligible — without mid-parse data loss surprises.

## User stories

1. As a Free user on import 4/5, I see a calm warning before I upload.
2. As a Free user at 5/5, I cannot start another **new** import; I see what unlimited imports unlock and can upgrade — duplicates still skip without consuming (already true).
3. As a Free user who just finished an import, I see remaining allowance on the result page.
4. As Plus/Pro/trialing, I never see the limit wall.

## UX flow + copy

### A. Import workspace header — `/import`

**Files:** `src/app/(app)/import/import-workbench-page.tsx`, companion import pages, `src/app/import/import-form.tsx`

Add `ImportAllowanceBanner` (new component):

- **0–3 used:** subtle status — `Free plan · {n} of 5 imports used this month (UTC)`
- **4 used:** warning —
  - Title: `1 import left this month`
  - Body: `Free includes 5 imports per UTC month. Upgrade to Plus for unlimited imports whenever you’re ready.`
  - Link: `See Plus` → `/billing?required=plus&feature=unlimited_imports` (feature query optional)
- **5 used:** destructive/info panel —
  - Title: `You’ve used this month’s 5 free imports`
  - Body: `Your saved sessions stay available. Upgrade to Plus for unlimited imports, or wait until {firstOfNextMonth UTC}.`
  - Primary: `Upgrade to Plus`
  - Secondary (if trial eligible): `Try Pro free for 7 days`
  - Tertiary: `Open import history`

Disable primary upload CTA at 5/5 (still allow browsing history / mapping UI).

### B. Hard stop (server — already exists)

`save-rapsodo-import.ts` throws:

> Your 5 monthly imports are used. Upgrade to Plus for unlimited imports, or wait until next month (UTC).

**Improve message** to stable code + structured payload so UI can render the panel:

Prefer throwing / returning:

```ts
{
  code: "IMPORT_LIMIT_REACHED",
  message: "...",
  used: 5,
  limit: 5,
  resetsAt: monthEnd.toISOString(),
  upgrade: { plus: "/billing?...", trialEligible: boolean }
}
```

Keep `ImportValidationError` but add optional `code` field.

### C. Client error handling — `import-form.tsx` / companion

On `IMPORT_LIMIT_REACHED`, render `ImportLimitUpgradePanel` instead of generic red text.

Panel copy:

- Title: `Pause here — your evidence is safe`
- Stats row (query): sessions imported this month, clubs with stock numbers, last import date
- `Why upgrade:` bullets from Plus catalogue (`Unlimited imports`, detailed analytics, share cards…)
- Buttons as above

### D. Result page — `/import/result`

Add compact chip: `Imports remaining this month: {remaining}` for Free; hide for paid/trialing.

After **first ever** successful import, if trial eligible, soft card (Feature 3):
`Your numbers are in. Try Pro free for 7 days?`

## Exact files

| Action | Path                                                                  | Change                                                                                                                          |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Create | `src/lib/imports/import-usage.ts`                                     | `getMonthlyImportUsage(userId)` using same UTC window + `subscription_import` (+ legacy fallback mirroring save-rapsodo-import) |
| Modify | `src/lib/imports/import-allowance.ts`                                 | Export `remaining`, `resetsAt`, human labels                                                                                    |
| Modify | `src/lib/imports/save-rapsodo-import.ts`                              | Structured `IMPORT_LIMIT_REACHED`; optionally record `import_limit_reached` usage event                                         |
| Create | `src/components/imports/import-allowance-banner.tsx`                  | Banner UI                                                                                                                       |
| Create | `src/components/imports/import-limit-upgrade-panel.tsx`               | Limit wall UI                                                                                                                   |
| Modify | `src/app/import/import-form.tsx`                                      | Wire banner + panel; disable upload at limit                                                                                    |
| Modify | companion import entry points                                         | Same                                                                                                                            |
| Modify | `src/app/(app)/import/result/result-workbench-page.tsx` (+ companion) | Remaining chip + trial soft offer hook                                                                                          |
| Modify | import pages loaders                                                  | Pass usage from server                                                                                                          |
| Tests  | allowance/usage/unit + form source tests                              |

## Data / schema

No new tables required for Feature 2 alone (uses `usageEvents`). Shared trials table used only for trial CTA eligibility.

## Entitlement / gating

Unchanged math: Free limit 5; non-free `limit: null` in `monthlyImportAllowance`. Trialling Pro counts as non-free via `getActivePlanKeyForUser`.

## Stripe

CTAs only — Plus checkout existing; Pro trial via Feature 3 helper.

## Edge cases

- Duplicate CSV → no quota charge (already returns before check).
- Offline queued import that later syncs after hitting limit → server rejects; show panel.
- Clock: month boundary is **UTC** (document in UI).
- Legacy month with only `importFiles` counts → keep migration-to-usageEvents path.
- User on Plus somehow with stale client banner → server is authority.

## Analytics

`import_limit_warning_shown`, `import_limit_reached`, `import_upgrade_cta_clicked`.

## Test plan

- Unit: used 0..5 remaining; paid unlimited.
- save-rapsodo-import: 5th allowed, 6th throws code.
- UI source tests: banner copy branches.
- Manual: Free account import 5 files, confirm 6th blocked with panel.

## Acceptance criteria

- [ ] Free users always see accurate remaining count before upload.
- [ ] At 5/5, upload disabled and server still enforces.
- [ ] Copy is fair (data kept; reset date shown; Plus is primary unlimited-import sell).
- [ ] Paid/trialing never blocked by import limit.
- [ ] Duplicate imports don’t consume quota.

## PR chunks + Codex prompts

### PR2.1 — Usage helper + structured limit error

**Prompt:**

```
Create src/lib/imports/import-usage.ts that returns {used,limit,remaining,allowed,monthStart,monthEnd} for a user by combining getActivePlanKeyForUser + monthlyImportAllowance + usageEvents subscription_import with the same legacy importFiles fallback as save-rapsodo-import.ts. Refactor save-rapsodo-import to use it. Extend ImportValidationError with code IMPORT_LIMIT_REACHED and structured fields. Update import-allowance tests and add import-usage tests. No UI yet.
```

### PR2.2 — Banner + disable upload

**Prompt:**

```
Add ImportAllowanceBanner and wire into import workbench/companion/import-form. Show remaining count; at 4/5 warn; at 5/5 disable primary save/upload and record import_limit_warning_shown / import_limit_reached usage events once per session. Follow existing design components (Alert, StatusPill).
```

### PR2.3 — Upgrade panel + result chip

**Prompt:**

```
When import fails with IMPORT_LIMIT_REACHED, render ImportLimitUpgradePanel with Plus checkout CTA and optional Pro trial CTA stub/hook. Add remaining imports chip on import result pages for Free users. Ensure duplicate-skip path unchanged. Add tests.
```

---

# Feature 3 — 7-day Pro trial after first successful import

## Goal

After a user’s **first successful (non-duplicate) import**, offer a **one-time 7-day Pro trial** via Stripe Checkout (`subscription_data[trial_period_days]=7`). Collect payment method up front; charge after trial unless canceled. Enforce **one trial per user**. On expiry without conversion, downgrade cleanly to Free (existing webhook paths).

## User stories

1. As a new Free user who just saved their first import, I see a clear Pro trial offer.
2. As an eligible user, I can start Checkout, enter card details, and land back in-app as Pro (`trialing`) within seconds of webhooks.
3. As a user who already consumed a trial, I never see the offer again (Plus upgrade still available).
4. As a user who cancels during trial, I keep Pro until trial end (Stripe default) then return to Free.
5. As a user with no successful import yet, I cannot start the trial (eligibility).

## UX flow + copy

### A. Trigger — first successful import

In `save-rapsodo-import.ts` after a new session is committed (not `skipped: true`):

1. Count lifetime successful imports for user (non-duplicate `importFiles` or distinct `subscription_import` total).
2. If lifetime === 1 → upsert `fkh_billing_trials.pro_trial_eligible_after_import_at = now()` where row missing / not consumed.

### B. Offer surfaces

1. **`/import/result`** card (primary)
2. Import limit panel secondary CTA (Feature 2)
3. Billing page callout when `?trial=offer` or eligible
4. Course Twin upgrade sheet (Feature 1)

**Card copy:**

- Eyebrow: `Pro trial`
- Title: `Your first session is in. Try Pro for 7 days.`
- Body: `Unlock Course Twin round plans, AI coach, Data Chat, and unlimited imports. Add a card now — you won’t be charged until the trial ends. Cancel anytime in billing.`
- Primary button: `Start free Pro trial`
- Fine print: `One trial per account. After 7 days, Pro continues at £12.99/month unless you cancel.`
- Dismiss: `Not now` (sets local dismiss or `usageEvents` `pro_trial_offer_dismissed`; still eligible until consumed)

### C. Checkout

Button → server action `startProTrialCheckoutAction` → `createCheckoutSession({ planKey:"pro", interval:"monthly", trialDays:7, trialReason:"post_first_import" })` → redirect Stripe.

Success → `/billing?checkout=success&trial=1`

Copy on success alert:

> Pro trial is starting. Full Pro access appears once Stripe confirms (usually under a minute). Refresh if entitlements are not visible yet.

### D. Billing while trialing

Current plan card already special-cases `trialing` (see `billing/page.tsx` status). Enhance:

- Badge: `Pro trial`
- Text: `Trial ends {date}. Then £12.99/month unless cancelled.`
- Manage billing → portal (cancel trial)

### E. Expiry

Webhook `customer.subscription.updated` / `deleted` with non-entitled status → `resolveActivePlanKey` → Free. Set `pro_trial_consumed_at` if not set. Optional email later (out of scope).

## Exact files

| Action | Path                                                | Change                                                                                                       |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Create | `drizzle/0062_pro_trial_and_round_plan.sql`         | `fkh_billing_trials` (+ round plans if Feature 1)                                                            |
| Modify | `src/db/schema.ts`                                  | Table + types                                                                                                |
| Create | `src/lib/billing-pro-trial.ts`                      | `getProTrialEligibility`, `markTrialEligibleAfterFirstImport`, `markTrialConsumed`, `assertCanStartProTrial` |
| Modify | `src/lib/billing.ts`                                | `createCheckoutSession` trial params; export eligibility to page data                                        |
| Modify | `src/lib/stripe-webhook.ts`                         | Checkout completion for `no_payment_required` / trialing; consume trial row; keep idempotency                |
| Modify | `src/lib/stripe-webhook.test.ts`                    | Cases for trial checkout + subscription.created trialing                                                     |
| Modify | `src/app/billing/actions.ts`                        | `startProTrialCheckoutAction` / form action                                                                  |
| Modify | `src/app/(app)/billing/page.tsx`                    | Trial offer + trialing banner copy                                                                           |
| Create | `src/components/billing/pro-trial-offer-card.tsx`   | Reusable offer UI                                                                                            |
| Modify | `save-rapsodo-import.ts`                            | Mark eligibility on first success                                                                            |
| Modify | import result pages                                 | Show offer card                                                                                              |
| Modify | `getBillingPageData`                                | Include `trial: { eligible, consumed, endsAt, status }`                                                      |
| Tests  | eligibility unit tests; webhook tests; action tests |

## Data / schema

`fkh_billing_trials` as in Shared foundation.

**Eligibility rules (code):**

```
eligible iff:
  activePlanKey === "free"
  AND pro_trial_consumed_at IS NULL
  AND pro_trial_eligible_after_import_at IS NOT NULL
  AND no prior subscriptions row for user with metadata.trial=pro_7d OR planKey=pro with status in (trialing,active,past_due,canceled) that was a trial
```

Simplest robust approach: **`pro_trial_consumed_at` is the one-shot flag**, set when Checkout trial subscription is first applied. Also set it if admin grants Pro? No — only trial path. If user pays for Pro without trial, leave consumed null but offer hidden because `activePlanKey !== "free"`. If they later churn to Free, **do not** re-offer (set consumed when any Pro trial subscription exists, OR set consumed on first Pro checkout whether trial or not if product decision is “one Pro intro ever”).

**Product decision (recommended):** one **trial** per account only; paid Pro without trial does not burn trial; after paid Pro churn, trial still available **only if** never trialed — rare; acceptable. Implement: burn only when Stripe subscription has `trial_start` / metadata `trial=pro_7d`.

## Entitlement / gating

No new paid feature key — trial grants full `pro` entitlements via existing `planEntitlements.pro` while `subscriptions.status === "trialing"`.

## Stripe changes (detail)

### Checkout session params (form-urlencoded, matching existing style)

```
mode=subscription
line_items[0][price]=$STRIPE_PRO_MONTHLY_PRICE_ID
line_items[0][quantity]=1
subscription_data[trial_period_days]=7
subscription_data[metadata][user_id]=...
subscription_data[metadata][plan_key]=pro
subscription_data[metadata][trial]=pro_7d
metadata[user_id]=...
metadata[plan_key]=pro
metadata[trial]=pro_7d
payment_method_collection=always   # ensure card on file for trial
```

Use **monthly** Pro price for trial (yearly trial is awkward).

### Webhook events (already handled types)

| Event                           | Required behaviour                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | If trial metadata / `no_payment_required`, upsert subscription `trialing`, apply Pro entitlements with `expiresAt ≈ trial_end` if present, mark trial consumed |
| `customer.subscription.created` | If `status=trialing`, apply Pro entitlements; store `trial_end` in metadataJson / trials.pro_trial_ends_at                                                     |
| `customer.subscription.updated` | `trialing`→`active` keep Pro; `trialing`→`canceled`/`unpaid` expire entitlements; update trials row                                                            |
| `customer.subscription.deleted` | Expire plan entitlements (existing)                                                                                                                            |
| `invoice.paid`                  | First post-trial invoice → active Pro (existing)                                                                                                               |
| `invoice.payment_failed`        | Existing past_due / expire behaviour — confirm product wants immediate revoke vs Stripe retry; **keep current code behaviour** unless tests demand otherwise   |

### Expiry / downgrade

Rely on Stripe ending trial → invoice → `active` or failure. Local `resolveActivePlanKey` already drops non-active/non-trialing to Free. Ensure entitlements `expiresAt` cleared/replaced on each webhook (`replacePlanEntitlements` / `applySubscriptionState` already delete+insert plan entitlements).

## Edge cases

- **Double-click Start trial** → eligibility check + Stripe idempotency; mark consumed only after webhook success (not before redirect). Optionally optimistic `pro_trial_started_at` to reduce double Checkout; clear if Checkout abandoned after 1h (cron optional — document as follow-up).
- **User already Plus** → not eligible (on Plus). To trial Pro they must use “Manage billing” upgrade — out of scope (Stripe subscription update). Hide trial CTA.
- **Stripe not configured** → offer hidden; billing page already shows unavailable.
- **Webhook delay** → success page copy asks refresh.
- **First import via offline sync** → eligibility still set on successful save path.
- **Duplicate first file** → `skipped: true` must **not** mark eligibility.
- **`stripe-billing.ts` vs `stripe-webhook.ts`** → only fix live webhook module.

## Analytics

`pro_trial_offer_shown`, `pro_trial_checkout_started`, `pro_trial_activated`, `pro_trial_expired`, `pro_trial_offer_dismissed`.

## Test plan

- Eligibility matrix unit tests.
- Webhook: fixture Checkout `payment_status=no_payment_required` + metadata trial → entitlements Pro + consumed.
- Webhook: subscription.updated status active after trial.
- Webhook: second trial Checkout attempt rejected by eligibility.
- save-rapsodo-import: first success sets eligible_after_import; duplicate does not.
- Action: ineligible returns error without calling Stripe.

## Acceptance criteria

- [ ] Trial offer appears only after first real import and only once.
- [ ] Checkout uses `trial_period_days=7` on Pro monthly price.
- [ ] User becomes Pro while `trialing` (imports unlimited, Course Twin plan unlocked).
- [ ] After trial without pay, user is Free again; import limit returns.
- [ ] Webhook idempotent; no double entitlements corruption.
- [ ] Billing UI shows trial end date.

## PR chunks + Codex prompts

### PR3.1 — Schema + eligibility library

**Prompt:**

```
Add drizzle migration 0062 creating fkh_billing_trials (user_id PK, pro_trial_eligible_after_import_at, pro_trial_started_at, pro_trial_ends_at, pro_trial_consumed_at, stripe_subscription_id, timestamps). Update src/db/schema.ts. Implement src/lib/billing-pro-trial.ts with getProTrialEligibility, markTrialEligibleAfterFirstImport, markTrialConsumed, assertCanStartProTrial. Vitest the matrix (no import, first import, consumed, already pro, plus user). Do not wire Stripe yet.
```

### PR3.2 — Checkout trial_period_days + actions

**Prompt:**

```
Extend createCheckoutSession in src/lib/billing.ts to accept trialDays/trialReason. When trialDays=7 and planKey=pro, call assertCanStartProTrial, set subscription_data[trial_period_days]=7 and trial metadata, prefer payment_method_collection=always. Add startProTrialCheckoutAction in src/app/billing/actions.ts. Expose trial info from getBillingPageData. Unit/integration tests with mocked fetch.
```

### PR3.3 — Webhook trial handling + consume

**Prompt:**

```
Update src/lib/stripe-webhook.ts handleCheckoutSessionCompleted so payment_status no_payment_required with metadata trial=pro_7d (or subscription status trialing) applies Pro entitlements with status trialing (use activeSubscriptionStatuses). On first trial activation mark fkh_billing_trials consumed + ends_at from trial_end if present. Extend stripe-webhook.test.ts with trial fixtures. Do not break existing paid checkout tests.
```

### PR3.4 — Offer UI + first-import hook

**Prompt:**

```
In save-rapsodo-import after a non-skipped successful import, call markTrialEligibleAfterFirstImport when lifetime successful imports become 1. Add ProTrialOfferCard to import result + billing page. Record usage events. Wire Feature 1/2 CTAs to startProTrialCheckoutAction when eligible. Copy must state one trial per account and £12.99/month after 7 days.
```

---

## Cross-feature dependency graph

```
PR3.1 schema/eligibility ──┬──► PR3.2 checkout trial ──► PR3.3 webhook ──► PR3.4 offer UI
                           │
PR2.1 import usage ──► PR2.2 banner ──► PR2.3 upgrade panel ──uses──► PR3.4 trial CTA
                           │
PR1.1 entitlement/API gate ──► PR1.2 save API ──► PR1.3 planner UI ──uses──► PR3.4 trial CTA
```

**Suggested merge order:**
`3.1` → `2.1` → `1.1` → `3.2` → `3.3` → `2.2` → `2.3` → `1.2` → `1.3` → `3.4` → `1.4`

Shared migration `0062` should land in **PR3.1** (include round_plans table empty-ready even if Feature 1 fills it in PR1.2).

---

## Risks & open questions (from code review)

1. **Checkout trial payment_status gap (HIGH):** Live webhook treats only `payment_status === "paid"` as entitled on `checkout.session.completed`. Trials often use `no_payment_required`. Subscription events likely fix this, but PR3.3 must make Checkout path safe.
2. **Two Stripe modules:** `stripe-webhook.ts` is production; `stripe-billing.ts` is parallel. Codex must not “fix the wrong file.”
3. **Yearly + trial:** Use monthly Pro price only for trials; clarify UX if user wanted yearly.
4. **Plus users and Pro trial:** Not supported without subscription-update flow — CTAs must hide for non-Free.
5. **Course Twin strategy currently ungated:** Shipping Feature 1 without API hole≥2 gate would be UI-only theatre.
6. **Analytics:** In-app Plausible helper drops non-`Public` events — use `usageEvents` for funnel metrics.
7. **Import month is UTC:** Surface that in copy to avoid UK-evening confusion.
8. **First import definition:** Confirm offline / Square-Pro-only paths; Free users can’t Square import anyway (`ImportValidationError` Pro check exists).
9. **Entitlement expiry during trial:** Prefer `trial_end` timestamp on entitlements.expiresAt when Stripe provides it.
10. **Double consumption race:** Two devices starting trial Checkout before webhook — mitigate with eligibility transaction / unique consumed constraint.
11. **Marketing catalogue vs app Pro bullets:** Keep `billing-plan-catalog.ts` as single list for billing + marketing.
12. **Open product question:** If a user pays for Pro **without** trial, then cancels to Free, should they still get a trial later? Recommendation in plan: **yes, if never trialed**; implement via consuming only on `trial=pro_7d` metadata.

---

## Out of scope

- Coach trials
- App Store / RevenueCat (web Stripe only)
- Changing Free limit away from 5
- Building new Course Twin geometry
- Pushing branches or opening PRs from this agent session

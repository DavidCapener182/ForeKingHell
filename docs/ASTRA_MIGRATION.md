# GPT-6 Astra migration

Status: Stage 1 source implementation and synthetic provider verification complete. Production rollout and Stages 2–3 are not complete.

## Implementation

- Stage 1: coach_summary, coach_chat, data_chat, practice_recap and course_strategy use an Astra source default. Explicit feature and shared environment overrides keep precedence; deployment environments must be checked before claiming a switch.
- Stage 2: scorecard_extract and weekly_recap retain gpt-4.1-mini until image/recap evaluation passes.
- Stage 3: social_caption, session_roast and challenge_copy retain the fast model. coach_player_summary is configured but has no identified generation caller.
- Preserve all feature entitlements, quotas, credit prices and existing fallback resolution. fallbackModel is a configuration fallback, not an automatic retry after a provider error.
- Astra uses low reasoning with 4096 tokens of additional headroom above the existing feature output allowance. This is an initial bounded budget, not a measured optimum.
- Keep strict JSON schemas. Reject non-completed responses and refusals before caching/charging. Bound provider fetch and response-body consumption to 45 seconds.
- Cache fingerprints include model, actual prompt messages, schema and generation settings. No deletion of existing cache records is necessary.
- Successful usage metadata records duration, reasoning tokens and provider cache counts without raw prompts or responses.

## Validation and release gates

- [x] Existing authorised API key can retrieve gpt-6-astra (HTTP 200).
- [x] Shared-client regression tests and existing AI, scorecard and quota tests: 57 passed; full local suite: 3095 passed, 191 skipped.
- [x] Synthetic live baseline/Astra comparison through the shared client: 10/10 passed (five Stage 1 features on each model).
- [x] Changed TypeScript lint and project typecheck passed before concurrent calibration edits. Full-repository lint later reported parse errors in active equipment/calibration work; the coordinator must rerun final checks after those edits settle.
- [ ] Repository format and build: full format reports unrelated tools/course-twin-blender/scenes/arscott-v1-placements.json; default build refused because another build owns .next. Leave its lock/process intact and use the coordinator’s final build result.
- [ ] Authenticated preview tests for all five Stage 1 features, including credit readback.
- [ ] Representative real-data quality/latency/cost comparison and acceptable per-feature cost limits.
- [ ] Verify deployment environment overrides, deploy Stage 1 and read back actual model usage.
- [ ] Stage 2 image/recap evaluation, followed by Stage 3 copy evaluation.

Keep source/unit, synthetic provider, authenticated browser and production evidence separate. A synthetic provider test does not validate application billing or authenticated database behaviour.

## Rollback

Set OPENAI_COACH_MODEL to the recorded previous deployment value (gpt-4.1-mini if using the original defaults) and redeploy. No code or database rollback is required. The legacy request uses its original token cap and omits Astra reasoning parameters. Keep OPENAI_SCORECARD_MODEL, OPENAI_WEEKLY_RECAP_MODEL, OPENAI_FAST_MODEL and OPENAI_PREMIUM_MODEL explicit when rolling out to prevent shared fallback values moving later groups accidentally.

## Sources

- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/reference/cli/resources/responses/methods/create

## Verification evidence (14 September 2026)

| Model        | Synthetic requests | Mean duration | Total input tokens | Total output tokens |
| ------------ | -----------------: | ------------: | -----------------: | ------------------: |
| gpt-4.1-mini |                  5 |       3.185 s |               1163 |                 646 |
| gpt-6-astra  |                  5 |       6.979 s |               1153 |                 808 |

Astra returned all required schema fields and grounded text in each sample. Outputs were manually inspected: Astra consistently used low confidence and distinguished a right miss from a diagnosed swing fault. This small synthetic sample does not establish real-user quality or a latency SLA. The five Astra requests cost approximately $0.052 at documented standard uncached text rates ($10/M input, $50/M output); recorded cache counts were zero. The live suite does not mutate real users, credit balances or database caches. Raw synthetic output is available at /tmp/forekinghell-astra-eval.json on this machine.

Repeat live smoke only intentionally (paid API calls): `ASTRA_LIVE_EVAL=1 npx vitest run src/lib/ai/astra-live.test.ts`. Default test runs skip it. The fixture uses synthetic prompts and production schemas/shared client; actual route prompts and authenticated behaviour still require preview checks.

## Handoff

Owned files: .env.example, src/lib/ai/client.ts, src/lib/ai/features.ts, src/lib/ai/client.test.ts, src/lib/ai/features.test.ts, src/lib/ai/astra-live.test.ts, docs/ASTRA_MIGRATION.md.

No secrets, live environment settings, database schema or production deployment changed. No commit/push performed. Git inspection was blocked by the Xcode licence. Cross-task status delivery was rejected by automatic approval review; this file is the local handoff record.

# Session confidence and Driver development

The shared Driver Development card explains the latest comparable Driver practice day on Today, Dashboard, Progress, Bag, Speed, Practice and Coach (including the companion Coach summary). Its inputs, comparisons and wording are deterministic. Both AI context builders receive the same structured result.

## Evidence contract

- Session alignment: correctly aligned, possibly misaligned, misaligned or unknown. Unknown is not an accusation of bad data.
- Possible/confirmed misalignment suppresses target-relative side, launch direction, path and face in analytical projections. The raw shot inspection keeps the original values.
- A shot can be marked `questionable`, `confirmed` or `unreviewed` for direction independently of its full-shot review status. Confirming a shot cannot override session misalignment.
- Carry, speed, launch and strike retain their existing eligibility checks. A directional review does not delete or globally exclude a shot.
- The action authenticates the caller, locks the owned session, validates shot membership, preserves other decisions, rebuilds affected stock snapshots, refreshes saved practice evidence and invalidates derived pages. A secondary practice-refresh failure is reported separately from a saved confidence change.
- SQL projections use explicit outer `fkh_shots` identifiers. Drizzle otherwise removes qualifiers for single-table selects, which can accidentally bind `id` and `user_id` to the inner session.

## Flight review

An endpoint present in the source is labelled **source-reported**, not **measured landing position**. An export alone does not establish the launch monitor's measurement method.

The review cue compares reported SIDE with the straight-line offset implied by carry and initial direction. A residual of at least `max(30 yd, 15% of carry)`, with incomplete spin-rate/axis evidence, prompts review. This is an explainable screening threshold, not a physical impossibility test, calibrated confidence percentage or flight simulator. Missing spin alone does not remove SIDE from analytics. A user can question direction alone to omit it.

A face value matching the existing 80/20 launch-direction/path approximation is labelled modelled when no numeric source face field is available. A raw face field takes precedence. Face-to-path inherits that provenance. The shot-detail arc is explicitly illustrative.

The reported 6 September 2026 example was verified in the database: carry 183.8 yd, SIDE -41.2 yd, ball speed 135.2 mph, club speed 90.7 mph, direction -0.2°, path +4.4°, no raw Face, no spin rate/axis. The stored -1.3° face is modelled. The raw smash value is 1.49.

## Driver comparisons

- Latest practice day in Europe/London, same Driver club ID, source and play context.
- Baseline: up to 50 preceding eligible comparable Driver shots, never future shots or course rounds.
- Current and baseline metrics need at least five readings for a change verdict. Launch changes are descriptive, not an optimisation verdict.
- Carry change threshold: 2 yd; club speed: 0.5 mph; ball speed: 1 mph; smash: 0.02; absolute offline: 2 yd. These are product thresholds, not statistical significance claims.
- Stock/course values reuse the existing bag calculation. Good carry and capability are the day's 75th and 90th percentiles, requiring at least ten carry readings.
- The 200+ count uses the actual eligible carry denominator. The displayed repeatability target is 70%; it does not auto-award a milestone.
- The project goal and historical carry evidence come directly from the existing Speed Development summary. This preserves an already-achieved 220 milestone and its next target. Today's best is labelled separately. The existing Speed system retains its historical PB verification, ladder and linked transfer logic. A session peak is not promoted to a historical PB or successful transfer.
- Evidence labels describe coverage and review state; they are not calibrated probabilities. Increased carry and ball speed are described as consistent with a speed contribution, without asserting a causal allocation or prescribing a hosel change.

## Verification

Migration: `drizzle/0059_session_data_confidence.sql` adds only session JSON metadata, retaining existing ownership/RLS.

Unit tests cover raw retention, alignment masking, single-shot reversal, source/modelled face, zero spin axis, comparison populations, exact repeatability, stock/capability separation, SQL qualification and action ownership.

The live verification script uses a transaction and independently verifies rollback:

```sh
node --conditions=react-server --import tsx scripts/verify-direction-confidence.ts <shot-uuid>
```

It temporarily tests both alignment states and per-shot question/confirmation. Raw source, carry and speed must remain unchanged. No review decision is committed by this script.

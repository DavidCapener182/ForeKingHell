# Training Over Time Graph Diagnostic

Generated on 2026-06-22 for the current local ForeKingHell implementation.

Update note: this diagnostic was created while investigating the old capped `0-100` Form model. The implementation has since been changed so Performance Form is an indexed baseline score where `100` is personal baseline, values can rise above `100`, and the main chart uses Fitness / Conditioning as the green line instead of Readiness.

This document explains exactly what feeds the `/stats/training-over-time?range=4w` graph, which data points are plotted, how each line is calculated, and what the graph is currently intended to do.

## Current Concern

The graph is meant to answer:

- Am I building golf workload safely?
- Is short-term load high or low?
- Is my golf form improving over time?

The current implementation still needs product review because **Form is now a capped 0-100 performance score and it is saturating at 100 for several points**. That means the blue line may still be poor at showing meaningful improvement once the score is already capped.

## Files Involved

- Page route: `src/app/stats/training-over-time/page.tsx`
- Data loader: `src/lib/training/trainingData.ts`
- Fitness / fatigue / readiness / form series: `src/lib/training/fitnessFreshness.ts`
- Session form comparison logic: `src/lib/training/sessionForm.ts`
- Status labels: `src/lib/training/trainingStatus.ts`
- Main chart: `src/components/training/TrainingOverTimeChart.tsx`
- Load bars: `src/components/training/TrainingLoadBars.tsx`
- Summary cards: `src/components/training/TrainingSummaryCards.tsx`

## Database Sources

The graph uses:

- `fkh_golf_training_sessions`
- `fkh_golf_training_daily_load`
- `fkh_sessions`
- `fkh_shots`
- `fkh_speed_training_sessions`

The training table/view names come from Drizzle schema:

- `golfTrainingSessions`
- `golfTrainingDailyLoad`
- `sessions`
- `shots`
- `speedTrainingSessions`

The visible range is 4 weeks:

- `today`: `2026-06-22`
- `rangeDays`: `28`
- visible chart start: `2026-05-26`
- hidden warm-up start: `2026-02-25`

The warm-up period is important. Fitness, fatigue and form are calculated from `2026-02-25`, then only the final 28 days are shown.

## Query Shape

The page calls:

```ts
getTrainingOverTimeData(userId, "4w");
```

That function fetches:

1. Daily loads from `fkh_golf_training_daily_load` where `date >= warmupStartDate`.
2. Recent sessions from `fkh_golf_training_sessions`, latest 8 rows.
3. Session marker rows from `fkh_golf_training_sessions` where `session_date >= chartStartDate`.
4. Form session rows from `fkh_golf_training_sessions` where `session_date >= warmupStartDate`.
5. Existing linked rows, used to hide suggestions already linked.
6. Suggestions from rounds, practice sessions and speed sessions.

Only these fields are plotted in the main graph:

```ts
{
  (date, load, fitness, fatigue, readiness, form);
}
```

The chart renders:

- Green line: `readiness`
- Orange line: `fatigue`, labelled Acute load
- Blue line: `form`
- Vertical dotted lines: days with one or more training sessions

## Current Formulas

### Fitness

Fitness is a 42-day exponential moving average of daily load.

```ts
fitnessAlpha = 2 / (42 + 1);
fitnessToday = fitnessYesterday + fitnessAlpha * (dailyLoad - fitnessYesterday);
```

With current constants:

```txt
fitnessAlpha = 0.046511627906976744
```

### Fatigue / Acute Load

Fatigue is a 7-day exponential moving average of daily load.

```ts
fatigueAlpha = 2 / (7 + 1);
fatigueToday = fatigueYesterday + fatigueAlpha * (dailyLoad - fatigueYesterday);
```

With current constants:

```txt
fatigueAlpha = 0.25
```

### Readiness

Readiness is derived from fatigue.

```ts
readiness = clamp(100 - fatigue * 0.16, 55, 100);
```

This means:

- Low fatigue produces readiness near 100.
- High fatigue pushes readiness down.
- Readiness can never drop below 55.

### Form

Current Form is a 0-100 performance score.

Relevant constants:

```ts
DEFAULT_FORM_SCORE = 50;
FORM_SIGNAL_MULTIPLIER = 1.5;
FORM_FITNESS_SUPPORT_WEIGHT = 0.05;
QUIET_DAYS_BEFORE_FORM_DECAY = 10;
DAILY_FORM_DECAY = 0.35;
MIN_FORM_SCORE = 0;
MAX_FORM_SCORE = 100;
```

Initial form baseline:

```ts
form = 50 + clamp(fitness * 0.05, 0, 15);
```

Performance comparisons create daily form adjustments. When there is a form adjustment:

```ts
form = clamp(form + adjustment * 1.5, 0, 100);
```

Quiet-day decay:

```ts
if no load and no form adjustment:
  quietDays += 1

if quietDays > 10:
  form = form - 0.35
```

Important: because form is capped at 100, strong positive historical adjustments can flatten the blue line at the top.

## Session Form Comparison Rules

Sessions are converted into comparable snapshots:

- Rounds -> `kind: "round"`
- Launch monitor / imported shot sessions -> `kind: "shots"`
- Speed sessions -> `kind: "speed"`
- Manual fallback -> `kind: "load"`

Same-day sessions of the same kind are grouped before comparison.

Example:

- Three Rapsodo blocks on `2026-06-22` become one `shots` practice-day snapshot.
- That grouped snapshot is compared with the previous `shots` day, not with another same-day chunk.

### Round Comparison

Rounds use `scoreToParPer18`.

```ts
delta = previous.scoreToParPer18 - latest.scoreToParPer18;
adjustment = clamp(delta * 1.5, -8, 8);
```

Lower score-to-par is better.

### Shot / Launch Monitor Comparison

Shot sessions compare:

- average offline yards, lower is better
- playable rate, higher is better
- carry average, higher gets upside credit only
- ball speed average, higher gets upside credit only
- carry standard deviation, lower is better

Current thresholds:

```txt
averageOfflineYd: 1.5 yd lower = improved, 1.5 yd higher = worse
playableRate: 5 percentage points higher = improved, 5 points lower = worse
carryAverageYd: 3 yd higher = improved, drops are not penalised
ballSpeedAverageMph: 2 mph higher = improved, drops are not penalised
carryStdDevYd: 4 yd lower = improved, 4 yd higher = worse
```

Raw score is multiplied:

```ts
adjustment = clamp(score * 1.3, -8, 8);
```

### Speed Comparison

Speed sessions compare:

- max speed, higher is better
- average speed, higher is better

```ts
adjustment = clamp(score * 1.5, -6, 6);
```

## What The Graph Should Do

Intended behaviour:

- Fitness should rise slowly when load has been consistent.
- Fitness should drift down slowly after quiet periods.
- Acute load should rise quickly after a session and decay quickly after rest.
- Readiness should fall when acute load is high and rise when acute load falls.
- Form should show performance quality over time.
- Form should improve after better comparable practice or rounds.
- Form should not drop just because the golfer trained.
- Form should not drop after a good session.
- Form should not decay quickly during a short quiet spell.
- Form should only fade gently after a longer quiet period.

Potential issue to diagnose:

- Current Form reaches `100` on `2026-05-26`, `2026-06-01` and `2026-06-22`.
- Once capped at `100`, it cannot show further improvement.
- The visible line may still feel wrong because the scale compresses useful changes near the top.

## Summary Values Used By The Page

```txt
User id used for this diagnostic: c0c02d1e-605a-47c5-a023-83a1c0d18195
Today: 2026-06-22
Range: 4w
Visible chart start: 2026-05-26
Warm-up start: 2026-02-25
Average visible load: 93.03571428571429
Latest fitness: 100.336968220985
Latest acute load / fatigue: 118.26422104359162
Latest readiness: 81.07772463302534
Latest form: 100
Previous week form: 94
```

## Non-Zero Daily Loads Used In Warm-Up And Visible Period

These rows come from `fkh_golf_training_daily_load` from `2026-02-25` onward. Zero-load days are also included in the calculation, but only non-zero days are listed here.

| Date       | Load | Sessions | Swings | Holes |
| ---------- | ---: | -------: | -----: | ----: |
| 2026-04-24 |  276 |        2 |     69 |     0 |
| 2026-04-27 |  328 |        3 |     82 |     0 |
| 2026-05-01 |  516 |        6 |    129 |     0 |
| 2026-05-03 |  396 |        2 |     99 |     0 |
| 2026-05-04 |  600 |        2 |      0 |    18 |
| 2026-05-07 |  760 |        5 |     40 |    18 |
| 2026-05-08 |  684 |        4 |     21 |    18 |
| 2026-05-10 |   32 |        1 |      8 |     0 |
| 2026-05-11 |  704 |        3 |     26 |    18 |
| 2026-05-13 | 1500 |        3 |      0 |    45 |
| 2026-05-14 |  445 |        1 |     89 |     0 |
| 2026-05-16 |  292 |        2 |     73 |     0 |
| 2026-05-18 |  616 |        3 |     79 |     9 |
| 2026-05-26 |  524 |        3 |     56 |     9 |
| 2026-05-30 |  440 |        1 |     88 |     0 |
| 2026-06-01 |  525 |        1 |    105 |     0 |
| 2026-06-06 |  532 |        2 |     58 |     9 |
| 2026-06-07 |  120 |        1 |     15 |     0 |
| 2026-06-22 |  464 |        4 |     41 |     9 |

## Visible Source Sessions

These are the `fkh_golf_training_sessions` rows inside the visible 4W range.

| Date       | Type           | Title                                     | Load | RPE | Swings | Holes | Source ID                            |
| ---------- | -------------- | ----------------------------------------- | ---: | --: | -----: | ----: | ------------------------------------ |
| 2026-05-26 | launch_monitor | Rapsodo practice                          |  184 |   4 |     46 |       | 39ee1dea-4027-4368-8863-48d3a2bf2eac |
| 2026-05-26 | round          | TPC Sawgrass - THE PLAYERS Stadium Course |  300 |   5 |        |     9 | 5f0f7d6a-9a9f-40d1-a41a-19768227c7ea |
| 2026-05-26 | launch_monitor | Rapsodo practice                          |   40 |   4 |     10 |       | 48b34e77-338d-4864-8e4b-610317aef33a |
| 2026-05-30 | launch_monitor | Rapsodo practice                          |  440 |   5 |     88 |       | f8f62551-7ecb-4e6e-a017-9ce054055432 |
| 2026-06-01 | launch_monitor | Rapsodo practice                          |  525 |   5 |    105 |       | 8deca165-6114-4204-8fc2-5044d18a3061 |
| 2026-06-06 | round          | Aintree Golf Centre                       |  300 |   5 |        |     9 | 60389609-595a-4a6b-8d8f-d2cd40242025 |
| 2026-06-06 | launch_monitor | Rapsodo practice                          |  232 |   4 |     58 |       | 31752020-ba68-4e20-8606-7e603efb03b9 |
| 2026-06-07 | manual         | R-Speed                                   |  120 |   8 |     15 |       | 1fa4a04f-181a-4a3c-9ffd-e6103107da1f |
| 2026-06-22 | launch_monitor | Rapsodo practice                          |  104 |   4 |     26 |       | fea572e5-b10c-4cf0-8cb2-b8f1b98d5015 |
| 2026-06-22 | launch_monitor | Rapsodo practice                          |   36 |   4 |      9 |       | 6661f620-2af4-4560-9e32-313a2e49c3e9 |
| 2026-06-22 | launch_monitor | Rapsodo practice                          |   24 |   4 |      6 |       | e92b9716-a371-47e2-be03-6a733e47e730 |
| 2026-06-22 | round          | Aintree Golf Centre                       |  300 |   5 |        |     9 | 7067b431-3488-4589-be2a-75bf5a6e5d24 |

## Visible Grouped Form Snapshots

These grouped snapshots are what feed session quality comparisons.

| Date       | Kind  | Entries | Sample | Load | RPE | Score/18 | Avg Offline | Playable % | Carry Avg | Ball Speed | Carry StdDev | Max Speed | Avg Speed |
| ---------- | ----- | ------: | -----: | ---: | --: | -------: | ----------: | ---------: | --------: | ---------: | -----------: | --------: | --------: |
| 2026-05-26 | round |       1 |      9 |  300 |   5 |        2 |             |            |           |            |              |           |           |
| 2026-05-26 | shots |       2 |     56 |  224 |   4 |          |        13.5 |       96.4 |       162 |      113.5 |         28.7 |           |           |
| 2026-05-30 | shots |       1 |     88 |  440 |   5 |          |        13.5 |       94.3 |       134 |       99.5 |         37.5 |           |           |
| 2026-06-01 | shots |       1 |    105 |  525 |   5 |          |        11.9 |       96.2 |     141.2 |      103.6 |           38 |           |           |
| 2026-06-06 | round |       1 |      9 |  300 |   5 |       12 |             |            |           |            |              |           |           |
| 2026-06-06 | shots |       1 |     58 |  232 |   4 |          |         9.9 |        100 |     123.5 |       95.4 |         40.7 |           |           |
| 2026-06-07 | speed |       1 |     15 |  120 |   8 |          |             |            |           |            |              |        87 |      81.2 |
| 2026-06-22 | round |       1 |      9 |  300 |   5 |       10 |             |            |           |            |              |           |           |
| 2026-06-22 | shots |       3 |     41 |  164 |   4 |          |        11.2 |        100 |       158 |      110.2 |         38.6 |           |           |

## Visible Form Adjustments

These are the comparison events that move the blue Form line.

| Date       | Kind  | Direction | Adjustment | Reason                             | Compared With    |
| ---------- | ----- | --------- | ---------: | ---------------------------------- | ---------------- |
| 2026-05-26 | round | improving |         +3 | 2 shots better per 18              | 2026-05-18 round |
| 2026-05-26 | shots | steady    |         -1 | wider offline and stronger carry   | 2026-05-18 shots |
| 2026-05-30 | shots | steady    |         -1 | carry less consistent              | 2026-05-26 shots |
| 2026-06-01 | shots | improving |         +7 | tighter offline and stronger carry | 2026-05-30 shots |
| 2026-06-06 | round | dipping   |         -8 | 10 shots worse per 18              | 2026-05-26 round |
| 2026-06-06 | shots | improving |         +4 | tighter offline                    | 2026-06-01 shots |
| 2026-06-22 | round | improving |         +3 | 2 shots better per 18              | 2026-06-06 round |
| 2026-06-22 | shots | improving |         +3 | stronger carry and ball speed up   | 2026-06-06 shots |

Important detail:

- `2026-06-06` has a net form adjustment of `-4` because the round scored much worse (`-8`) and the practice was better (`+4`).
- `2026-06-22` has a net form adjustment of `+6` because the round improved (`+3`) and the Rapsodo practice improved (`+3`).

## Visible Plotted Series

These are the exact data points passed to the Recharts line chart for the visible 4W range.

| Date       | Load | Fitness | Acute Load | Readiness | Form | Form Adj | Quiet Days |
| ---------- | ---: | ------: | ---------: | --------: | ---: | -------: | ---------: |
| 2026-05-26 |  524 |     176 |      167.7 |      73.2 |  100 |        2 |          0 |
| 2026-05-27 |    0 |   167.8 |      125.8 |      79.9 |  100 |        0 |          1 |
| 2026-05-28 |    0 |     160 |       94.3 |      84.9 |  100 |        0 |          2 |
| 2026-05-29 |    0 |   152.6 |       70.7 |      88.7 |  100 |        0 |          3 |
| 2026-05-30 |  440 |     166 |      163.1 |      73.9 | 98.5 |       -1 |          0 |
| 2026-05-31 |    0 |   158.2 |      122.3 |      80.4 | 98.5 |        0 |          1 |
| 2026-06-01 |  525 |   175.3 |        223 |      64.3 |  100 |        7 |          0 |
| 2026-06-02 |    0 |   167.1 |      167.2 |      73.2 |  100 |        0 |          1 |
| 2026-06-03 |    0 |   159.4 |      125.4 |      79.9 |  100 |        0 |          2 |
| 2026-06-04 |    0 |     152 |       94.1 |      84.9 |  100 |        0 |          3 |
| 2026-06-05 |    0 |   144.9 |       70.5 |      88.7 |  100 |        0 |          4 |
| 2026-06-06 |  532 |   162.9 |      185.9 |      70.3 |   94 |       -4 |          0 |
| 2026-06-07 |  120 |   160.9 |      169.4 |      72.9 |   94 |        0 |          0 |
| 2026-06-08 |    0 |   153.4 |      127.1 |      79.7 |   94 |        0 |          1 |
| 2026-06-09 |    0 |   146.3 |       95.3 |      84.8 |   94 |        0 |          2 |
| 2026-06-10 |    0 |   139.5 |       71.5 |      88.6 |   94 |        0 |          3 |
| 2026-06-11 |    0 |     133 |       53.6 |      91.4 |   94 |        0 |          4 |
| 2026-06-12 |    0 |   126.8 |       40.2 |      93.6 |   94 |        0 |          5 |
| 2026-06-13 |    0 |   120.9 |       30.2 |      95.2 |   94 |        0 |          6 |
| 2026-06-14 |    0 |   115.3 |       22.6 |      96.4 |   94 |        0 |          7 |
| 2026-06-15 |    0 |   109.9 |         17 |      97.3 |   94 |        0 |          8 |
| 2026-06-16 |    0 |   104.8 |       12.7 |        98 |   94 |        0 |          9 |
| 2026-06-17 |    0 |    99.9 |        9.5 |      98.5 |   94 |        0 |         10 |
| 2026-06-18 |    0 |    95.3 |        7.2 |      98.9 | 93.7 |        0 |         11 |
| 2026-06-19 |    0 |    90.9 |        5.4 |      99.1 | 93.3 |        0 |         12 |
| 2026-06-20 |    0 |    86.6 |          4 |      99.4 |   93 |        0 |         13 |
| 2026-06-21 |    0 |    82.6 |          3 |      99.5 | 92.6 |        0 |         14 |
| 2026-06-22 |  464 |   100.3 |      118.3 |      81.1 |  100 |        6 |          0 |

## Diagnosis Notes For Review

These are not fixes, just observations to help diagnose.

1. Form is capped at `100`, and the visible range starts at `100`.
2. Because of the cap, the graph cannot show how much better the strong days are.
3. The `2026-06-06` net form drop is caused by a very negative round comparison:
   - `2026-05-26` round: `+2` score-to-par per 18
   - `2026-06-06` round: `+12` score-to-par per 18
   - Difference: `10 shots worse per 18`
   - Round adjustment: `-8`
   - Shot practice adjustment that day: `+4`
   - Net: `-4`
4. The `2026-06-22` net form improvement is:
   - Round adjustment: `+3`
   - Shot adjustment: `+3`
   - Net: `+6`
5. The blue line may still feel wrong because it is not a direct scoring-average trend, handicap trend, strokes-gained trend, or club-speed trend. It is a synthetic performance score built from mixed evidence.
6. The strongest recommendation for diagnosis is to decide what Form should mean:
   - If Form means "recent performance quality", it should probably be calculated from scoring, strokes gained, strike quality, dispersion, speed and consistency against baselines.
   - If Form means "training freshness", it should not be called Form because that conflicts with golfer expectations.
   - If Form means "getting better over time", it should probably be slower-moving, uncapped or normalized around a baseline with confidence bands.

## Suggested Questions For ChatGPT

Paste this file into ChatGPT and ask:

1. "Is this Form model mathematically consistent with the goal of showing whether a golfer is getting better?"
2. "Should Form be separated into Performance Form and Readiness?"
3. "How should mixed evidence from rounds, launch monitor sessions and speed work be combined?"
4. "How should the graph behave when form is already capped at 100?"
5. "Should a bad 9-hole round be allowed to overpower a good practice session on the same day?"

# Real-round training load

Completed real 9/18-hole scorecards automatically create one linked training entry. A database trigger covers manual save, imports and later corrections. Incomplete/simulator cards do not create these entries. Reopening/deleting a source removes its automatically managed load; changing its date/holes updates the same entry. Previously logged entries remain unchanged.

## Workload model

Round load = duration in minutes × overall session effort (1–10), in arbitrary app units. Scoring strokes, putts, penalties and birdies do not determine physical load. Movement (carried, trolley, buggy) is context: reported effort already reflects it, so there is no additional walking multiplier.

Missing duration uses 240 minutes per 18 holes, prorated to 120 per nine. Missing effort uses 3/10. These are provisional product defaults, not validated golfer-specific estimates. Both missing fields remain visibly labelled estimated; missing movement stays unknown. Saving effort replaces the existing entry, not another load.

The established session-RPE method motivates duration × effort: https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2017.00612/full . Golf-specific monitoring also supports retaining time as its own source metric: https://pubmed.ncbi.nlm.nih.gov/29431589/ . Walking and cart use can differ in physiological demands: https://pmc.ncbi.nlm.nih.gov/articles/PMC12685474/ . None validates our default effort/duration or a universal conversion between existing swing-based practice units and round units. Existing practice/legacy load calculations remain unchanged; this is app workload guidance, not calories or clinical readiness.

## Recorded example

11 September 2026, Ellesmere Port: screenshot duration 3h33m = 213 minutes; user reports walking with a trolley and effort 7/10. Load = 1,491. No estimated effort or walking multiplier. Score 83 stays performance evidence separately.

## Validation

Unit tests cover arithmetic, missing-data labels and invalid inputs. Transactional database tests cover insert, repeat updates, score independence, source corrections, delete/reopen, simulator exclusion and protection of pre-existing manual training rows. New metadata is additive and existing ownership/RLS policies continue to apply.

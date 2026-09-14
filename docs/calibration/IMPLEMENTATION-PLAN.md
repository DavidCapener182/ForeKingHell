# Launch monitor calibration and data confidence

## Current delivery and gate

- Complete: read-only source retrieval, metric-only fixture with source hashes, candidate audit, sensitivity analysis and five tests.
- Pending: confirmed individual pairs and session conditions. Today's partial recording and unverified screenshot sequence cannot yet produce a calibration bias.
- Website implemented: `/equipment/launch-monitors/calibration`, linked from Settings and Equipment, with authenticated session/club selectors, raw metric medians and counts, metric caveats, carry interpretation states, exploratory shot candidates and saved session conditions. Existing session JSON stores conditions without altering alignment or shot data. The phone route is enabled and inventoried.
- David's partial Rapsodo recording was saved through the authenticated page and verified after reload. No carry correction or bag change was applied.
- Not implemented: confirmed-pair review/acceptance, profile application, standard carry, fusion or drift analysis. The page explicitly shows these calibration outputs as pending. Deployment is coordinated with the task handling the combined release.

Start the next work at the pairing evidence gate in `2026-09-14-findings.md`. Do not promote candidate edges into matches or manufacture a numeric confidence score.

## Phase 1 — source and pairing foundation

1. Extend existing provider/import contracts and immutable `rawCsvText` / `sourceRawJson`; retain provider spelling compatibility and add specific device identity separately. Allow unknown device and unknown environment for legacy imports. Add session and per-shot provenance for units, manufacturer-reported metric, measurement method, normalisation, ball conversion, ball type, firmware and observed timestamp versus import timestamp.
2. Keep raw manufacturer values and source bytes immutable. Store interpretations separately with model version, input identity/hash, conditions, metric eligibility and reason. Absence of calibration must remain explicit; a raw fallback cannot be labelled standardised carry.
3. Extend the existing `SessionDataConfidence` and metric evidence system. Preserve direction-only alignment exclusions. Document measurement claims against current manufacturer sources; allow unknown or modelled metrics. Do not assign fixed percentages or unvalidated provider weights.
4. Add owned-session pairing and a reviewable partial one-to-one matcher. Confirm same physical shots, chronological order and group coverage; support battery failure, gaps, duplicate imports, repeated screenshots and competing matches. Use measured features for matching and keep the calibrated target held out. Require reviewed anchors when timestamps/order cannot establish identity.
5. Add Settings → Equipment → Launch Monitors → Calibration through the active equipment/settings implementation. Show raw versus interpreted metrics, conditions, unmatched/rejected shots and evidence basis. Maintain full available content width. Scope every read/write by authenticated user and validate both sides of a pairing on the server. No production schema work until local migration and ownership checks are complete.

Acceptance: legacy imports retain raw values and original eligibility; TrackMan/Rapsodo/Toptracer/manual provenance survives import/export; duplicate or cross-user pair submissions fail; unmatched shots remain independent. Browser verification covers the actual authenticated pairing/review flow on desktop and mobile. Today's fixture must remain ineligible until reviewed labels are supplied.

## Phase 2 — profiles and standard carry

1. Create versioned club/equipment-specific, metric-specific profiles with condition scope. Calculate median signed difference, median absolute pair difference, residual error after calibration, empirical paired-difference range, sample count and explicitly labelled outliers. Define each quantity unambiguously: a shot prediction range is different from uncertainty in the bias estimate.
2. Validate the minimum evidence policy, outlier treatment and holdout performance. Small samples stay provisional; one shot cannot activate a profile. Avoid carry-derived match selection and automatic outlier removal that artificially improves agreement. Reference-device settings are part of the comparison, not ground truth.
3. Apply eligible profiles without overwriting source values. Separate raw carry, reference-condition calibrated carry, standard-condition stock carry and course plays-like estimates. Do not claim environmental standardisation from an offset alone.
4. Update the active bag estimator with clean-shot counts, distinct-source counts and appropriately labelled ranges. Alignment review/detection changes only directional eligibility, with historical club/setup comparisons and user review.

Acceptance: unmatched conditions do not inherit corrections; invalid/insufficient profiles leave interpretations unavailable; recalculation is reproducible by version; bag evidence cannot double-count the same physical shot observed by two devices.

## Phase 3 — fusion, validation and Accuracy Lab

1. Fuse sources only after validating weights and uncertainty. Paired readings share one physical-shot identity; clustered/session-correlated evidence must not inflate sample size or precision. Course GPS total distance does not automatically establish carry.
2. Validate estimates on independent course/reference evidence with documented limitations and conditions.
3. Detect drift across comparable sessions, retaining firmware/ball/setup provenance and prior profile versions. Require sufficient evidence before replacing a profile.
4. Build Accuracy Lab from real profiles and findings: reference device, calibration scope/date, per-metric status, drift and plain-language coaching eligibility. Show pending evidence explicitly.

Acceptance: holdout performance and uncertainty coverage are documented; no fixed illustrative numbers reach production; recomputation is repeatable and reversible. Verify authenticated screens and deployed readback before claiming live completion.

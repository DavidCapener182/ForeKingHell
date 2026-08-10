# Mobile Course Twin compact-control design QA

## Comparison target

- Source visual truth: `/tmp/codex-remote-attachments/019fe949-094e-7a11-ac1d-652a23567977/BA89CF6F-F2A3-498C-81AE-74C0FB36E7CC/1-Pasted-Image-1.jpg`
- Browser-rendered implementation: `output/playwright/course-twin-mobile/course-twin-390x844-compact-controls-final.png`
- Side-by-side evidence: `output/playwright/course-twin-mobile/course-twin-control-comparison.png`
- Additional responsive evidence:
  - `output/playwright/course-twin-mobile/course-twin-320x568-compact-controls-final.png`
  - `output/playwright/course-twin-mobile/course-twin-844x390-compact-controls-final.png`
- Route: `/play/4de11156-16fd-4a36-84e0-fadda53456b0`
- State: authenticated Aintree Course Twin, Play mode, pre-shot controls visible. The source is Hole 6 / Shot 2 and the implementation fixture is Hole 1 / Shot 1; these are equivalent interaction states, but dynamic hole and club values intentionally differ.

## Normalization

- Source pixels: 589 x 1280. The supplied image includes surrounding image-viewer bars.
- Implementation pixels: 390 x 844, captured at a 390 x 844 CSS viewport with `deviceScaleFactor: 1` and CSS-pixel screenshot scaling.
- Full-view comparison: source resized proportionally to 844 px high (388 px wide), implementation retained at 390 x 844, then placed side by side without stretching.
- Focused evidence: a separate crop was not needed because the lower control regions remain readable at original implementation density in the side-by-side image. Exact obstruction and control geometry were additionally read from the rendered DOM.

## Findings

- No actionable P0, P1 or P2 finding remains.
- Typography: the compact controls retain the existing Course Twin system typography, hierarchy and contrast. Hole, distance, aim and evidence provenance remain legible without adding another text row.
- Spacing and layout: the source's bottom stack occupied roughly one third of the visible course. The implementation combines club, aim and Play into one 44 px control row. At 390 x 844, the action tray plus mode dock is 155 px high (18.4% of the viewport), leaving 81.6% unobscured. At 320 x 568 it is 155 px (27.3%). At 844 x 390 the two trays sit side by side and the union is 103 px (26.4%).
- Colors and tokens: the existing dark translucent HUD, white labels and chartreuse selected/primary state are preserved. No new palette or decorative surface was introduced.
- Image quality: the live WebGL course, terrain, foliage and shot line are unchanged and remain full-resolution behind the smaller controls. No placeholder or replacement imagery was added.
- Copy and content: `Modelled` remains visibly attached to the shot state. The screen-reader description still states that the outcome is modelled from recent measured shots and is not guaranteed. Replay and Live retain their measured/reconstructed wording.
- Icons and controls: existing iconography is retained. Exit, course, details, hole navigation, mode buttons, club select, aim range and Play action remain operable. All visible compact controls are at least 44 x 44 CSS px.
- Responsiveness: browser checks passed at 320 x 568, 390 x 844, 430 x 932 and 844 x 390. There was no document, tray or dock overflow. The 1024 x 768 desktop presentation remains outside the mobile override.
- Console: the development browser emitted only rate-limited `429` responses from the report-only CSP endpoint plus known development warnings. No hydration, missing-asset, WebGL or application exception was observed.

## Comparison history

1. Initial source finding — P1: the two-row shot panel, separate minus/plus controls and mode dock obscured too much of the course and the ball/target context.
   - Fix: moved shot/stroke/distance/aim provenance into the 44 px hole strip; reduced the default Play controls to a single club/select-range/action row; kept the mode dock at 44 px; placed action and mode trays side by side in short landscape viewports.
   - Post-fix evidence: `course-twin-control-comparison.png`; rendered stack measurements of 155 px portrait and 103 px landscape.
2. Refinement finding — P3: the selected Driver label truncated at 320 px.
   - Fix: used the conventional `Drv` abbreviation while preserving the visible `yd` unit, added an explicit accessible label for modelled carry, and rebalanced the grid toward the club selector while keeping the aim range and Play action at least 44 px wide.
   - Post-fix evidence: `course-twin-320x568-compact-controls-final.png` shows `Drv · 193 yd` without truncation.
3. Final comparison: no actionable P0/P1/P2 mismatch remains. The deliberate difference from the source is the requested reduction in control height, not fidelity drift.

## Primary interactions verified

- Start/resume Play mode and expose the compact shot tray.
- Change mobile viewport and rotate to landscape without scrolling or clipping.
- Open and close shot details with focus restoration.
- Enter Explore and expose touch movement controls.
- Use the Exit Course Twin link.
- Restore the desktop Course Twin layout at 1024 px.

## Implementation checklist

- [x] Course remains the dominant mobile surface.
- [x] Default Play controls use one compact row.
- [x] Modelled provenance remains visible and semantic.
- [x] Touch targets remain at least 44 px.
- [x] Portrait and landscape obstruction budgets are regression-tested.
- [x] Desktop remains unchanged.

final result: passed

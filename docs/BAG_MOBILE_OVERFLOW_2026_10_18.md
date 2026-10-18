# Bag mobile overflow correction

The populated Bag could hide content beyond the right edge even while the document's scroll width matched the viewport. Its ancestors clipped a desktop distance ladder with a 550 px minimum row inside a 288 px phone content window. Implicit grid tracks, long equipment names and non-wrapping disclosure buttons expanded other panels.

The correction stacks ladder rows on phones, constrains grid tracks to the available content window and wraps full equipment names and control labels. Desktop ladder columns remain available. Target presets respond to their panel width, including the narrow desktop sidebar. The target panel and its nested tracks also shrink below font-dependent minimum content widths, an additional case caught by Linux CI. Focused tabs reveal themselves even when keyboard focus returns to the already selected tab. Tables retain local horizontal scrolling and carousel cards remain individually reachable.

## Regression evidence

`tests/e2e/bag-mobile-overflow.spec.ts` renders the actual Bag page presentation and actual workbench/companion shells with 13 synthetic equipment records and 520 synthetic shots. The AST fixture selects the page's existing presentation and pure calculations; it does not copy or rewrite JSX or classes. Server loaders and writes are outside this browser boundary; action calls throw. The separately server-loaded driver development context panel is omitted. No account data or imported sessions are modified.

The browser matrix covers 320, 375, 390, 430, 768, 1024, 1280 and 1440 px on both surfaces, across Distances, Clubs, Scoring, Fitting, History and Evidence. Assertions check visible content inside the available main window, internal control overflow, expanded supporting evidence, all carousel cards, final table columns and keyboard tab visibility. A second 320 px case asserts and exercises Arial in addition to the platform system font. Phone distance and club detail drawers are opened, checked and closed. The distance drawer intentionally excludes LW touch evidence and retains all 12 full-shot clubs.

The same hard assertions fail against the previous release's Bag page (`FKH_BAG_BASELINE=1`, commit `def1951194bb33806025b9bb9390b5112a61314f`). Screenshots are written under `output/bag-mobile-overflow/`. The populated regression is added to the existing Core Playwright CI command without removing existing tests.

This is synthetic browser verification of actual UI code. It does not claim authenticated production account testing.

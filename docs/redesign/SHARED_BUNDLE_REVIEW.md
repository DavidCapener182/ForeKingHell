# Saved shared bundle analysis

Snapshot: isolated production build 7 September05:00. Not current runtime measurements.

Intersection across Today, Dashboard, Import, Sessions, Bag, Shots, Speed and Progress:
28 chunks, 952.2 KiB uncompressed.

| Chunk                                          |   KiB |
| ---------------------------------------------- | ----: |
| .next/static/chunks/0-4srap-ffvu1.js           | 199.8 |
| .next/static/chunks/2_fg3u1fiyogk.js           | 124.6 |
| .next/static/chunks/1q26tx32xgzw6.js           |  57.9 |
| .next/static/chunks/1u12-\_hu1m-8i.js          |  49.0 |
| .next/static/chunks/301zw9qwn6si5.js           |  46.3 |
| .next/static/chunks/0fnq1prkdzcr8.js           |  36.7 |
| .next/static/chunks/0ur35dn2jeeg0.js           |  31.7 |
| .next/static/chunks/26g4tn5b226u5.js           |  31.2 |
| .next/static/chunks/02q9me1tvza6m.js           |  30.5 |
| .next/static/chunks/1e3sw7nf25v2k.js           |  30.3 |
| .next/static/chunks/2hedruwsqk23\_.js          |  30.2 |
| .next/static/chunks/0x70qouy936d8.js           |  28.5 |
| .next/static/chunks/0xy6c57mx1wwk.js           |  28.1 |
| .next/static/chunks/0-lkq39sbzf0a.js           |  26.8 |
| .next/static/chunks/2-urkx3cuhmdn.js           |  26.2 |
| .next/static/chunks/1poz9bl8er6mw.js           |  25.3 |
| .next/static/chunks/27doe1t5g_uwh.js           |  23.7 |
| .next/static/chunks/0m3lykhuhr0jt.js           |  19.8 |
| .next/static/chunks/0wga38x3k-nlr.js           |  19.3 |
| .next/static/chunks/33t46atd3n2zd.js           |  14.1 |
| .next/static/chunks/3ta22uj55y_w5.js           |  11.2 |
| .next/static/chunks/1-iog9wsr8fne.js           |  11.1 |
| .next/static/chunks/turbopack-42obxuwb8qqwa.js |  10.7 |
| .next/static/chunks/2rzxzmdirfm94.js           |  10.6 |
| .next/static/chunks/1d6x4geykc_8-.js           |   9.1 |
| .next/static/chunks/0jv0-ipujdsks.js           |   8.5 |
| .next/static/chunks/1ih9z_l56apxx.js           |   8.4 |
| .next/static/chunks/2_2z5fwwjxljq.js           |   2.3 |

Shared does not mean removable: framework/runtime and required shell code may be necessary. Identify module ownership before changing import boundaries. Rebuild once after final UI integration and compare the same routes/budgets.

## Largest-chunk inspection

The199.8KiB chunk includes React DOM error/runtime text and Framer markers;124.6KiB includes Next navigation machinery. These are mixed minified chunks, so token presence does not attribute every byte to a package or prove removable overhead. Do not remove motion or shell dependencies based solely on this list. Final build module analysis must establish source ownership and required behavior before splitting imports.

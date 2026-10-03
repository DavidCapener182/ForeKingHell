# Rapsodo beta connector

The R-Cloud connection form on desktop and mobile has a **Use beta R-Cloud** checkbox. Leave it unchecked for the existing connector. To change an existing connection, disconnect and sign in again with the desired checkbox setting. The selected mode is stored with the encrypted provider token, so session lists, previews, club updates and speed imports use the same API for that connection. Older cookies continue to select the standard API.

## Provider contract checked on 3 October 2026

The public bundle loaded by https://beta-rcloud.rapsodo.com was `/assets/index-DXyVti8v.js`. It identifies https://beta.mlm.rapsodo.com as the API and uses:

- `POST auth/login`, returning `token` and `data`; no legacy token switch.
- Bearer authorization for unprefixed tokens.
- `GET session/v2/activities` with optional `startDate` and `endDate`, returning `data` as an array.
- `GET session/v2/activities/:id`, returning `data.session` and `data.shots`.
- `GET club/v2`, returning `clubs`.
- `POST shot/change/club` with `sessionId`, `shotIds` and numeric `newClubId`.

The beta site creates its CSV in the browser. Its measurement definitions specify metres for distance and height, metres per second for speed, degrees for angles and rpm for spin. This connector builds a compatible CSV with explicit yards/feet columns and converts speed to mph for the existing parser. It preserves the original shot JSON in each CSV row. Shot numbering and provider shot references use the same chronological ordering. Standard and beta imports retain the existing provider session identity and import reconciliation flow.

## Validation

Focused Rapsodo suite: 11 files, 87 tests passed. TypeScript and scoped ESLint passed. Desktop and companion forms were checked in browser fixtures, including checkbox selection and retention after a synthetic sign-in failure. Fixtures and adapter tests do not establish a successful live provider connection.

Authenticated beta API retrieval was checked on David's three sessions from 3 October 2026 (42 target-range, 44 range and 7 target-range shots). The actual cloud client and parser processed those captured responses locally: all 93 shots, dates, club labels and shot references passed, with no parser warnings. The provider's downloaded 42-shot CSV matched all club labels and 588 numeric values within display rounding.

Live responses use `date` on the session list and `TARGET RANGE` with a space; the connector normalizes labels and sorts by `date`, with regression coverage. Local evidence is in `output/rapsodo-beta-validation-2026-10-03/`.

The app sign-in journey, a saved database import and provider club writeback remain unverified. The captured-response validation itself did not save sessions.

## Temporary release audit exception

David approved an exception on 3 October 2026 for `GHSA-vfj7-8cjw-p6xm` (unpatched `braces` recursion denial of service), expiring at 00:00 UTC on 10 October 2026. `scripts/dependency-audit.mjs` permits only this high-severity advisory and inherited findings whose entire dependency chain is development-only in the lockfile. Critical findings, new advisories, production dependencies, missing audit results and expiry all fail the release gate. This accepts the existing development-tool risk temporarily; it does not patch the dependency. Replace the exception with a patched upstream release when available.

# GitHub branch protection

The workflow files in this repository define the public-beta production checks. GitHub must also
prevent `main` from being updated until those checks have passed; a workflow by itself does not
block a merge.

Configure a branch ruleset for the repository default branch with these settings:

- target: `main`;
- require a pull request before merging;
- require one approving review from a code owner;
- dismiss stale approvals when new commits are pushed;
- require conversation resolution;
- require branches to be up to date, or enable the merge queue;
- block force pushes and branch deletion;
- do not allow bypass for repository administrators during the public beta;
- require these status checks:
  - `Format, lint, typecheck, test, build` from `.github/workflows/ci.yml`;
  - `Migrations from zero` from `.github/workflows/ci.yml`;
  - `codeql` from `.github/workflows/security.yml`;
  - `secret-scan` from `.github/workflows/security.yml`;
  - `dependency-review` for pull requests from `.github/workflows/security.yml`.

Both CI and security workflows listen for `merge_group`, so the same gates run when GitHub's merge
queue creates its synthetic commit. The workflows use read-only repository permissions except for
CodeQL's narrowly scoped `security-events: write` permission and release SBOM publishing.

After configuring the ruleset, verify it with a draft pull request that intentionally fails one
required check. GitHub must disable merge until the failure is fixed and the required checks rerun.

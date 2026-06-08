# Release & Publishing Guide

This document covers the end-to-end process for versioning, tagging, committing,
and publishing `react-tree-inspector` to npm via GitHub.

---

## Versioning Strategy

This package follows **Semantic Versioning (semver)**:

| Change type | Version bump | Example | When to use |
| ----------- | ------------ | ------- | ----------- |
| Bug fix / patch | `patch` | `0.1.5 → 0.1.6` | Backwards-compatible fixes |
| New feature | `minor` | `0.1.5 → 0.2.0` | New props, exports, or behaviours — no breaking changes |
| Breaking change | `major` | `0.1.5 → 1.0.0` | Removed/renamed API, changed type signatures, dropped React version support |

> **Pre-stable rule:** While the package is `0.x.y`, breaking changes may be
> released as `minor` bumps. Once `1.0.0` is published, strict semver applies.

---

## Branch & Commit Strategy

```
main
 └── release-ready, always passing CI
      ├── feature/my-feature       ← develop here
      └── fix/fix-description      ← hotfixes
```

### Rules

- `main` is the release branch. Only merge PRs that are fully reviewed and passing.
- Use **conventional commit** messages for a clean, parseable history:

  ```
  feat: add targetRef prop to TreeInspector
  fix: guard memoizedState read against null fiber
  chore: bump tsup to 8.1
  docs: update LOCAL_DEVELOPMENT guide
  refactor: extract resolveDisplayName into utils
  test: add smoke test for crawlFiberTree on React 19
  ```

- Never commit directly to `main` for features — always use a PR.
- The `prepublishOnly` script (`typecheck + build`) acts as a local safety gate.

---

## Pre-Release Checklist

Before cutting a release, verify each item:

- [ ] All feature work is merged to `main`
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` completes and `dist/` contains the expected files
- [ ] The `CHANGELOG.md` section for this version is written (see below)
- [ ] `README.md` is up to date (API table, usage examples, compatibility matrix)
- [ ] The version in `package.json` has **not yet been bumped** (let `npm version` do it)

---

## Step-by-Step Release Process

### 1 — Ensure `main` is clean and up to date

```bash
git checkout main
git pull origin main
git status         # must be clean — no uncommitted changes
```

### 2 — Bump the version

Use `npm version` — it updates `package.json`, commits the change, and creates the
git tag in one atomic step.

```bash
# Patch release (bug fix)
npm version patch

# Minor release (new feature, no breaking change)
npm version minor

# Major release (breaking change)
npm version major

# Specific version (e.g. after a pre-release cycle)
npm version 1.0.0
```

This produces:
- A commit: `chore: bump version to X.Y.Z` (or the default `vX.Y.Z` message)
- A git tag: `vX.Y.Z`

> **Custom commit message** (optional):
> ```bash
> npm version patch -m "chore(release): %s"
> ```

### 3 — Update the CHANGELOG

Edit `CHANGELOG.md` before pushing. Follow the **Keep a Changelog** format:

```markdown
## [0.1.6] - 2026-06-07

### Fixed
- Guard `memoizedState` read against null fiber in React 19 (#42)

### Added
- `targetRef` prop on `<TreeInspector>` for scoped subtree inspection
```

Stage and amend the version-bump commit to include the changelog:

```bash
git add CHANGELOG.md
git commit --amend --no-edit
```

> Alternatively, write the CHANGELOG **before** running `npm version` and include
> it in that same commit. Either workflow is fine — pick one and be consistent.

### 4 — Push the commit and tag

```bash
git push origin main          # push the version-bump commit
git push origin --tags        # push the vX.Y.Z tag
```

**Both pushes are required.** The GitHub Actions workflow triggers only on the tag push.

### 5 — Verify the GitHub Actions run

1. Go to **GitHub → Actions → Publish to npm**.
2. Confirm the workflow triggered for the new tag.
3. Check each step — `Verify tag matches package version` will fail if the tag
   and `package.json` version are out of sync (a safety guard).
4. On success, confirm the new version appears on [npmjs.com/package/react-tree-inspector](https://www.npmjs.com/package/react-tree-inspector).

### 6 — Create a GitHub Release (recommended)

After the workflow passes:

1. Go to **GitHub → Releases → Draft a new release**.
2. Choose the existing tag `vX.Y.Z`.
3. Paste the relevant `CHANGELOG.md` section as the release notes.
4. Publish the release.

This surfaces the release in the GitHub UI and notifies watchers.

---

## Hotfix Process

For critical fixes that must ship without waiting for an in-progress feature:

```bash
git checkout main
git pull origin main

# Make the targeted fix directly on main (or via a quick PR)
git add .
git commit -m "fix: guard against null fiberRoot in React 17 roots"

npm version patch
git push origin main
git push origin --tags
```

---

## CHANGELOG Maintenance

Keep a `CHANGELOG.md` at the root of `react-tree-inspector/`.
Recommended structure:

```markdown
# Changelog

All notable changes to react-tree-inspector are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]
<!-- Stage changes here until the next release -->

## [0.1.5] - 2026-06-01
### Fixed
- ...
### Added
- ...
```

Move entries from `[Unreleased]` into a versioned section each time you release.

---

## Tag Naming Convention

| Tag format | Meaning |
| ---------- | ------- |
| `v1.2.3` | Stable release — triggers the publish workflow |
| `v1.2.3-beta.1` | Pre-release — does **not** trigger publish (workflow only matches `v[0-9]*`) |

To publish a pre-release manually:

```bash
npm version 1.2.3-beta.1 --preid=beta
git push origin main
git push origin --tags
# Workflow will NOT trigger — publish manually:
npm publish --tag beta --access public
```

---

## npm Access & Provenance

The workflow supports two publish methods (auto-detected by the presence of the secret):

| Method | When used | Provenance |
| ------ | --------- | ---------- |
| Trusted publishing (`--provenance`) | `NPM_TOKEN` secret **not** set | ✅ Full npm provenance attestation |
| Automation token fallback | `NPM_TOKEN` secret **is** set | Standard token-based auth |

Trusted publishing is preferred — it links the npm package directly to the GitHub
Actions run that produced it, providing a full chain of custody.

---

## Rolling Back a Bad Release

npm does not allow deleting or overwriting a published version. Options:

1. **Deprecate the bad version:**
   ```bash
   npm deprecate react-tree-inspector@0.1.5 "Critical bug — use 0.1.6"
   ```

2. **Publish a patch immediately:**
   Fix the issue, then release `0.1.6` as described above.

3. **`npm unpublish` (72-hour window only):**
   ```bash
   npm unpublish react-tree-inspector@0.1.5
   ```
   > Only available within 72 hours of publishing and only if the package has
   > not been depended upon by other packages. Use this as a last resort.

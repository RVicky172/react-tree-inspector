# GitHub Actions Pipeline Guide

This document explains every aspect of the CI/CD pipeline for `react-tree-inspector`,
including the existing publish workflow, how to extend it, and how to set up all
required secrets and permissions.

---

## Overview

```
GitHub repository: RVicky172/react-tree-inspector
│
├── .github/
│   └── workflows/
│       └── publish.yml     ← automated npm publish on version tags
│
└── (future)
    └── ci.yml              ← lint / typecheck / build on every PR
```

The repository currently ships one workflow. This document covers both the existing
workflow and the recommended CI workflow to add.

---

## Existing Workflow: `publish.yml`

**File:** [`.github/workflows/publish.yml`](../.github/workflows/publish.yml)

### What it does

| Step | Description |
| ---- | ----------- |
| **Trigger** | Any tag matching `v*` pushed to the repository |
| **Checkout** | Full source checkout via `actions/checkout@v5` |
| **Node setup** | Installs Node 20 and configures the npm registry |
| **Install** | `npm ci` — clean, reproducible install from `package-lock.json` |
| **Version guard** | Verifies that the pushed tag exactly matches `package.json` version |
| **Publish (trusted)** | `npm publish --provenance --access public` when `NPM_TOKEN` is absent |
| **Publish (token)** | `npm publish --access public` using `NPM_TOKEN` when present |

### Full workflow file (annotated)

```yaml
name: Publish to npm

on:
  push:
    tags:
      - "v*"           # triggers on v0.1.0, v1.2.3, etc.
                       # does NOT trigger on commits to branches

permissions:
  contents: read       # read repo code
  id-token: write      # required for npm provenance attestation

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true   # silences Node version warnings

jobs:
  publish:
    runs-on: ubuntu-latest
    env:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}    # empty string if secret not set

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org   # required for NODE_AUTH_TOKEN

      - name: Install dependencies
        run: npm ci

      - name: Verify tag matches package version
        run: |
          PACKAGE_VERSION="v$(node -p "require('./package.json').version")"
          if [ "$PACKAGE_VERSION" != "${GITHUB_REF_NAME}" ]; then
            echo "Tag ${GITHUB_REF_NAME} does not match package version ${PACKAGE_VERSION}"
            exit 1
          fi

      # Path 1: trusted publishing (preferred — no long-lived secret needed)
      - name: Publish package (trusted publishing)
        if: env.NPM_TOKEN == ''
        run: npm publish --provenance --access public

      # Path 2: token-based fallback
      - name: Publish package (automation token fallback)
        if: env.NPM_TOKEN != ''
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ env.NPM_TOKEN }}
```

---

## Setting Up the Pipeline (First Time)

### Step 1 — Enable GitHub Actions

GitHub Actions is on by default for all repositories. Confirm it is enabled:

> **GitHub → Settings → Actions → General → Allow all actions**

### Step 2 — Configure npm Authentication

Choose **one** of the two publish methods:

#### Option A: Trusted Publishing (recommended — no secrets needed)

Trusted publishing links the npm release to a specific GitHub Actions workflow,
providing a cryptographic provenance attestation. No long-lived tokens are stored.

1. Log in to [npmjs.com](https://www.npmjs.com) and open the package page.
2. Go to **Settings → Publishing** (or the **Access** tab on the package).
3. Click **Add a publishing team / Trusted publisher**.
4. Fill in:
   - **GitHub owner:** `RVicky172`
   - **Repository:** `react-tree-inspector`
   - **Workflow:** `publish.yml`
5. Save. Do **not** add the `NPM_TOKEN` secret — the workflow detects its absence
   and uses trusted publishing automatically.

#### Option B: Automation Token (fallback / simpler setup)

1. Log in to [npmjs.com](https://www.npmjs.com).
2. Go to **Account → Access Tokens → Generate New Token → Automation**.
3. Copy the token.
4. In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**.
5. Name: `NPM_TOKEN`, Value: (paste the token).

When `NPM_TOKEN` is set, the workflow uses the token-based publish path automatically.

### Step 3 — Verify Permissions

In the repository, confirm the workflow has the correct permissions:

> **GitHub → Settings → Actions → General → Workflow permissions**
> - Set to **"Read and write permissions"** OR ensure the individual `permissions:` block in the YAML is respected.

The `publish.yml` already declares:
```yaml
permissions:
  contents: read
  id-token: write    # needed for provenance (trusted publishing)
```

---

## Recommended Addition: CI Workflow (`ci.yml`)

Add this workflow to run checks on every pull request and push to `main`.

**File to create:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  check:
    name: Typecheck & Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 20
          cache: npm               # caches node_modules across runs

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Verify dist artifacts
        run: |
          test -f dist/index.cjs.js || (echo "Missing dist/index.cjs.js" && exit 1)
          test -f dist/index.esm.js || (echo "Missing dist/index.esm.js" && exit 1)
          test -f dist/index.d.ts   || (echo "Missing dist/index.d.ts"   && exit 1)
          echo "All dist artifacts present ✓"
```

> **Why this matters:** The CI workflow catches broken builds and type errors on
> PRs before they reach `main`, so the publish workflow never runs on broken code.

---

## Workflow Trigger Reference

| Event | `publish.yml` | `ci.yml` |
| ----- | ------------- | -------- |
| Push to `main` | ❌ | ✅ |
| Pull request to `main` | ❌ | ✅ |
| Push a `v*` tag | ✅ | ❌ |
| Manual dispatch | ❌ | ❌ (add `workflow_dispatch:` if needed) |

---

## End-to-End Release Flow (Pipeline Perspective)

```
Developer                GitHub                  GitHub Actions          npm
─────────────────────────────────────────────────────────────────────────────
1. npm version patch    →  commit + tag created
2. git push origin main →  commit arrives on main →  ci.yml runs checks
3. git push origin --tags → tag vX.Y.Z pushed  →  publish.yml triggers
                                                    ├─ npm ci
                                                    ├─ verify tag == version
                                                    └─ npm publish ──────────→ npmjs.com
```

---

## Monitoring & Debugging Workflow Runs

### Viewing logs

1. Go to **GitHub → Actions**.
2. Click the workflow run you want to inspect.
3. Expand individual steps for full output.

### Common failure modes

| Failure | Cause | Fix |
| ------- | ----- | --- |
| `Tag does not match package version` | Tag `v0.1.6` but `package.json` still says `0.1.5` | Always use `npm version` to bump; it creates the tag atomically |
| `403 Forbidden` on publish | npm token expired or wrong scope | Regenerate the npm Automation token and update the `NPM_TOKEN` secret |
| `402 Payment required` | Package is not set to public | Add `--access public` (already present in the workflow) |
| `OIDC token request failed` | `id-token: write` permission missing | Ensure the `permissions:` block is in `publish.yml` |
| Trusted publishing `401` | npm trusted publisher not configured | Complete Step 2A above on npmjs.com |
| `npm ci` fails | `package-lock.json` not committed | Always commit `package-lock.json` |

### Re-running a failed workflow

1. Go to **GitHub → Actions → (failed run)**.
2. Click **Re-run failed jobs**.
3. The tag is not re-pushed; GitHub re-runs from the same ref.

---

## Secret Inventory

| Secret name | Where | Purpose | Required |
| ----------- | ----- | ------- | -------- |
| `NPM_TOKEN` | GitHub repo secrets | npm automation token for publishing | Only if **not** using trusted publishing |

No other secrets are required for the current pipeline.

---

## Adding Future Workflows

Some workflow ideas as the package matures:

### Scheduled compatibility check

```yaml
on:
  schedule:
    - cron: "0 6 * * 1"   # every Monday at 06:00 UTC
```

Run the build against the latest `react@canary` to catch upstream breakage early.

### Manual publish for pre-releases

```yaml
on:
  workflow_dispatch:
    inputs:
      tag:
        description: "npm dist-tag (e.g. beta, next)"
        required: true
        default: "beta"
```

Allows manually triggering a publish with a custom dist-tag without creating a
stable semver release.

---

## Files Reference

| File | Purpose |
| ---- | ------- |
| [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) | Automated npm publish on version tags |
| `.github/workflows/ci.yml` *(to be added)* | Lint / typecheck / build on PRs |
| [`tsup.config.ts`](../tsup.config.ts) | Build configuration used by both local and CI builds |
| [`package.json`](../package.json) → `prepublishOnly` | Local safety gate: runs typecheck + build before any publish |

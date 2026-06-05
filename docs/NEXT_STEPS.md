# Next Steps Plan

This document tracks the next milestones for react-tree-inspector.

## Current Status

- NPM package exists as `react-tree-inspector`.
- GitHub repository exists at `RVicky172/react-tree-inspector`.
- Package is currently marked as testing-only and not production-ready.

## Planned Milestones

1. Stabilize Runtime Compatibility

- Validate behavior against React 17, 18, and 19 sample apps.
- Add graceful fallbacks for Fiber shape differences.
- Add smoke tests for crawler stability.

2. Improve Developer UX

- Add search/filter in tree viewer.
- Add copy-to-clipboard for selected node metadata.
- Add toggle for showing/hiding host components.

3. Test Coverage

- Add unit tests for classifier and dependency extraction.
- Add integration tests for HOC and standalone component usage.
- Add CI checks for lint, typecheck, and build.

4. Release Hardening

- Expand README with compatibility matrix and known limitations.
- Define semantic versioning and changelog policy.
- Add issue templates and contribution guide.

## GitHub Actions: Automated NPM Publish on Tags

This repository includes a workflow for automated releases from Git tags.

### Workflow behavior

- Trigger: push tags matching `v*` (for example `v0.1.1`).
- Steps: install dependencies, typecheck/build (`prepublishOnly`), and publish to npm.

### Required repository secret

- `NPM_TOKEN`: npm token with permission to publish this package.

### Release process

1. Bump package version locally.
2. Commit and push changes.
3. Create and push a matching tag.
4. GitHub Action publishes automatically.

Example:

```bash
npm version patch
git push origin main
git push origin --tags
```

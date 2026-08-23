# Changelog

All notable repository and production changes are documented here.

## 2026-08-23 - Dependency update workflow

### Changed

- Split Dependabot production updates into smaller logical groups for framework dependencies, Radix UI dependencies, and UI utility dependencies instead of one large production dependency bundle.
- Left unmatched production dependencies to update independently so failures are easier to isolate.
- Kept development dependency updates grouped separately.
- Closed the oversized 19-package production dependency pull request after it exposed independent compatibility failures in `next-themes` and the JSDOM test environment.
- Enabled an active GitHub ruleset protecting `main` with pull-request, required-status-check, up-to-date-branch, conversation-resolution, deletion, and force-push protections.

## 2026-08-22 - Production hardening and maintainability

### Changed

- Enabled the existing System theme option in `next-themes`.
- Restored the default Next.js image optimization pipeline.
- Lazy-loaded the Guide, Growth, and Withdrawal top-level bundles.
- Centralized display-currency state in a React context so currency changes refresh formatting without remounting calculator state.
- Made `useLocalStorage` generic by passing Growth and Withdrawal persisted-state validators explicitly at their call sites while preserving malformed-state recovery.
- Consolidated Website CI around the single `npm run verify` source of truth.
- Pinned Playwright in `devDependencies` and regenerated the npm lockfile from GitHub Actions.
- Removed the unlocked runtime Playwright install from browser CI.
- Added WebKit mobile smoke coverage.
- Added real-browser Axe accessibility checks, including color contrast.
- Fixed Guide collapsible headers so Radix `aria-expanded` and `aria-controls` are applied to an element with button semantics and keyboard activation.
- Added explicit accessible names to the icon-only mobile Guide, Growth, and Withdrawal tabs for consistent Chromium, WebKit, and screen-reader behavior.
- Scoped browser-smoke concurrency by Git ref so unrelated branches do not cancel one another.
- Removed the duplicate nested license file; the root BSD-3-Clause license remains authoritative.

### Process

- Added `AGENTS.md` with mandatory AI development and documentation rules.
- Added `docs/DEPLOYMENT.md` documenting the PR-first GitHub-to-Vercel production workflow and branch-protection requirements.
- Retained the existing `portfolio_growth_simulator/nextjs_space` application directory because changing the Vercel project root without hosting-administration access would introduce unnecessary production risk.

### Deployment note

The code-level production workflow is documented for automated contributors. GitHub now also enforces the protected `main` workflow through an active repository ruleset requiring the configured status checks and blocking destructive branch operations.
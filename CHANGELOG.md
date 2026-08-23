# Changelog

All notable repository and production changes are documented here.

## 2026-08-23 - Loan and amortization calculator

### Added

- Added a dedicated `/loan` Loan & Amortization Calculator without changing the core Guide, Growth, and Withdrawal tab structure.
- Added deterministic fixed-rate amortization with cent-level payment rounding, exact zero-balance payoff, 0% APR handling, and final-payment adjustment.
- Added recurring extra-principal payments and up to 24 one-time lump-sum payments.
- Added baseline versus accelerated payoff comparisons with interest saved and time saved.
- Added responsive remaining-balance charts, yearly amortization summaries, and an optional full monthly payment schedule.
- Added versioned, validated loan share links stored in the URL fragment and persisted loan scenarios in simulator-owned browser storage.
- Added Excel export and browser Print / PDF support for loan scenarios.
- Added a dedicated loan methodology page covering the payment formula, payment order, rounding conventions, payoff comparisons, and model limitations.
- Added loan scenarios to the Privacy notice, sitemap, offline application shell, global footer, Chromium browser coverage, WebKit mobile coverage, and real-browser accessibility scans.
- Added deterministic loan-engine regression tests for standard amortization, 0% loans, extra payments, lump sums, year summaries, and payoff invariants.

### Rollback checkpoint

- Created `backup/pre-loan-calculator-2026-08-23` from production commit `c12f7f3cee59bc5f74f666301fe5960cedf3e51e` before loan development began. If the release is not preferred after deployment, restore the previous Vercel deployment first and revert the loan release commit through a normal pull request.

## 2026-08-23 - Public experience polish

### Changed

- Replaced the generic header icon with the Portfolio Simulator app mark for a more consistent product identity.
- Switched the header brand mark from the raster `favicon.png` asset to the existing vector `favicon.svg` so it renders sharply on high-density displays.
- Kept Guide, Growth, and Withdrawal labels visible on mobile while preserving their explicit accessible tab names.
- Tightened the simulator shell spacing on small screens without changing calculator behavior or financial results.
- Simplified the support card and donation dialog so support remains available without visually competing with portfolio results.
- Added a compact global footer with Methodology, Privacy, and Support links.
- Added a Privacy page describing local browser storage, share-link behavior, Vercel hosting and analytics, and third-party support services.
- Added the Privacy route to the sitemap, offline application shell, and real-browser accessibility coverage.
- Extended WebKit mobile smoke tests to verify visible tab labels, the Privacy route, footer navigation, and no page-level overflow.
- Split future production dependency updates into smaller framework, Radix UI, and UI utility groups so failures are easier to isolate and review.

### Rollback checkpoint

- Created `backup/pre-public-polish-2026-08-23` from the production `main` branch before this polish work began. The release can be reverted in GitHub and the prior Vercel production deployment can be restored if the new presentation is not preferred.

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

The code-level production workflow is now documented and enforced procedurally for automated contributors. GitHub branch protection itself is an account/repository setting and cannot be changed through the repository source tree; it should require the Website CI and Browser Smoke checks and disallow force pushes to `main` when repository-administration access is available.

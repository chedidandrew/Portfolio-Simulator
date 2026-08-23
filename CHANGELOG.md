# Changelog

All notable repository and production changes are documented here.

## 2026-08-23 - Loan polish and hardening

### Changed

- Corrected the yearly amortization summary so scheduled principal and extra principal are reported separately and total payments reconcile without double-counting.
- Added a print-only Loan Assumptions section so Print / PDF output includes loan amount, APR, term, first payment month, recurring extra principal, currency, and one-time payments.
- Expanded Excel export with scheduled-versus-accelerated interest totals, clearer scheduled-principal labeling, and a dedicated Extra Payments worksheet when lump-sum payments are present.
- Hardened loan share links with supported-currency validation, compressed and decompressed size limits, duplicate payment-ID rejection, URL cleanup after loading, and native-share-to-clipboard fallback behavior.
- Restricted one-time payments to the scheduled loan term and added an in-app warning when a planned payment falls after the accelerated payoff date.
- Improved narrow-mobile one-time-payment layout and added 320 px Chromium/WebKit coverage.
- Brought the loan header closer to the main simulator branding and added direct theme and display-currency controls.
- Added display-currency symbols to loan amount and extra-payment inputs.
- Replaced the schedule toggle's download icon with a list icon and linked the loan disclaimer directly to the dedicated Loan Methodology page.
- Added a subtle Loan Calculator entry point from the Guide without changing the core Guide, Growth, and Withdrawal tab structure.
- Expanded loan regression coverage for same-month lump sums, out-of-term payments, yearly reconciliation, extreme supported inputs, share-link validation, print assumptions, and consumed-share URL cleanup.
- Updated Loan Methodology to document separate scheduled/extra principal reporting and behavior for payments that occur after projected payoff.

### Rollback checkpoint

- Created `backup/pre-loan-polish-2026-08-23` from production commit `15f6784a64b578d22da055e324616a0454495744` before this polish pass. If the updated loan experience is not preferred after deployment, restore that Vercel deployment first and revert this polish release through a normal pull request.

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

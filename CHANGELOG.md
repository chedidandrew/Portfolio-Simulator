# Changelog

All notable repository and production changes are documented here.

## 2026-08-23 - Financial tool input editing hardening

### Fixed

- Replaced direct number coercion in the Loan Calculator, Loan Payoff Goal, Refinance Comparison, and Invest vs. Debt inputs with the simulator's buffered numeric-input behavior so users can clear a field and type a replacement value without an unwanted `0` being forced back into the control.
- Prevented year-based term fields from momentarily collapsing to one month and displaying values such as `0.08333333333333333` while the user is editing them.
- Kept Payoff Goal target dates inside the selected loan term when the first-payment month or remaining term changes, avoiding stale out-of-range targets after an edit.
- Replaced the detached `More financial tools` Guide text with explicit `Financial Tools` and `Loan Calculator` buttons while preserving Guide, Growth, and Withdrawal as the primary three tabs.
- Expanded Chromium regression coverage for clear-and-retype behavior in the main Loan Calculator and all new financial tools, plus the new Guide navigation and 320 px overflow checks.

### Rollback checkpoint

- Created `backup/pre-financial-tools-input-fix-2026-08-23` from production commit `8021638b694312a5a521a4ad23fd7cf817270fb5` before this fix. If the revised input behavior or Guide navigation is not preferred after deployment, restore that Vercel deployment first and revert this release through a normal pull request.

## 2026-08-23 - Financial planning tools expansion

### Added

- Added a `/tools` hub so debt-planning tools can grow without adding more tabs to the core Guide, Growth, and Withdrawal simulator.
- Added `/loan/payoff-goal`, which solves for the minimum recurring extra payment needed to reach a selected target payoff month and can apply that result back to the main Loan Calculator.
- Added `/loan/refinance`, comparing current and proposed fixed-rate loans with closing costs, financed-cost handling, payment savings, payoff timing, break-even estimate, remaining interest, and lifetime cost.
- Added `/invest-vs-debt`, which compares investing extra monthly cash with accelerating fixed-rate debt payoff using equal monthly cash commitments, deterministic projections, and reproducible seeded market scenarios.
- Added dedicated refinance and invest-vs-debt methodology pages documenting cash-flow rules, scenario assumptions, and exclusions.
- Added custom 404 and application-error experiences consistent with the Portfolio Simulator visual system.
- Added deterministic regression coverage for payoff-goal solving, refinance math, and invest-vs-debt comparisons plus dedicated Chromium, WebKit mobile, and Axe coverage for the new routes.

### Changed

- Added related Payoff Goal, Refinance, and Invest vs. Debt links below the main Loan Calculator while keeping the calculator itself focused on amortization.
- Changed the global footer from a single Loan Calculator link to a Financial Tools entry point.
- Expanded SoftwareApplication structured data and the sitemap to include the new financial-planning capabilities and routes.
- Expanded the PWA offline shell to cache the new tool and methodology routes.
- PWA install-prompt dismissal is now remembered for 30 days instead of potentially reappearing on each eligible visit.
- Updated repository documentation and validation scripts for the expanded financial-tool suite.

### Rollback checkpoint

- Created `backup/pre-financial-tools-expansion-2026-08-23` from production commit `2040b6b12205fa619f91c59636ea526bf3200549` before this expansion. If the broader tools experience is not preferred after deployment, restore that Vercel deployment first and revert this release through a normal pull request.

### Deferred security maintenance

- The announced Next.js August 26, 2026 security release is not available as of this release date. The project remains on Next.js 15.5.22 until the patched 15.5 build is published, at which point it should be upgraded through the normal protected PR and browser-validation workflow.

## 2026-08-23 - Loan chart and formula polish

### Changed

- Restyled the Remaining Balance chart tooltip to use the active theme's popover surface, readable foreground text, rounded app-card treatment, and tabular numeric values instead of Recharts' default light tooltip.
- Reduced loan-chart grid and hover-cursor emphasis so the balance curve remains the visual focus in dark and light themes.
- Replaced the plain monospaced loan payment formula with the same centered KaTeX formula-card treatment used by the Growth Phase methodology.
- Expanded Chromium loan smoke coverage to verify themed tooltip styling, quiet chart grid treatment, and rendered loan methodology math.

### Rollback checkpoint

- Created `backup/pre-loan-chart-polish-2026-08-23` from production commit `69058e5f16dddad59045d8cfa6e91a5b19ff19fc` before this presentation pass. If the revised chart or formula treatment is not preferred after deployment, restore that Vercel deployment first and revert this release through a normal pull request.

## 2026-08-23 - Header and loan summary polish

### Changed

- Replaced the green-gradient `Portfolio Simulator` header text with the normal foreground color so the green app mark remains the primary brand accent; this renders white in dark mode and dark in light mode for contrast.
- Changed the loan summary metrics to a roomier 2-by-2 desktop layout instead of forcing four narrow cards into the results column.
- Kept loan currency summary values on one line with tabular numerals to prevent awkward cent wrapping or clipping.
- Tightened the gap between the loan introduction and the primary calculator/results cards by 8 px.
- Expanded Chromium loan smoke coverage to verify the brand treatment, 2-by-2 summary layout, and non-wrapping currency values.

### Rollback checkpoint

- Created `backup/pre-header-metric-polish-2026-08-23` from production commit `635ec66332ac9cea324b68e0baf4c914d7eb8372` before this visual polish pass. If the revised presentation is not preferred after deployment, restore that Vercel deployment first and revert this release through a normal pull request.

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

- Created `backup/pre-loan-calculator-2026-08-23` from production commit `c12f7f3cee59bc5f74f666301fe5960cedf3e51e` before loan development began. If the release is not preferred after deployment, restore the previous Vercel production deployment first and revert the loan release commit through a normal pull request.

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

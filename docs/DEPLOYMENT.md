# Production Deployment

Production is hosted by Vercel and connected to this GitHub repository. The production branch is `main`.

## Required workflow

1. Create a short-lived branch.
2. Open a pull request into `main`.
3. Review the Vercel preview when the change affects the browser experience.
4. Wait for Website CI, Browser Smoke, CodeQL, and the required Vercel check to pass on the final head commit.
5. Merge only after the checks are green.
6. Vercel deploys the merged `main` commit through the existing Git integration.
7. Verify the live production URL after deployment.

## Repository protection

`main` is protected through a GitHub branch ruleset. Production changes must go through a pull request, required checks must pass, force pushes are blocked, and branch deletion is restricted.

The PR-first rule in `AGENTS.md` remains mandatory for automated contributors even if repository settings change later.

## Rollback

For an urgent presentation or behavior rollback, restore the previous known-good Vercel deployment first so the public site can recover quickly. Then create a GitHub revert pull request for the release commit so `main` and production return to the same source state.

Release checkpoints:

- `backup/pre-loan-calculator-2026-08-23` preserves production commit `c12f7f3cee59bc5f74f666301fe5960cedf3e51e` from immediately before the Loan & Amortization Calculator release.
- `backup/pre-public-polish-2026-08-23` preserves the production source state from immediately before the public-experience polish release.

Do not force-push `main` backward. Use a revert pull request so the rollback is reviewable, tested, and preserved in history.

## Dependency maintenance

Dependabot keeps minor and patch production updates in small logical groups instead of one large production bundle. Framework packages, Radix UI packages, and UI utility packages are tested independently so a compatibility failure can be isolated before merge. Major updates remain manual review items.

## Local validation

From `portfolio_growth_simulator/nextjs_space`:

```bash
npm ci
npm run verify
```

Playwright is pinned in `devDependencies`, so browser CI uses the lockfile instead of an ad hoc package install.

## Browser validation

The Browser Smoke workflow covers:

- Chromium end-to-end behavior, including exports, Monte Carlo workers, share links, mobile layout, chart tooltips, simulation progress UI, and the loan calculator share/export path.
- WebKit mobile layout, visible mode navigation, settings behavior, public trust routes, and the responsive loan calculator/amortization schedule.
- Real-browser Axe accessibility checks, including color contrast, on the application, loan calculator, methodology, loan methodology, and privacy routes.

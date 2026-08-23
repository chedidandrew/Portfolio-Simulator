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

For the 2026-08-23 public-experience polish release, `backup/pre-public-polish-2026-08-23` preserves the production source state from immediately before the polish branch was created.

Do not force-push `main` backward. Use a revert pull request so the rollback is reviewable, tested, and preserved in history.

## Local validation

From `portfolio_growth_simulator/nextjs_space`:

```bash
npm ci
npm run verify
```

Playwright is pinned in `devDependencies`, so browser CI uses the lockfile instead of an ad hoc package install.

## Browser validation

The Browser Smoke workflow covers:

- Chromium end-to-end behavior, including exports, Monte Carlo workers, share links, mobile layout, chart tooltips, and simulation progress UI.
- WebKit mobile layout, visible mode navigation, settings behavior, and public trust routes.
- Real-browser Axe accessibility checks, including color contrast, on the application, methodology, and privacy routes.
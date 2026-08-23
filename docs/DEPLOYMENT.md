# Production Deployment

Production is hosted by Vercel and connected to this GitHub repository. The production branch is `main`.

## Required workflow

1. Create a short-lived branch.
2. Open a pull request into `main`.
3. Wait for Website CI, Browser Smoke, and CodeQL to pass on the final head commit.
4. Merge only after the checks are green.
5. Vercel deploys the merged `main` commit through the existing Git integration.
6. Verify the live production URL after deployment.

## Repository protection

GitHub settings should protect `main` against force pushes and direct application pushes and require Website CI and Browser Smoke before merge. Branch protection is a repository setting rather than source code. If administrative tooling is unavailable, the PR-first rule in `AGENTS.md` remains mandatory until protection can be enabled in GitHub Settings.

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
- WebKit mobile layout and settings behavior.
- Real-browser Axe accessibility checks, including color contrast, on the application and methodology route.

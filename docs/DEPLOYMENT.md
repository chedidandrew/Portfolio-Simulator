# Production Deployment

Production is hosted by Vercel and connected to this GitHub repository. The production branch is `main`.

## Required workflow

1. Create a short-lived branch.
2. Open a pull request into `main`.
3. Wait for Website CI, Browser Smoke, CodeQL, and the configured Vercel status check to pass on the final head commit.
4. Ensure the branch is up to date with `main` and all review conversations are resolved.
5. Merge only after the required checks are green.
6. Vercel deploys the merged `main` commit through the existing Git integration.
7. Verify the live production URL after deployment.

## Repository protection

`main` is protected by an active GitHub ruleset. The ruleset requires pull requests, required status checks, an up-to-date branch before merge, and resolved review conversations. It also restricts branch deletion and blocks force pushes. The bypass list is intentionally empty.

The repository does not require human approvals, which keeps the workflow compatible with AI-assisted maintenance while preserving automated quality gates.

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
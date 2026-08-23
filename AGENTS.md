# AI Development Rules

This repository is maintained with AI-assisted development. Automated contributors must follow these rules.

1. Never push application changes directly to `main`. Use a short-lived branch and pull request.
2. Merge only after Website CI, Browser Smoke, and CodeQL are green on the final head commit.
3. Run `npm run verify` for every application change. Browser-facing changes must pass Playwright smoke tests.
4. Do not add user-visible features or content unless explicitly requested.
5. Preserve deterministic calculations, seeded Monte Carlo reproducibility, stored-state compatibility, and share-link compatibility unless a migration is documented.
6. Update `CHANGELOG.md` and relevant documentation with every code change.
7. Do not weaken TypeScript, lint, security, accessibility, or test gates to make a change pass.
8. Keep Vercel production deployment tied to reviewed changes merged into `main`.
9. Prefer small, reversible changes and record notable architectural or deployment decisions in the repository.

See `docs/DEPLOYMENT.md` for the release process.

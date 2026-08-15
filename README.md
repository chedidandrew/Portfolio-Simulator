# Portfolio Simulator

A responsive financial planning website for modeling portfolio growth and retirement withdrawals with deterministic and Monte Carlo simulations.

## Features

- Deterministic portfolio growth and withdrawal projections
- Seeded Monte Carlo simulations with reproducible results
- Annual, quarterly, monthly, and weekly cash flows
- Inflation, contribution growth, withdrawals, goals, and multiple tax treatments
- Gross, spendable, tax-drag, and real-dollar reporting
- Shareable, validated scenario links
- Excel exports and print/PDF-ready results
- Dark and light themes, responsive layouts, keyboard support, and PWA installation
- Local browser storage with safe recovery from malformed saved data
- Vercel Web Analytics

> Display Currency changes symbols and number formatting only. The simulator does not perform foreign-exchange conversion.

## Technology

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS and Radix UI
- Recharts
- ExcelJS, loaded only when exporting
- Node.js 24

## Run locally

Install [Node.js 24](https://nodejs.org/) and then run:

```powershell
cd portfolio_growth_simulator\nextjs_space
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validate the website

From `portfolio_growth_simulator\nextjs_space`:

```powershell
npm run lint
npm test
npm run typecheck
npm run build
```

Or run the complete validation sequence:

```powershell
npm run verify
```

## Production

Create the optimized production build:

```powershell
npm run build
npm start
```

The project is configured for Node.js `24.x`. A GitHub Actions workflow runs installation, linting, tests, type checking, and the production build for pull requests that change the website.

## Project structure

```text
Portfolio-Simulator/
├── .github/workflows/                 # GitHub validation workflow
├── portfolio_growth_simulator/
│   └── nextjs_space/
│       ├── app/                       # Next.js routes and global styles
│       ├── components/                # Calculator and UI components
│       ├── hooks/                     # State and calculation hooks
│       ├── lib/                       # Financial engines, validation, and exports
│       ├── public/                    # Icons, manifest, and service worker
│       ├── scripts/                   # Project maintenance/test scripts
│       ├── LICENSE                    # BSD 3-Clause license
│       ├── package.json
│       └── package-lock.json
└── README.md
```

## Important notes

- Results are educational estimates, not financial, tax, or investment advice.
- Monte Carlo results describe modeled scenarios and are not forecasts or guarantees.
- Shared links contain the selected scenario inputs in the URL fragment. Review a link before sharing it publicly.
- Calculator data is stored locally in the browser unless the user deliberately creates a share link.

## License

This project is licensed under the [BSD 3-Clause License](portfolio_growth_simulator/nextjs_space/LICENSE).

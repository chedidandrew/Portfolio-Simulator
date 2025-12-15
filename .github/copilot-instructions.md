# Portfolio Simulator - AI Coding Instructions

## Architecture Overview
This is a Next.js client-side financial simulator with three modes: Growth (investment accumulation), Withdrawal (retirement sustainability), and Monte Carlo (risk analysis). Core logic is separated into pure engine functions in `lib/simulation/` for deterministic projections and stochastic simulations. UI components in `components/` use custom hooks in `hooks/` for state management and calculations. Data flows from user inputs → hooks → engines → results displayed in components.

## Key Components & Patterns
- **Engines**: Pure functions in `lib/simulation/` (e.g., `growth-engine.ts`, `monte-carlo-engine.ts`) handle all financial math. Import and call directly for calculations.
- **Hooks**: Custom hooks like `useGrowthCalculation` encapsulate state and engine calls. Use for reactive updates in components.
- **UI Structure**: Organized by mode (e.g., `components/growth/`, `components/withdrawal/`). Reuse shadcn/ui components from `components/ui/`.
- **State Management**: Local storage via `useLocalStorage` hook for persistence. URL sharing uses LZString compression for Monte Carlo params.
- **Charts**: Multiple libraries (Chart.js, Plotly, Recharts) - check existing usage in components like `growth-chart.tsx`.

## Development Workflows
- **Run Dev**: `npm run dev` (Next.js hot reload)
- **Build**: `npm run build` (static export for PWA)
- **Lint**: `npm run lint` (ESLint with TypeScript)
- **Tests**: No automated test runner configured; manual tests in `lib/financial.test.ts` (vitest syntax)
- **Database**: Prisma schema exists but unused in current client-only app; seed script available if needed

## Project Conventions
- **Styling**: Tailwind CSS with shadcn/ui. Use `class-variance-authority` for component variants.
- **Types**: Strict TypeScript; interfaces in `lib/types.ts` (e.g., `GrowthState`, `SimulationParams`)
- **Imports**: Absolute paths with `@/` alias (e.g., `@/components/ui/button`)
- **Frequency Handling**: Support 'yearly'|'quarterly'|'monthly'|'weekly' in engines; convert to monthly loops
- **Inflation**: Optional adjustment; engines handle `excludeInflationAdjustment` flag
- **Monte Carlo**: Integrated as toggle in Growth/Withdrawal modes; uses seedrandom for reproducible runs
- **Sharing**: Encode state to URL for shareable links; decode on load to restore simulations

## Integration Points
- **PWA**: Manifest and service worker in `public/` for offline capability
- **Charts**: Choose based on needs - Chart.js for simple, Plotly for interactive, Recharts for React-native feel
- **External APIs**: None currently; calculations are local
- **Persistence**: Local storage for user prefs; no server-side state

## Common Patterns
- **Parameter Components**: Follow `components/growth/parameters.tsx` - form inputs with validation
- **Results Display**: Use tables/charts like `components/growth/results.tsx` and `growth-chart.tsx`
- **Mode Switching**: Tabs in `app/page.tsx` manage active mode; localStorage tracks last used
- **Error Handling**: Basic try/catch in engines; throw descriptive errors for invalid inputs
- **Performance**: Engines run synchronously; Monte Carlo with 1000+ paths may need optimization for large durations</content>
<parameter name="filePath">c:\Users\Andrew\Documents\GitHub\Portfolio-Simulator\.github\copilot-instructions.md
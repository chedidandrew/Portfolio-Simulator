import { spawnSync } from 'node:child_process'
import path from 'node:path'

const testFile = 'components/integration.test.tsx'
const testEnvironment = {
  ...process.env,
  TSX_TSCONFIG_PATH: path.join(process.cwd(), 'tsconfig.test.json'),
}
const patterns = [
  'fresh localStorage',
  'taxable table',
  'growth income-tax table',
  'shared payload prop',
  'growth chart and result card',
  'overflow remains',
  'localStorage recovery',
  'cost basis tracking follows',
  'underfunded withdrawal UI',
  'weekly depletion',
  'Guide discloses Vercel Analytics',
  'tax toggle layouts',
  'sensitivity medians',
  'renders gross',
  'mode-specific retirement',
  'terminal goal-probability',
  'switches have',
  'Methodology buttons',
  'donation dialog',
  'accessibility scan',
]

for (const pattern of patterns) {
  const result = spawnSync(process.execPath, [
    '--import',
    'tsx',
    '--test',
    '--test-isolation=none',
    `--test-name-pattern=${pattern}`,
    testFile,
  ], { env: testEnvironment, stdio: 'inherit' })

  if (result.status !== 0) process.exit(result.status ?? 1)
}

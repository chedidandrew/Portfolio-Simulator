import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  markCostBasisUserEdited,
  normalizeGrowthState,
  normalizeSimulationParams,
  normalizeWithdrawalState,
  updateInitialValueWithTrackedBasis,
  updateStartingBalanceWithTrackedBasis,
} from './state-normalization'
import { calculateWithdrawalProjection } from './simulation/withdrawal-engine'
import { calculateGrowthProjection } from './simulation/growth-engine'
import { buildWithdrawalWorkbook } from './export/withdrawal-workbook'
import { clearPortfolioStorage, type StorageLike } from './owned-storage'
import { validateGrowthStateRange } from './simulation/deterministic-validation'
import { performMonteCarloSimulation } from './simulation/monte-carlo-engine'
import type { GrowthState, SimulationParams, WithdrawalState } from './types'
import { DEFAULT_GROWTH_STATE, DEFAULT_WITHDRAWAL_STATE } from './default-states'
import { buildMonteCarloExportMetadata, buildMonteCarloSharePayload } from './completed-run-metadata'
import LZString from 'lz-string'
import ExcelJS from 'exceljs'
import { formatFinancialWorkbook } from './export/excel-formatting'
import {
  buildShareUrl,
  decodeSharePayload,
  readSharePayload,
  SHARE_PAYLOAD_VERSION,
  validateSharePayload,
} from './share-links'

const taxableWithdrawal: WithdrawalState = {
  startingBalance: 100_000,
  startingCostBasis: 40_000,
  annualReturn: 0,
  duration: 1,
  periodicWithdrawal: 20_000,
  inflationAdjustment: 0,
  frequency: 'yearly',
  taxEnabled: true,
  taxType: 'capital_gains',
  taxRate: 15,
}

const shareGrowthState: GrowthState = {
  startingBalance: 10_000,
  annualReturn: 8,
  duration: 1,
  periodicAddition: 0,
  frequency: 'yearly',
  inflationAdjustment: 0,
  taxEnabled: true,
  taxRate: 25,
  taxType: 'income',
}

test('new share links are versioned hash payloads and preserve supported display currencies', () => {
  for (const displayCurrency of ['USD', 'EUR', 'JPY']) {
    const sharedUrl = buildShareUrl('https://example.test/?keep=1', {
      mode: 'growth',
      type: 'deterministic',
      deterministicParams: shareGrowthState,
    }, displayCurrency)
    const url = new URL(sharedUrl)
    assert.equal(url.searchParams.get('mc'), null)
    assert.ok(url.hash.startsWith('#mc='))
    const decoded = readSharePayload(url)
    assert.equal(decoded.payload?.sharePayloadVersion, SHARE_PAYLOAD_VERSION)
    assert.equal(decoded.payload?.displayCurrency, displayCurrency)
    assert.deepEqual(decoded.payload?.deterministicParams, shareGrowthState)
  }
})

test('share decoder accepts legacy compressed and base64 query links', () => {
  const legacy = {
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: shareGrowthState,
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(legacy))
  const compressedResult = readSharePayload(new URL(`https://example.test/?mc=${compressed}`))
  assert.equal(compressedResult.payload?.mode, 'growth')
  assert.equal(compressedResult.payload?.sharePayloadVersion, undefined)

  const base64 = btoa(encodeURIComponent(JSON.stringify(legacy)))
  const base64Result = readSharePayload(new URL(`https://example.test/?mc=${encodeURIComponent(base64)}`))
  assert.equal(base64Result.payload?.type, 'deterministic')
})

test('share validation rejects malformed, unsupported, non-finite, invalid-frequency, and excessive-workload payloads', () => {
  assert.equal(decodeSharePayload(LZString.compressToEncodedURIComponent('{bad json')), null)
  assert.equal(validateSharePayload({
    sharePayloadVersion: 999,
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: shareGrowthState,
  }), null)
  assert.equal(validateSharePayload({
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: { ...shareGrowthState, frequency: 'daily' },
  }), null)
  assert.equal(validateSharePayload({
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: { ...shareGrowthState, annualReturn: Number.NaN },
  }), null)
  assert.equal(validateSharePayload({
    mode: 'growth',
    type: 'monte-carlo',
    deterministicParams: shareGrowthState,
    mcParams: {
      initialValue: 10_000,
      expectedReturn: 8,
      volatility: 15,
      duration: 200,
      cashflowAmount: 0,
      cashflowFrequency: 'weekly',
      numPaths: 110_000,
    },
  }), null)
})

test('share validation accepts missing optional fields and ignores unsupported display currency', () => {
  const decoded = validateSharePayload({
    sharePayloadVersion: SHARE_PAYLOAD_VERSION,
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: shareGrowthState,
    displayCurrency: 'NOT-A-CURRENCY',
  })
  assert.ok(decoded)
  assert.equal(decoded.displayCurrency, undefined)
  assert.equal(decoded.showFullPrecision, undefined)
})

test('deterministic financial charts use linear interpolation and never floor zero to one dollar', async () => {
  const growthChart = await readFile(path.resolve(process.cwd(), 'components', 'growth-chart.tsx'), 'utf8')
  const withdrawalChart = await readFile(path.resolve(process.cwd(), 'components', 'withdrawal-chart.tsx'), 'utf8')
  for (const source of [growthChart, withdrawalChart]) {
    assert.match(source, /type="linear"/)
    assert.doesNotMatch(source, /type="monotone"/)
    assert.doesNotMatch(source, /logSafe|LOG_FLOOR/)
  }
  assert.doesNotMatch(growthChart, /payload\.length\s*===\s*2/)
  assert.doesNotMatch(withdrawalChart, /dataKey\s*===\s*['\"]withdrawn['\"]/)
})

test('fresh and legacy withdrawal state normalizes to an explicit taxable basis without overwriting edits', () => {
  const legacy = normalizeWithdrawalState(
    { ...taxableWithdrawal, startingBalance: 100_000, startingCostBasis: undefined, taxType: undefined },
    { startingBalance: 100_000 },
  )
  assert.equal(legacy.taxType, 'capital_gains')
  assert.equal(legacy.startingCostBasis, 100_000)
  assert.equal(legacy.costBasisIsUserEdited, false)

  const manuallyEdited = normalizeWithdrawalState(
    { ...taxableWithdrawal, startingBalance: 100_000, startingCostBasis: 120_000 },
    { startingBalance: 100_000, startingCostBasis: 120_000, taxType: 'capital_gains' },
  )
  assert.equal(manuallyEdited.startingCostBasis, 120_000)
  assert.equal(manuallyEdited.costBasisIsUserEdited, true)

  const savedAutomatic = normalizeWithdrawalState(
    { ...taxableWithdrawal, startingBalance: 100_000, startingCostBasis: 40_000, costBasisIsUserEdited: false },
    { startingBalance: 100_000, startingCostBasis: 40_000, costBasisIsUserEdited: false, taxType: 'capital_gains' },
  )
  assert.equal(savedAutomatic.startingCostBasis, 100_000)
  assert.equal(savedAutomatic.costBasisIsUserEdited, false)
})

test('cost basis tracks balance until a manual edit in Growth, Withdrawal, and Monte Carlo state', () => {
  const growthStart = normalizeGrowthState({
    ...DEFAULT_GROWTH_STATE,
    startingBalance: 10_000,
    startingCostBasis: 10_000,
    costBasisIsUserEdited: false,
  }, null)
  const growthTracked = updateStartingBalanceWithTrackedBasis(growthStart, 100_000)
  assert.equal(growthTracked.startingCostBasis, 100_000)
  const growthEdited = markCostBasisUserEdited(growthTracked, 4_000)
  const growthPreserved = updateStartingBalanceWithTrackedBasis(growthEdited, 200_000)
  assert.equal(growthPreserved.startingCostBasis, 4_000)

  const withdrawalStart = normalizeWithdrawalState({
    ...DEFAULT_WITHDRAWAL_STATE,
    startingBalance: 10_000,
    startingCostBasis: 10_000,
    costBasisIsUserEdited: false,
  }, null)
  const withdrawalTracked = updateStartingBalanceWithTrackedBasis(withdrawalStart, 100_000)
  assert.equal(withdrawalTracked.startingCostBasis, 100_000)
  const withdrawalEdited = markCostBasisUserEdited(withdrawalTracked, 4_000)
  const withdrawalPreserved = updateStartingBalanceWithTrackedBasis(withdrawalEdited, 200_000)
  assert.equal(withdrawalPreserved.startingCostBasis, 4_000)

  const monteCarloStart = normalizeSimulationParams({
    initialValue: 1_000_000,
    startingCostBasis: 1_000_000,
    costBasisIsUserEdited: false,
    expectedReturn: 7,
    volatility: 10,
    duration: 30,
    cashflowAmount: 3_000,
    cashflowFrequency: 'monthly',
    numPaths: 500,
  }, null)
  const monteCarloTracked = updateInitialValueWithTrackedBasis(monteCarloStart, 100_000)
  assert.equal(monteCarloTracked.startingCostBasis, 100_000)
  const monteCarloEdited = markCostBasisUserEdited(monteCarloTracked, 40_000)
  const monteCarloPreserved = updateInitialValueWithTrackedBasis(monteCarloEdited, 200_000)
  assert.equal(monteCarloPreserved.startingCostBasis, 40_000)
})

test('automatic taxable basis prevents false embedded capital-gains tax', () => {
  const tracked = updateStartingBalanceWithTrackedBasis({
    ...DEFAULT_GROWTH_STATE,
    startingBalance: 10_000,
    startingCostBasis: 10_000,
    costBasisIsUserEdited: false,
  }, 100_000)
  const result = calculateGrowthProjection({
    ...tracked,
    annualReturn: 0,
    duration: 1,
    periodicAddition: 0,
    taxEnabled: true,
    taxType: 'capital_gains',
    taxRate: 15,
  })
  assert.equal(result.finalValue, 100_000)
  assert.equal(result.finalValueNet, 100_000)
  assert.equal(result.totalDeferredTax, 0)
})

test('reset defaults restore automatic cost-basis tracking', () => {
  assert.equal(DEFAULT_GROWTH_STATE.costBasisIsUserEdited, false)
  assert.equal(DEFAULT_WITHDRAWAL_STATE.costBasisIsUserEdited, false)
  assert.equal(updateStartingBalanceWithTrackedBasis(DEFAULT_GROWTH_STATE, 100_000).startingCostBasis, 100_000)
  assert.equal(updateStartingBalanceWithTrackedBasis(DEFAULT_WITHDRAWAL_STATE, 100_000).startingCostBasis, 100_000)
})

test('underfunded final and multi-year withdrawals record a depletion period without changing exact-final success', () => {
  const exactFinal = calculateWithdrawalProjection({
    startingBalance: 100_000,
    annualReturn: 0,
    duration: 1,
    periodicWithdrawal: 100_000,
    inflationAdjustment: 0,
    frequency: 'yearly',
  })
  assert.equal(exactFinal.isSustainable, true)
  assert.equal(exactFinal.yearsUntilZero, null)

  const underfundedFinal = calculateWithdrawalProjection({
    startingBalance: 50_000,
    annualReturn: 0,
    duration: 1,
    periodicWithdrawal: 100_000,
    inflationAdjustment: 0,
    frequency: 'yearly',
  })
  assert.equal(underfundedFinal.totalWithdrawn, 50_000)
  assert.equal(underfundedFinal.endingBalanceGross, 0)
  assert.equal(underfundedFinal.isSustainable, false)
  assert.equal(underfundedFinal.yearsUntilZero, 1)

  const underfundedMultiYear = calculateWithdrawalProjection({
    startingBalance: 100_000,
    annualReturn: 0,
    duration: 3,
    periodicWithdrawal: 80_000,
    inflationAdjustment: 0,
    frequency: 'yearly',
  })
  assert.equal(underfundedMultiYear.totalWithdrawn, 100_000)
  assert.equal(underfundedMultiYear.isSustainable, false)
  assert.equal(underfundedMultiYear.yearsUntilZero, 2)
})

test('completed Monte Carlo result seed wins over a changed input seed for export and share', () => {
  const completedParams: SimulationParams = {
    initialValue: 100_000,
    expectedReturn: 7,
    volatility: 10,
    duration: 30,
    cashflowAmount: 500,
    cashflowFrequency: 'monthly',
    numPaths: 500,
  }
  const currentParams = { ...completedParams, initialValue: 200_000 }
  const completedResult = { simulationParams: completedParams, simulationSeed: 'seed-A' }

  const exportMetadata = buildMonteCarloExportMetadata(completedResult, currentParams, 'seed-B')
  assert.equal(exportMetadata.randomSeedRow.Value, 'seed-A')
  assert.equal(exportMetadata.params.initialValue, 100_000)

  const sharePayload = buildMonteCarloSharePayload({
    mode: 'growth',
    deterministicParams: DEFAULT_GROWTH_STATE,
    completedResult,
    currentParams,
    currentSeed: 'seed-B',
    logScales: { chart: false, histogram: false, drawdown: false },
    showFullPrecision: false,
  })
  assert.equal(sharePayload.rngSeed, 'seed-A')
  assert.equal(sharePayload.mcParams?.initialValue, 100_000)
})

test('canonical taxable withdrawal keeps market growth separate from taxes and basis', () => {
  const result = calculateWithdrawalProjection(taxableWithdrawal)
  const year = result.yearData[0]

  assert.equal(year.withdrawals, 20_000)
  assert.equal(year.netIncome, 18_200)
  assert.equal(year.taxWithheld, 1_800)
  assert.equal(year.marketGrowth, 0)
  assert.equal(year.grossEndingBalance, 80_000)
  assert.equal(year.endingCostBasis, 32_000)
  assert.equal(result.remainingEmbeddedTax, 7_200)
  assert.equal(result.endingBalance, 72_800)
})

test('withdrawal workbook Total row uses canonical market growth and raw financial numbers', () => {
  const result = calculateWithdrawalProjection(taxableWithdrawal)
  const workbook = buildWithdrawalWorkbook(taxableWithdrawal, result, '$')
  const sheet = workbook.getWorksheet('Balance By Year')
  assert.ok(sheet)

  const totalRow = sheet.getRow(sheet.rowCount)
  const headerToColumn = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, columnNumber) => headerToColumn.set(String(cell.value), columnNumber))
  const value = (header: string) => totalRow.getCell(headerToColumn.get(header) ?? 0).value

  assert.equal(value('Withdrawals (Gross)'), 20_000)
  assert.equal(value('After-Tax Spending'), 18_200)
  assert.equal(value('Withdrawal Tax'), 1_800)
  assert.equal(value('Market Growth'), 0)
  assert.equal(typeof value('Market Growth'), 'number')
  assert.equal(value('Starting Balance (Spendable)'), null)
  assert.equal(value('Ending Cost Basis'), null)
  assert.equal(value('Ending Balance (Spendable)'), null)
  assert.equal(value('Sustainable'), null)
  assert.equal(sheet.views[0]?.state, 'frozen')
  assert.equal(sheet.views[0]?.ySplit, 1)
  assert.equal(sheet.views[0]?.showGridLines, false)
  assert.match(totalRow.getCell(headerToColumn.get('Withdrawals (Gross)') ?? 0).numFmt, /\$/)
  assert.match(totalRow.getCell(headerToColumn.get('Market Growth') ?? 0).numFmt, /\$/)
  assert.equal(sheet.getRow(1).getCell(1).fill.type, 'pattern')
})

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()

  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
  has(key: string) { return this.values.has(key) }
}

test('Reset removes only Portfolio Simulator-owned storage keys', () => {
  const storage = new MemoryStorage()
  storage.setItem('growth-mode-state', '{}')
  storage.setItem('mc-seed-growth', 'seed')
  storage.setItem('portfolio-sim-show-donations', 'true')
  storage.setItem('unrelated-site-preference', 'keep-me')

  clearPortfolioStorage(storage)
  assert.equal(storage.has('growth-mode-state'), false)
  assert.equal(storage.has('mc-seed-growth'), false)
  assert.equal(storage.has('portfolio-sim-show-donations'), false)
  assert.equal(storage.has('unrelated-site-preference'), true)
})

test('deterministic range validation rejects non-finite and overflow scenarios without weakening normal inputs', () => {
  const normal: GrowthState = {
    startingBalance: 10_000,
    annualReturn: 8,
    duration: 30,
    periodicAddition: 500,
    frequency: 'monthly',
    inflationAdjustment: 2.5,
  }
  assert.equal(validateGrowthStateRange(normal), null)
  assert.match(validateGrowthStateRange({ ...normal, startingBalance: Number.POSITIVE_INFINITY }) ?? '', /finite/i)
  assert.match(validateGrowthStateRange({
    ...normal,
    startingBalance: 1e18,
    periodicAddition: 1e18,
    annualReturn: 100_000,
    duration: 200,
  }) ?? '', /safe numeric range/i)
})

test('goal probability is terminal-value probability with strongly named result fields', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 0,
    cashflowFrequency: 'yearly',
    numPaths: 10,
    portfolioGoal: 100,
  }, 'growth', 'terminal-goal')
  assert.equal(result.endingAtOrAboveGoalProbability, 100)
  assert.equal(result.pathsEndingAtOrAboveGoal, 10)
  assert.equal('goalProbability' in result, false)
  assert.equal('pathsReachingGoal' in result, false)
})

test('PWA manifest declares truthful any and maskable 192/512 PNG icons with safe padding', async () => {
  const publicDirectory = path.join(process.cwd(), 'public')
  const manifest = JSON.parse(await readFile(path.join(publicDirectory, 'manifest.json'), 'utf8')) as {
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>
  }

  for (const size of [192, 512]) {
    for (const purpose of ['any', 'maskable']) {
      const icon = manifest.icons.find((entry) => entry.sizes === `${size}x${size}` && entry.purpose === purpose)
      assert.ok(icon, `missing ${purpose} ${size}px icon`)
      assert.equal(icon.type, 'image/png')
      const file = path.join(publicDirectory, icon.src.replace(/^\//, ''))
      const metadata = await sharp(file).metadata()
      assert.equal(metadata.width, size)
      assert.equal(metadata.height, size)

      if (purpose === 'maskable') {
        const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
        const background = [7, 20, 12]
        let minX = size
        let minY = size
        let maxX = -1
        let maxY = -1
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const offset = (y * info.width + x) * info.channels
            const differs = background.some((channel, index) => Math.abs(data[offset + index] - channel) > 10)
            if (!differs) continue
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
        assert.ok(minX >= Math.floor(size * 0.14) && minY >= Math.floor(size * 0.14))
        assert.ok(maxX <= Math.ceil(size * 0.86) && maxY <= Math.ceil(size * 0.86))
      }
    }
  }
})

test('Excel exports format interest earnings in the selected display currency', () => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Value By Year')
  worksheet.columns = [{ header: 'Interest Earned', key: 'interest', width: 20 }]
  worksheet.addRow({ interest: 800 })

  formatFinancialWorkbook(workbook, '€')

  assert.match(worksheet.getCell('A2').numFmt, /€/)
})
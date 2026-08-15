import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGrowthProjection } from './simulation/growth-engine'
import { calculateWithdrawalProjection } from './simulation/withdrawal-engine'
import {
  MAX_SHARE_PAYLOAD_LENGTH,
  isValidGrowthState,
  validateGrowthStateRange,
} from './simulation/deterministic-validation'
import { decodeSharePayload, validateSharePayload } from './share-links'
import { buildWithdrawalWorkbook } from './export/withdrawal-workbook'

const baseGrowthState = {
  startingBalance: 10_000,
  annualReturn: 8,
  duration: 30,
  periodicAddition: 500,
  frequency: 'monthly' as const,
  inflationAdjustment: 2.5,
}

const closeTo = (actual: number, expected: number, tolerance = 0.01) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} was not within ${tolerance} of ${expected}`,
  )
}

test('deterministic scenarios reject durations beyond the browser-safe limit', () => {
  assert.match(
    validateGrowthStateRange({ ...baseGrowthState, duration: 201 }) ?? '',
    /no more than 200 years/i,
  )
  assert.throws(
    () => calculateGrowthProjection({ ...baseGrowthState, duration: 201 }),
    /no more than 200 years/i,
  )
})

test('shared payload decoding rejects oversized encoded input before decompression', () => {
  assert.equal(decodeSharePayload('x'.repeat(MAX_SHARE_PAYLOAD_LENGTH + 1)), null)
})

test('canonical state validation rejects tax rates outside the supported UI range', () => {
  assert.equal(isValidGrowthState({ ...baseGrowthState, taxEnabled: true, taxRate: 100 }), false)
  assert.equal(validateSharePayload({
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: { ...baseGrowthState, taxEnabled: true, taxRate: 100 },
  }), null)
})

test('validated Monte Carlo share payload preserves display settings', () => {
  const payload = validateSharePayload({
    mode: 'growth',
    type: 'monte-carlo',
    deterministicParams: baseGrowthState,
    mcParams: {
      initialValue: 10_000,
      expectedReturn: 7,
      volatility: 10,
      duration: 30,
      cashflowAmount: 500,
      cashflowFrequency: 'monthly',
      numPaths: 500,
    },
    rngSeed: 'shared-seed',
    logScales: { chart: true, histogram: false, drawdown: true },
    showFullPrecision: true,
  })

  assert.ok(payload)
  assert.deepEqual(payload.logScales, { chart: true, histogram: false, drawdown: true })
  assert.equal(payload.showFullPrecision, true)
})

test('income-tax withdrawal reporting keeps gross and spendable balances separate', () => {
  const state = {
    startingBalance: 100_000,
    annualReturn: 10,
    duration: 1,
    periodicWithdrawal: 10_000,
    inflationAdjustment: 0,
    frequency: 'yearly' as const,
    taxEnabled: true,
    taxType: 'income' as const,
    taxRate: 20,
  }
  const result = calculateWithdrawalProjection(state)
  const row = result.yearData[0]

  closeTo(row.grossStartingBalance, 100_000)
  closeTo(row.grossEndingBalance, 99_000)
  closeTo(row.endingBalanceNet, 97_200)
  closeTo(result.endingBalanceGross, 99_000)
  closeTo(result.endingBalanceNet, 97_200)
  closeTo(result.totalTaxDrag, 1_800)

  const workbook = buildWithdrawalWorkbook(state, result)
  const sheet = workbook.getWorksheet('Balance By Year')
  assert.ok(sheet)
  const headers = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, column) => headers.set(String(cell.value), column))
  assert.equal(sheet.getRow(2).getCell(headers.get('Ending Balance (Gross)') ?? 0).value, 99_000)
  assert.equal(sheet.getRow(2).getCell(headers.get('Ending Balance (Spendable)') ?? 0).value, 97_200)
})

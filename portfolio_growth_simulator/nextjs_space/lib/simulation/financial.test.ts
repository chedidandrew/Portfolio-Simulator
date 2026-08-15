import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGrowthProjection } from './growth-engine'
import { calculateWithdrawalProjection } from './withdrawal-engine'
import { performMonteCarloSimulation } from './monte-carlo-engine'
import { calculatePercentile, toTodaysDollars } from './financial-utils'
import { formatFinancialHorizon } from '../financial-horizon'

const closeTo = (actual: number, expected: number, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`)
}

test('deterministic effective annual growth matches compound-interest math', () => {
  const result = calculateGrowthProjection({
    startingBalance: 10_000,
    annualReturn: 10,
    duration: 10,
    periodicAddition: 0,
    frequency: 'monthly',
    inflationAdjustment: 0,
  })
  closeTo(result.finalValue, 10_000 * Math.pow(1.1, 10), 0.01)
})

test('deterministic contributions include every payment and apply annual inflation only to later years', () => {
  const oneYear = calculateGrowthProjection({
    startingBalance: 0,
    annualReturn: 0,
    duration: 1,
    periodicAddition: 100,
    frequency: 'monthly',
    inflationAdjustment: 0,
  })
  closeTo(oneYear.finalValue, 1_200, 0.01)

  const twoYearsInflated = calculateGrowthProjection({
    startingBalance: 0,
    annualReturn: 0,
    duration: 2,
    periodicAddition: 100,
    frequency: 'monthly',
    inflationAdjustment: 10,
  })
  closeTo(twoYearsInflated.finalValue, 2_520, 0.01)
})

test('growth income-tax row reports canonical $200 drag and reconciles to $10,600 spendable value', () => {
  const result = calculateGrowthProjection({
    startingBalance: 10_000,
    annualReturn: 8,
    duration: 1,
    periodicAddition: 0,
    frequency: 'yearly',
    inflationAdjustment: 0,
    taxEnabled: true,
    taxType: 'income',
    taxRate: 25,
  })
  const row = result.yearData[0]
  closeTo(row.interest, 800, 0.01)
  closeTo(row.taxPaid, 200, 0.01)
  closeTo(row.grossEndingValue, 10_800, 0.01)
  closeTo(row.endingValue, 10_600, 0.01)
  closeTo(row.startingValue + row.interest - row.taxPaid + row.contributions, row.endingValue, 0.01)
})

test('every growth tax mode exposes row values that reconcile without component-side tax math', () => {
  for (const tax of [
    { taxEnabled: false, taxType: 'capital_gains' as const },
    { taxEnabled: true, taxType: 'capital_gains' as const },
    { taxEnabled: true, taxType: 'tax_deferred' as const },
    { taxEnabled: true, taxType: 'income' as const },
  ]) {
    const result = calculateGrowthProjection({
      startingBalance: 100_000,
      startingCostBasis: 40_000,
      annualReturn: 8,
      duration: 2,
      periodicAddition: 1_000,
      frequency: 'quarterly',
      inflationAdjustment: 0,
      taxRate: 15,
      ...tax,
    })
    for (const row of result.yearData) {
      closeTo(row.grossStartingValue + row.interest + row.contributions, row.grossEndingValue, 0.01)
      closeTo(
        row.startingValue + row.interest - row.taxPaid - row.changeInEmbeddedTax + row.contributions,
        row.endingValue,
        0.01,
      )
    }
  }
})

test('growth total invested remains starting market value plus contributions in every tax mode', () => {
  for (const tax of [
    { taxEnabled: false, taxType: 'capital_gains' as const },
    { taxEnabled: true, taxType: 'capital_gains' as const },
    { taxEnabled: true, taxType: 'tax_deferred' as const },
    { taxEnabled: true, taxType: 'income' as const },
  ]) {
    const result = calculateGrowthProjection({
      startingBalance: 100_000,
      startingCostBasis: 40_000,
      annualReturn: 0,
      duration: 2,
      periodicAddition: 500,
      frequency: 'monthly',
      inflationAdjustment: 0,
      taxRate: 15,
      ...tax,
    })
    closeTo(result.yearData[0].totalInvested, 106_000, 0.01)
    closeTo(result.yearData[1].totalInvested, 112_000, 0.01)
    closeTo(result.totalInvested, 112_000, 0.01)
  }
})

test('financial horizon formatting preserves weekly, monthly, quarterly, and yearly periods', () => {
  assert.equal(formatFinancialHorizon({ years: 1 / 52, periods: 1, frequency: 'weekly' }), '1 week')
  assert.equal(formatFinancialHorizon({ years: 0.5, periods: 6, frequency: 'monthly' }), '6 months')
  assert.equal(formatFinancialHorizon({ years: 0.5, periods: 2, frequency: 'quarterly' }), '6 months')
  assert.equal(formatFinancialHorizon({ years: 1, periods: 1, frequency: 'yearly' }), '1 year')
  assert.equal(formatFinancialHorizon({ years: 1.5 }), '1 year, 6 months')
})

test('annual income tax drag never improves a negative expected return', () => {
  const untaxed = calculateGrowthProjection({
    startingBalance: 10_000,
    annualReturn: -20,
    duration: 1,
    periodicAddition: 0,
    frequency: 'yearly',
    inflationAdjustment: 0,
  })
  const taxed = calculateGrowthProjection({
    startingBalance: 10_000,
    annualReturn: -20,
    duration: 1,
    periodicAddition: 0,
    frequency: 'yearly',
    inflationAdjustment: 0,
    taxEnabled: true,
    taxType: 'income',
    taxRate: 30,
  })
  closeTo(taxed.finalValueNet, untaxed.finalValueNet, 0.01)
  closeTo(taxed.totalTaxDrag, 0, 0.01)
})

test('capital-gains liquidation uses the supplied starting cost basis', () => {
  const result = calculateGrowthProjection({
    startingBalance: 100_000,
    startingCostBasis: 40_000,
    annualReturn: 0,
    duration: 1,
    periodicAddition: 0,
    frequency: 'yearly',
    inflationAdjustment: 0,
    taxEnabled: true,
    taxType: 'capital_gains',
    taxRate: 15,
  })
  closeTo(result.finalValueNet, 91_000, 0.01)
  closeTo(result.totalDeferredTax, 9_000, 0.01)
})

test('withdrawal tax accounting separates gross distribution from spendable cash', () => {
  const result = calculateWithdrawalProjection({
    startingBalance: 100_000,
    annualReturn: 0,
    duration: 1,
    periodicWithdrawal: 10_000,
    inflationAdjustment: 0,
    frequency: 'yearly',
    taxEnabled: true,
    taxType: 'tax_deferred',
    taxRate: 20,
  })
  closeTo(result.totalWithdrawn, 10_000, 0.01)
  closeTo(result.totalWithdrawnNet, 8_000, 0.01)
  closeTo(result.totalTaxWithheld, 2_000, 0.01)
  closeTo(result.endingBalanceGross, 90_000, 0.01)
  closeTo(result.endingBalanceNet, 72_000, 0.01)
})

test('Monte Carlo zero-volatility result matches deterministic CAGR', () => {
  const result = performMonteCarloSimulation({
    initialValue: 10_000,
    expectedReturn: 7,
    volatility: 0,
    duration: 10,
    cashflowAmount: 0,
    cashflowFrequency: 'monthly',
    inflationAdjustment: 0,
    numPaths: 100,
  }, 'growth', 'zero-volatility')
  closeTo(result.median, 10_000 * Math.pow(1.07, 10), 0.02)
  closeTo(result.p5, result.p95, 0.01)
})

test('Monte Carlo results are reproducible with the same seed', () => {
  const params = {
    initialValue: 25_000,
    expectedReturn: 7,
    volatility: 12,
    duration: 2,
    cashflowAmount: 250,
    cashflowFrequency: 'monthly' as const,
    inflationAdjustment: 2,
    numPaths: 20,
  }
  const first = performMonteCarloSimulation(params, 'growth', 'repeatable-seed')
  const repeated = performMonteCarloSimulation(params, 'growth', 'repeatable-seed')
  assert.deepEqual(repeated.endingValues, first.endingValues)
})

test('withdrawals do not count as market drawdown or market loss', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 1_000,
    cashflowFrequency: 'monthly',
    inflationAdjustment: 0,
    numPaths: 50,
  }, 'withdrawal', 'withdrawal-risk')
  closeTo(result.maxDrawdowns[0], 0, 1e-10)
  closeTo(result.lossProbData.find((row: any) => row.threshold === '>= 10%')?.intraPeriod ?? -1, 0, 1e-10)
})

test('contributions cannot hide investment losses in risk statistics', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: -20,
    volatility: 0,
    duration: 1,
    cashflowAmount: 100_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 20,
  }, 'growth', 'contribution-risk')
  assert.ok(result.maxDrawdowns[0] >= 0.199999)
  closeTo(result.lossProbData.find((row: any) => row.threshold === '>= 15%')?.endPeriod ?? -1, 100, 1e-10)
})

test('profit probability uses current market value, not tax cost basis', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    startingCostBasis: 40_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 0,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 20,
    taxEnabled: true,
    taxType: 'capital_gains',
    taxRate: 15,
  }, 'growth', 'profit-basis')
  closeTo(result.profitableRate, 0, 1e-10)
})

test('real cumulative contributions discount each contribution at its payment time', () => {
  const result = performMonteCarloSimulation({
    initialValue: 0,
    expectedReturn: 0,
    volatility: 0,
    duration: 2,
    cashflowAmount: 1_200,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 10,
    excludeInflationAdjustment: true,
    numPaths: 5,
  }, 'growth', 'real-cashflow')
  const final = result.investmentData[result.investmentData.length - 1]
  const expected = toTodaysDollars(1_200, 10, 1) + toTodaysDollars(1_200, 10, 2)
  closeTo(final.realContributions, expected, 0.01)
})

test('excessive workloads are rejected before simulation begins', () => {
  assert.throws(() => performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 7,
    volatility: 10,
    duration: 200,
    cashflowAmount: 100,
    cashflowFrequency: 'weekly',
    inflationAdjustment: 0,
    numPaths: 110_000,
  }, 'growth', 'too-large'), /path-period calculations/)
})

test('percentile interpolation is linear', () => {
  closeTo(calculatePercentile([0, 10], 0.25), 2.5)
})

test('Monte Carlo retirement tax reporting includes remaining embedded tax', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 10_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 20,
    taxEnabled: true,
    taxType: 'tax_deferred',
    taxRate: 20,
  }, 'withdrawal', 'remaining-tax')
  closeTo(result.totalTaxWithheld, 2_000, 0.01)
  closeTo(result.remainingEmbeddedTax, 18_000, 0.01)
  closeTo(result.totalTaxCost, 20_000, 0.01)
})

test('Monte Carlo income-tax drag does not improve negative-return paths', () => {
  const base = {
    initialValue: 10_000,
    expectedReturn: -20,
    volatility: 0,
    duration: 1,
    cashflowAmount: 0,
    cashflowFrequency: 'yearly' as const,
    inflationAdjustment: 0,
    numPaths: 20,
  }
  const untaxed = performMonteCarloSimulation(base, 'growth', 'negative-return')
  const taxed = performMonteCarloSimulation({
    ...base,
    taxEnabled: true,
    taxType: 'income',
    taxRate: 30,
  }, 'growth', 'negative-return')
  closeTo(taxed.median, untaxed.median, 0.01)
  closeTo(taxed.totalTaxDrag, 0, 0.01)
})

test('deterministic real contribution total discounts every payment separately', () => {
  const result = calculateGrowthProjection({
    startingBalance: 0,
    annualReturn: 0,
    duration: 2,
    periodicAddition: 1_200,
    frequency: 'yearly',
    inflationAdjustment: 10,
    excludeInflationAdjustment: true,
  })
  const expected = toTodaysDollars(1_200, 10, 1) + toTodaysDollars(1_200, 10, 2)
  closeTo(result.periodicContributionsInTodaysDollars, expected, 0.01)
})

test('deterministic withdrawal is sustainable when the final scheduled payment exactly depletes the portfolio', () => {
  const result = calculateWithdrawalProjection({
    startingBalance: 100_000,
    annualReturn: 0,
    duration: 1,
    periodicWithdrawal: 100_000,
    inflationAdjustment: 0,
    frequency: 'yearly',
  })
  closeTo(result.totalWithdrawn, 100_000, 0.01)
  closeTo(result.endingBalanceGross, 0, 0.01)
  assert.equal(result.isSustainable, true)
  assert.equal(result.yearsUntilZero, null)
})

test('Monte Carlo withdrawal success counts a fully funded final payment even when ending balance is zero', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 100_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 20,
  }, 'withdrawal', 'exact-horizon')
  closeTo(result.median, 0, 0.01)
  closeTo(result.solventRate, 100, 1e-10)
  closeTo(result.solvencySeries[result.solvencySeries.length - 1].solventRate, 100, 1e-10)
})

test('Monte Carlo investment data reports realized rather than scheduled withdrawals after depletion', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 3,
    cashflowAmount: 80_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 20,
  }, 'withdrawal', 'realized-withdrawals')
  const final = result.investmentData[result.investmentData.length - 1]
  closeTo(result.medianGrossWithdrawn, 100_000, 0.01)
  closeTo(final.withdrawals, 100_000, 0.01)
  closeTo(final.netSpending ?? 0, 100_000, 0.01)
  closeTo(result.solventRate, 0, 1e-10)
})

test('Monte Carlo retirement cashflow data separates realized gross spending and taxes', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 10_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 20,
    taxEnabled: true,
    taxType: 'tax_deferred',
    taxRate: 20,
  }, 'withdrawal', 'cashflow-tax-breakdown')
  const final = result.investmentData[result.investmentData.length - 1]
  closeTo(final.withdrawals, 10_000, 0.01)
  closeTo(final.netSpending ?? 0, 8_000, 0.01)
  closeTo(final.taxesPaid ?? 0, 2_000, 0.01)
})


test('representative retirement cashflow breakdown uses one actual median-ending path and reconciles', () => {
  const result = performMonteCarloSimulation({
    initialValue: 500_000,
    startingCostBasis: 250_000,
    expectedReturn: 6,
    volatility: 18,
    duration: 20,
    cashflowAmount: 24_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 2,
    numPaths: 500,
    taxEnabled: true,
    taxType: 'capital_gains',
    taxRate: 15,
  }, 'withdrawal', 'representative-cashflow')

  const breakdown = result.representativeCashflowBreakdown
  if (!breakdown) throw new Error('Expected representative retirement cashflow breakdown.')
  closeTo(breakdown.grossWithdrawn, breakdown.netSpending + breakdown.withdrawalTaxes, 0.01)
  closeTo(breakdown.taxesPaid, breakdown.withdrawalTaxes + breakdown.incomeTaxDrag, 0.01)
  closeTo(
    breakdown.grossWithdrawnInTodaysDollars,
    breakdown.netSpendingInTodaysDollars + breakdown.withdrawalTaxesInTodaysDollars,
    0.01,
  )
})

test('Monte Carlo deterministic comparison uses full-horizon withdrawal fulfillment for sustainability', () => {
  const result = performMonteCarloSimulation({
    initialValue: 100_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 1,
    cashflowAmount: 100_000,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 5,
  }, 'withdrawal', 'deterministic-comparison-horizon')

  const finalYear = result.deterministicYearData[result.deterministicYearData.length - 1]
  assert.ok(finalYear)
  closeTo(finalYear.endingBalance, 0, 0.01)
  assert.equal(finalYear.isSustainable, true)
})

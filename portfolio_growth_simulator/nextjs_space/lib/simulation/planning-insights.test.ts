import test from 'node:test'
import assert from 'node:assert/strict'
import type { SimulationParams } from '../types'
import type { SimulationResults } from './monte-carlo-engine'
import { performMonteCarloSimulation } from './monte-carlo-engine'
import {
  calculateGoalShortfallInsight,
  estimateRequiredContribution,
  estimateSustainableWithdrawal,
  sustainableWithdrawalStartingPortfolio,
  type PlanningSimulationRunner,
  type SustainableWithdrawalAssumptions,
} from './planning-insights'
import { summarizeDrawdownDurations } from './drawdown-analysis'

const growthParams: SimulationParams = {
  initialValue: 10_000,
  expectedReturn: 7,
  volatility: 10,
  duration: 30,
  cashflowAmount: 500,
  cashflowFrequency: 'monthly',
  inflationAdjustment: 2.5,
  numPaths: 500,
  portfolioGoal: 1_000_000,
}

function resultStub(values: Partial<SimulationResults>): SimulationResults {
  return values as SimulationResults
}

test('goal shortfall reports terminal miss risk and median miss size', () => {
  const insight = calculateGoalShortfallInsight(100, resultStub({
    endingValues: [20, 60, 100, 140],
    endingAtOrAboveGoalProbability: 50,
  }))
  assert.ok(insight)
  assert.equal(insight.shortfallRisk, 50)
  assert.equal(insight.typicalShortfall, 60)
  assert.equal(insight.worstCaseShortfall, 80)
  assert.equal(insight.missedScenarios, 2)
})

test('goal shortfall handles an all-success run without NaN values', () => {
  const insight = calculateGoalShortfallInsight(100, resultStub({
    endingValues: [100, 120, 150],
    endingAtOrAboveGoalProbability: 100,
  }))
  assert.ok(insight)
  assert.equal(insight.allScenariosEndedAtOrAboveGoal, true)
  assert.equal(insight.typicalShortfall, 0)
  assert.equal(insight.worstCaseShortfall, 0)
})

test('required contribution search reuses monthly cashflows and returns a conservative rounded amount', async () => {
  const runner: PlanningSimulationRunner = async (params) => resultStub({
    endingAtOrAboveGoalProbability: Math.min(100, params.cashflowAmount / 10),
  })
  const estimate = await estimateRequiredContribution(
    { ...growthParams, cashflowAmount: 200 },
    90,
    'goal-search-seed',
    { runSimulation: runner },
  )
  assert.equal(estimate.requiredMonthlyContribution, 900)
  assert.equal(estimate.currentMonthlyContribution, 200)
  assert.equal(estimate.additionalMonthlyContribution, 700)
  assert.equal(estimate.currentContributionIsSufficient, false)
})

test('required contribution can search below the current contribution to zero', async () => {
  const runner: PlanningSimulationRunner = async () => resultStub({ endingAtOrAboveGoalProbability: 95 })
  const estimate = await estimateRequiredContribution(
    growthParams,
    90,
    'already-funded-seed',
    { runSimulation: runner },
  )
  assert.equal(estimate.requiredMonthlyContribution, 0)
  assert.equal(estimate.currentContributionIsSufficient, true)
})

test('tax-deferred sustainable withdrawal handoff uses the gross median exactly once', () => {
  const source = sustainableWithdrawalStartingPortfolio(
    { ...growthParams, taxEnabled: true, taxType: 'tax_deferred' },
    resultStub({ median: 800_000, medianGross: 1_000_000 }),
  )
  assert.equal(source.value, 1_000_000)
  assert.equal(source.usesGrossTaxDeferredBalance, true)
})

test('sustainable withdrawal search respects both survival and preservation targets', async () => {
  const runner: PlanningSimulationRunner = async (params) => {
    const monthly = params.cashflowAmount
    return resultStub({
      median: 100_000 + 12_000 - monthly * 12,
      medianGross: 100_000 + 12_000 - monthly * 12,
      solventRate: Math.max(0, 100 - monthly / 100),
    })
  }
  const assumptions: SustainableWithdrawalAssumptions = {
    retirementDuration: 1,
    expectedReturn: 5,
    volatility: 6,
    enableCrashRisk: false,
    inflationAdjustedWithdrawals: false,
    preservationObjective: 'nominal_principal',
    targetSurvivalRate: 90,
    payoutFrequency: 'monthly',
    includeTaxes: false,
  }
  const estimate = await estimateSustainableWithdrawal(
    growthParams,
    resultStub({ median: 100_000, medianGross: 100_000 }),
    assumptions,
    'withdrawal-search-seed',
    { runSimulation: runner },
  )
  assert.ok(estimate.monthlyWithdrawal >= 999 && estimate.monthlyWithdrawal <= 1_000)
  assert.ok(estimate.survivalRate >= 90)
  assert.ok(estimate.medianEndingBalance >= 100_000)
})

test('withdrawal engine records exact depletion timing and horizon survival', () => {
  const results = performMonteCarloSimulation({
    initialValue: 1_000,
    expectedReturn: 0,
    volatility: 0,
    duration: 3,
    cashflowAmount: 600,
    cashflowFrequency: 'yearly',
    inflationAdjustment: 0,
    numPaths: 10,
  }, 'withdrawal', 'depletion-timing-seed')

  assert.deepEqual(results.depletionYears, Array(10).fill(2))
  assert.equal(results.medianDepletionYear, 2)
  assert.equal(results.neverDepletedRate, 0)
  assert.equal(results.survivalRate, 0)
  assert.equal(results.solvencySeries.at(-1)?.solventRate, 0)
})

test('drawdown duration summary separates recovery from unrecovered scenarios', () => {
  const summary = summarizeDrawdownDurations([
    { maxDrawdown: 0.20, durationYears: 1, recovered: true },
    { maxDrawdown: 0.30, durationYears: 3, recovered: true },
    { maxDrawdown: 0.40, durationYears: 5, recovered: false },
    { maxDrawdown: 0, durationYears: 0, recovered: true },
  ])
  assert.ok(summary)
  assert.equal(summary.medianDepth, 0.25)
  assert.equal(summary.medianDuration, 2)
  assert.equal(summary.longestDuration, 5)
  assert.equal(summary.recoveryRate, 75)
  assert.equal(summary.notRecoveredRate, 25)
  assert.equal(summary.medianRecoveryTime, 2)
})

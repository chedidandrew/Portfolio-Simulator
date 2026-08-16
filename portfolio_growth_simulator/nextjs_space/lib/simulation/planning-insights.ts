import type { CashflowFrequency, SimulationParams } from '../types'
import type { SimulationResults } from './monte-carlo-engine'
import { runMonteCarloOffMainThread } from './monte-carlo-client'
import { calculatePercentile, stepsPerYear } from './financial-utils'

export type GoalConfidenceLevel = 50 | 75 | 90 | 95
export type SustainableWithdrawalObjective = 'purchasing_power' | 'nominal_principal'

export interface GoalShortfallInsight {
  goal: number
  shortfallRisk: number
  typicalShortfall: number
  worstCaseShortfall: number
  missedScenarios: number
  totalScenarios: number
  allScenariosEndedAtOrAboveGoal: boolean
}

export interface RequiredContributionEstimate {
  confidenceLevel: GoalConfidenceLevel
  requiredMonthlyContribution: number
  currentMonthlyContribution: number
  additionalMonthlyContribution: number
  currentContributionIsSufficient: boolean
  achievedProbability: number
  scenariosUsed: number
  capped: boolean
}

export interface SustainableWithdrawalAssumptions {
  retirementDuration: number
  expectedReturn: number
  volatility: number
  enableCrashRisk: boolean
  inflationAdjustedWithdrawals: boolean
  preservationObjective: SustainableWithdrawalObjective
  targetSurvivalRate: number
  payoutFrequency: CashflowFrequency
  includeTaxes: boolean
}

export interface SustainableWithdrawalEstimate {
  startingPortfolio: number
  monthlyWithdrawal: number
  annualWithdrawal: number
  selectedPayoutAmount: number
  payoutFrequency: CashflowFrequency
  withdrawalRate: number
  medianEndingBalance: number
  survivalRate: number
  targetSurvivalRate: number
  preservationTarget: number
  preservationObjective: SustainableWithdrawalObjective
  retirementDuration: number
  expectedReturn: number
  volatility: number
  enableCrashRisk: boolean
  inflationAdjustedWithdrawals: boolean
  includeTaxes: boolean
  scenariosUsed: number
  capped: boolean
  sourceUsesGrossTaxDeferredBalance: boolean
}

export interface PlanningEstimateProgress {
  fraction: number
  completedRuns: number
  estimatedRuns: number
  phase: 'preparing' | 'searching' | 'verifying' | 'complete'
  detail: string
}

export type PlanningSimulationRunner = (
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed: string,
  signal?: AbortSignal,
) => Promise<SimulationResults>

const MAX_PLANNING_SCENARIOS = 1_000
const MIN_PLANNING_SCENARIOS = 250
const MAX_PATH_PERIODS_PER_ESTIMATE_RUN = 1_200_000
const SEARCH_ITERATIONS = 13
const MAX_CONTRIBUTION = 1_000_000_000_000
const EPSILON = 1e-9

function abortError(): Error {
  const error = new Error('Planning estimate cancelled.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}

function boundedPercent(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
}

function planningScenarioCount(duration: number): number {
  const monthlySteps = Math.max(1, Math.round(Math.max(duration, 1) * 12))
  const workBound = Math.floor(MAX_PATH_PERIODS_PER_ESTIMATE_RUN / monthlySteps)
  return Math.max(MIN_PLANNING_SCENARIOS, Math.min(MAX_PLANNING_SCENARIOS, workBound))
}

function progressReporter(
  onProgress: ((progress: PlanningEstimateProgress) => void) | undefined,
  estimatedRuns: number,
) {
  let completedRuns = 0
  const report = (phase: PlanningEstimateProgress['phase'], detail: string, forceFraction?: number) => {
    const fraction = forceFraction ?? Math.min(0.98, completedRuns / Math.max(estimatedRuns, 1))
    onProgress?.({ fraction, completedRuns, estimatedRuns, phase, detail })
  }
  return {
    report,
    completed(detail: string) {
      completedRuns += 1
      report('searching', detail)
    },
    finish(detail: string) {
      onProgress?.({ fraction: 1, completedRuns, estimatedRuns, phase: 'complete', detail })
    },
  }
}

export function calculateGoalShortfallInsight(
  goal: number,
  results: Pick<SimulationResults, 'endingValues' | 'endingAtOrAboveGoalProbability'>,
): GoalShortfallInsight | null {
  if (!Number.isFinite(goal) || goal <= 0 || !results.endingValues.length) return null

  const shortfalls = results.endingValues
    .filter((value) => value < goal)
    .map((value) => Math.max(goal - value, 0))
    .sort((left, right) => left - right)
  const totalScenarios = results.endingValues.length
  const missedScenarios = shortfalls.length
  const allScenariosEndedAtOrAboveGoal = missedScenarios === 0

  return {
    goal,
    shortfallRisk: allScenariosEndedAtOrAboveGoal
      ? 0
      : boundedPercent(100 - results.endingAtOrAboveGoalProbability),
    typicalShortfall: allScenariosEndedAtOrAboveGoal
      ? 0
      : calculatePercentile(shortfalls, 0.5),
    worstCaseShortfall: allScenariosEndedAtOrAboveGoal
      ? 0
      : shortfalls[shortfalls.length - 1] ?? 0,
    missedScenarios,
    totalScenarios,
    allScenariosEndedAtOrAboveGoal,
  }
}

export function monthlyContributionFromParams(params: SimulationParams): number {
  return Math.max(0, params.cashflowAmount) * stepsPerYear(params.cashflowFrequency) / 12
}

function monthlyContributionParams(
  params: SimulationParams,
  monthlyContribution: number,
  scenarios: number,
): SimulationParams {
  return {
    ...params,
    cashflowAmount: Math.max(0, monthlyContribution),
    cashflowFrequency: 'monthly',
    numPaths: scenarios,
  }
}

export async function estimateRequiredContribution(
  params: SimulationParams,
  confidenceLevel: GoalConfidenceLevel,
  seed: string,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: PlanningEstimateProgress) => void
    runSimulation?: PlanningSimulationRunner
  } = {},
): Promise<RequiredContributionEstimate> {
  const goal = params.portfolioGoal
  if (!Number.isFinite(goal) || !goal || goal <= 0) {
    throw new Error('Add a positive portfolio goal before calculating the required contribution.')
  }

  const runSimulation = options.runSimulation ?? runMonteCarloOffMainThread
  const scenarios = planningScenarioCount(params.duration)
  const currentMonthlyContribution = monthlyContributionFromParams(params)
  const targetProbability = boundedPercent(confidenceLevel)
  const maximumMonthlyContribution = Math.min(
    MAX_CONTRIBUTION,
    Math.max(1_000_000, goal, currentMonthlyContribution * 128),
  )
  const estimatedRuns = SEARCH_ITERATIONS + 10
  const progress = progressReporter(options.onProgress, estimatedRuns)
  progress.report('preparing', `Preparing ${scenarios.toLocaleString()} seeded scenarios per estimate...`, 0.01)

  const probabilityFor = async (monthlyContribution: number) => {
    throwIfAborted(options.signal)
    const result = await runSimulation(
      monthlyContributionParams(params, monthlyContribution, scenarios),
      'growth',
      seed,
      options.signal,
    )
    const probability = boundedPercent(result.endingAtOrAboveGoalProbability)
    progress.completed(`Tested ${Math.round(monthlyContribution).toLocaleString()} per month at ${probability.toFixed(1)}% confidence.`)
    return probability
  }

  let low = 0
  let high = Math.max(currentMonthlyContribution, 1)
  let highProbability = await probabilityFor(high)

  if (highProbability >= targetProbability) {
    const zeroProbability = await probabilityFor(0)
    if (zeroProbability >= targetProbability) {
      progress.finish('The goal confidence is already met without additional contributions.')
      return {
        confidenceLevel,
        requiredMonthlyContribution: 0,
        currentMonthlyContribution,
        additionalMonthlyContribution: 0,
        currentContributionIsSufficient: true,
        achievedProbability: zeroProbability,
        scenariosUsed: scenarios,
        capped: false,
      }
    }
  } else {
    low = high
    while (highProbability < targetProbability && high < maximumMonthlyContribution) {
      throwIfAborted(options.signal)
      high = Math.min(maximumMonthlyContribution, Math.max(high * 2, high + 1))
      highProbability = await probabilityFor(high)
    }

    if (highProbability < targetProbability) {
      progress.finish('The selected confidence was not reached within the estimator range.')
      return {
        confidenceLevel,
        requiredMonthlyContribution: maximumMonthlyContribution,
        currentMonthlyContribution,
        additionalMonthlyContribution: Math.max(maximumMonthlyContribution - currentMonthlyContribution, 0),
        currentContributionIsSufficient: false,
        achievedProbability: highProbability,
        scenariosUsed: scenarios,
        capped: true,
      }
    }
  }

  for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration += 1) {
    throwIfAborted(options.signal)
    const midpoint = (low + high) / 2
    const probability = await probabilityFor(midpoint)
    if (probability >= targetProbability) {
      high = midpoint
      highProbability = probability
    } else {
      low = midpoint
    }
  }

  progress.report('verifying', 'Verifying the rounded contribution estimate...', 0.96)
  const requiredMonthlyContribution = Math.max(0, Math.ceil(high - EPSILON))
  const achievedProbability = await probabilityFor(requiredMonthlyContribution)
  const currentContributionIsSufficient = currentMonthlyContribution + 0.5 >= requiredMonthlyContribution
  progress.finish('Required contribution estimate complete.')

  return {
    confidenceLevel,
    requiredMonthlyContribution,
    currentMonthlyContribution,
    additionalMonthlyContribution: Math.max(requiredMonthlyContribution - currentMonthlyContribution, 0),
    currentContributionIsSufficient,
    achievedProbability,
    scenariosUsed: scenarios,
    capped: false,
  }
}

export function sustainableWithdrawalStartingPortfolio(
  params: SimulationParams,
  results: Pick<SimulationResults, 'median' | 'medianGross'>,
): { value: number; usesGrossTaxDeferredBalance: boolean } {
  const usesGrossTaxDeferredBalance = Boolean(params.taxEnabled && params.taxType === 'tax_deferred')
  return {
    value: Math.max(0, usesGrossTaxDeferredBalance ? results.medianGross : results.median),
    usesGrossTaxDeferredBalance,
  }
}

export function sustainableWithdrawalPreservationTarget(
  startingPortfolio: number,
  assumptions: SustainableWithdrawalAssumptions,
  inflationAdjustment: number,
): number {
  if (assumptions.preservationObjective === 'nominal_principal') return startingPortfolio
  return startingPortfolio * Math.pow(1 + Math.max(inflationAdjustment, -99) / 100, assumptions.retirementDuration)
}

function sustainableWithdrawalParams(
  sourceParams: SimulationParams,
  assumptions: SustainableWithdrawalAssumptions,
  startingPortfolio: number,
  monthlyWithdrawal: number,
  scenarios: number,
): SimulationParams {
  const includeTaxes = assumptions.includeTaxes && Boolean(sourceParams.taxEnabled)
  return {
    initialValue: startingPortfolio,
    startingCostBasis: sourceParams.taxType === 'tax_deferred' ? undefined : startingPortfolio,
    costBasisIsUserEdited: false,
    expectedReturn: assumptions.expectedReturn,
    volatility: assumptions.volatility,
    enableCrashRisk: assumptions.enableCrashRisk,
    duration: assumptions.retirementDuration,
    cashflowAmount: Math.max(0, monthlyWithdrawal),
    cashflowFrequency: 'monthly',
    inflationAdjustment: sourceParams.inflationAdjustment ?? 0,
    excludeInflationAdjustment: !assumptions.inflationAdjustedWithdrawals,
    numPaths: scenarios,
    taxEnabled: includeTaxes,
    taxRate: includeTaxes ? sourceParams.taxRate : 0,
    taxType: includeTaxes ? sourceParams.taxType : 'capital_gains',
    calculationMode: sourceParams.calculationMode,
  }
}

function preservationMedian(
  result: SimulationResults,
  sourceParams: SimulationParams,
): number {
  return sourceParams.taxEnabled && sourceParams.taxType === 'tax_deferred'
    ? result.medianGross
    : result.median
}

export async function estimateSustainableWithdrawal(
  sourceParams: SimulationParams,
  sourceResults: Pick<SimulationResults, 'median' | 'medianGross'>,
  assumptions: SustainableWithdrawalAssumptions,
  seed: string,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: PlanningEstimateProgress) => void
    runSimulation?: PlanningSimulationRunner
  } = {},
): Promise<SustainableWithdrawalEstimate> {
  const runSimulation = options.runSimulation ?? runMonteCarloOffMainThread
  const source = sustainableWithdrawalStartingPortfolio(sourceParams, sourceResults)
  const startingPortfolio = source.value
  if (!Number.isFinite(startingPortfolio) || startingPortfolio <= 0) {
    throw new Error('A positive completed growth outcome is required for a withdrawal estimate.')
  }
  if (!Number.isFinite(assumptions.retirementDuration) || assumptions.retirementDuration <= 0) {
    throw new Error('Retirement duration must be positive.')
  }

  const scenarios = planningScenarioCount(assumptions.retirementDuration)
  const inflationAdjustment = sourceParams.inflationAdjustment ?? 0
  const preservationTarget = sustainableWithdrawalPreservationTarget(
    startingPortfolio,
    assumptions,
    inflationAdjustment,
  )
  const estimatedRuns = SEARCH_ITERATIONS + 10
  const progress = progressReporter(options.onProgress, estimatedRuns)
  progress.report('preparing', `Preparing ${scenarios.toLocaleString()} retirement scenarios per estimate...`, 0.01)

  const evaluate = async (monthlyWithdrawal: number) => {
    throwIfAborted(options.signal)
    const result = await runSimulation(
      sustainableWithdrawalParams(sourceParams, assumptions, startingPortfolio, monthlyWithdrawal, scenarios),
      'withdrawal',
      seed,
      options.signal,
    )
    const medianEndingBalance = preservationMedian(result, sourceParams)
    const survivalRate = boundedPercent(result.solventRate)
    const meetsObjective = medianEndingBalance + 0.01 >= preservationTarget
      && survivalRate + 1e-7 >= assumptions.targetSurvivalRate
    progress.completed(`Tested ${Math.round(monthlyWithdrawal).toLocaleString()} per month at ${survivalRate.toFixed(1)}% survival.`)
    return { result, medianEndingBalance, survivalRate, meetsObjective }
  }

  const zeroResult = await evaluate(0)
  if (!zeroResult.meetsObjective) {
    progress.finish('Even a zero withdrawal does not meet the selected preservation and survival targets.')
    return {
      startingPortfolio,
      monthlyWithdrawal: 0,
      annualWithdrawal: 0,
      selectedPayoutAmount: 0,
      payoutFrequency: assumptions.payoutFrequency,
      withdrawalRate: 0,
      medianEndingBalance: zeroResult.medianEndingBalance,
      survivalRate: zeroResult.survivalRate,
      targetSurvivalRate: assumptions.targetSurvivalRate,
      preservationTarget,
      preservationObjective: assumptions.preservationObjective,
      retirementDuration: assumptions.retirementDuration,
      expectedReturn: assumptions.expectedReturn,
      volatility: assumptions.volatility,
      enableCrashRisk: assumptions.enableCrashRisk,
      inflationAdjustedWithdrawals: assumptions.inflationAdjustedWithdrawals,
      includeTaxes: assumptions.includeTaxes && Boolean(sourceParams.taxEnabled),
      scenariosUsed: scenarios,
      capped: false,
      sourceUsesGrossTaxDeferredBalance: source.usesGrossTaxDeferredBalance,
    }
  }

  let low = 0
  let lowEvaluation = zeroResult
  let high = Math.max(1, startingPortfolio * 0.20 / 12)
  const maximumMonthlyWithdrawal = Math.max(high, startingPortfolio * 10 / 12)
  let highEvaluation = await evaluate(high)

  while (highEvaluation.meetsObjective && high < maximumMonthlyWithdrawal) {
    low = high
    lowEvaluation = highEvaluation
    high = Math.min(maximumMonthlyWithdrawal, high * 2)
    highEvaluation = await evaluate(high)
  }

  if (highEvaluation.meetsObjective && high >= maximumMonthlyWithdrawal) {
    const annualWithdrawal = high * 12
    progress.finish('The estimate reached its configured search ceiling.')
    return {
      startingPortfolio,
      monthlyWithdrawal: high,
      annualWithdrawal,
      selectedPayoutAmount: annualWithdrawal / stepsPerYear(assumptions.payoutFrequency),
      payoutFrequency: assumptions.payoutFrequency,
      withdrawalRate: annualWithdrawal / startingPortfolio * 100,
      medianEndingBalance: highEvaluation.medianEndingBalance,
      survivalRate: highEvaluation.survivalRate,
      targetSurvivalRate: assumptions.targetSurvivalRate,
      preservationTarget,
      preservationObjective: assumptions.preservationObjective,
      retirementDuration: assumptions.retirementDuration,
      expectedReturn: assumptions.expectedReturn,
      volatility: assumptions.volatility,
      enableCrashRisk: assumptions.enableCrashRisk,
      inflationAdjustedWithdrawals: assumptions.inflationAdjustedWithdrawals,
      includeTaxes: assumptions.includeTaxes && Boolean(sourceParams.taxEnabled),
      scenariosUsed: scenarios,
      capped: true,
      sourceUsesGrossTaxDeferredBalance: source.usesGrossTaxDeferredBalance,
    }
  }

  for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration += 1) {
    throwIfAborted(options.signal)
    const midpoint = (low + high) / 2
    const evaluation = await evaluate(midpoint)
    if (evaluation.meetsObjective) {
      low = midpoint
      lowEvaluation = evaluation
    } else {
      high = midpoint
      highEvaluation = evaluation
    }
  }

  progress.report('verifying', 'Verifying the rounded retirement income estimate...', 0.96)
  const monthlyWithdrawal = Math.max(0, Math.floor(low + EPSILON))
  const finalEvaluation = await evaluate(monthlyWithdrawal)
  const annualWithdrawal = monthlyWithdrawal * 12
  progress.finish('Sustainable withdrawal estimate complete.')

  return {
    startingPortfolio,
    monthlyWithdrawal,
    annualWithdrawal,
    selectedPayoutAmount: annualWithdrawal / stepsPerYear(assumptions.payoutFrequency),
    payoutFrequency: assumptions.payoutFrequency,
    withdrawalRate: annualWithdrawal / startingPortfolio * 100,
    medianEndingBalance: finalEvaluation.meetsObjective
      ? finalEvaluation.medianEndingBalance
      : lowEvaluation.medianEndingBalance,
    survivalRate: finalEvaluation.meetsObjective
      ? finalEvaluation.survivalRate
      : lowEvaluation.survivalRate,
    targetSurvivalRate: assumptions.targetSurvivalRate,
    preservationTarget,
    preservationObjective: assumptions.preservationObjective,
    retirementDuration: assumptions.retirementDuration,
    expectedReturn: assumptions.expectedReturn,
    volatility: assumptions.volatility,
    enableCrashRisk: assumptions.enableCrashRisk,
    inflationAdjustedWithdrawals: assumptions.inflationAdjustedWithdrawals,
    includeTaxes: assumptions.includeTaxes && Boolean(sourceParams.taxEnabled),
    scenariosUsed: scenarios,
    capped: false,
    sourceUsesGrossTaxDeferredBalance: source.usesGrossTaxDeferredBalance,
  }
}

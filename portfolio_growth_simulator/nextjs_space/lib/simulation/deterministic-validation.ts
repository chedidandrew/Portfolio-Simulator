import type {
  CalculationMode,
  CashflowFrequency,
  GrowthState,
  SimulationParams,
  TaxType,
  WithdrawalState,
} from '@/lib/types'
import {
  MAX_MONTE_CARLO_WORK,
  assertMonteCarloWorkload,
  periodicRate,
  stepsPerYear,
} from './financial-utils'

export const MAX_SCENARIO_DURATION_YEARS = 200
export const MAX_SCENARIO_AMOUNT = 1_000_000_000_000_000_000
export const MAX_SCENARIO_RETURN_PERCENT = 100_000
export const MIN_SCENARIO_INFLATION_PERCENT = -50
export const MAX_SCENARIO_INFLATION_PERCENT = 100
export const MAX_SCENARIO_VOLATILITY_PERCENT = 100
export const MAX_SCENARIO_TAX_PERCENT = 99
export const MAX_DETERMINISTIC_STEPS = MAX_SCENARIO_DURATION_YEARS * 52
export const MAX_SHARE_PAYLOAD_LENGTH = 20_000
export const MAX_SHARE_JSON_LENGTH = 100_000
export const MAX_RNG_SEED_LENGTH = 500

const FREQUENCIES: CashflowFrequency[] = ['yearly', 'quarterly', 'monthly', 'weekly']
const TAX_TYPES: TaxType[] = ['capital_gains', 'income', 'tax_deferred']
const CALCULATION_MODES: CalculationMode[] = ['effective', 'nominal']
const MAX_SAFE_LOG = Math.log(Number.MAX_VALUE) - 8

interface DeterministicValidationInput {
  startingValue: number
  annualReturn: number
  duration: number
  frequency: CashflowFrequency
  calculationMode?: CalculationMode
  cashflowAmount: number
  inflationAdjustment?: number
  excludeInflationAdjustment?: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalFinite = (value: unknown): value is number | undefined => value === undefined || isFiniteNumber(value)
const optionalBoolean = (value: unknown): value is boolean | undefined => value === undefined || typeof value === 'boolean'
const isFrequency = (value: unknown): value is CashflowFrequency => FREQUENCIES.includes(value as CashflowFrequency)
const isTaxType = (value: unknown): value is TaxType => TAX_TYPES.includes(value as TaxType)
const isCalculationMode = (value: unknown): value is CalculationMode => CALCULATION_MODES.includes(value as CalculationMode)
const isAmount = (value: unknown): value is number => (
  isFiniteNumber(value) && value >= 0 && value <= MAX_SCENARIO_AMOUNT
)

function hasValidTaxSettings(value: Record<string, unknown>): boolean {
  return optionalBoolean(value.taxEnabled)
    && optionalFinite(value.taxRate)
    && (value.taxRate === undefined || (
      value.taxRate >= 0 && value.taxRate <= MAX_SCENARIO_TAX_PERCENT
    ))
    && (value.taxType === undefined || isTaxType(value.taxType))
    && (value.calculationMode === undefined || isCalculationMode(value.calculationMode))
    && optionalFinite(value.startingCostBasis)
    && (value.startingCostBasis === undefined || isAmount(value.startingCostBasis))
    && optionalBoolean(value.costBasisIsUserEdited)
}

export function validateDeterministicRange(input: DeterministicValidationInput): string | null {
  const values = [
    input.startingValue,
    input.annualReturn,
    input.duration,
    input.cashflowAmount,
    input.inflationAdjustment ?? 0,
  ]
  if (values.some((value) => !Number.isFinite(value))) {
    return 'All scenario inputs must be finite numbers.'
  }
  if (input.startingValue < 0 || input.startingValue > MAX_SCENARIO_AMOUNT) {
    return `Starting value must be between 0 and ${MAX_SCENARIO_AMOUNT.toLocaleString()}.`
  }
  if (input.cashflowAmount < 0 || input.cashflowAmount > MAX_SCENARIO_AMOUNT) {
    return `Cashflow must be between 0 and ${MAX_SCENARIO_AMOUNT.toLocaleString()}.`
  }
  if (input.annualReturn < -100 || input.annualReturn > MAX_SCENARIO_RETURN_PERCENT) {
    return `Expected return must be between -100% and ${MAX_SCENARIO_RETURN_PERCENT.toLocaleString()}%.`
  }
  if (input.duration <= 0 || input.duration > MAX_SCENARIO_DURATION_YEARS) {
    return `Duration must be greater than zero and no more than ${MAX_SCENARIO_DURATION_YEARS} years.`
  }

  const inflation = input.inflationAdjustment ?? 0
  if (
    inflation < MIN_SCENARIO_INFLATION_PERCENT
    || inflation > MAX_SCENARIO_INFLATION_PERCENT
  ) {
    return `Inflation must be between ${MIN_SCENARIO_INFLATION_PERCENT}% and ${MAX_SCENARIO_INFLATION_PERCENT}%.`
  }

  try {
    const periods = stepsPerYear(input.frequency)
    const totalSteps = Math.max(1, Math.round(input.duration * periods))
    if (!Number.isSafeInteger(totalSteps) || totalSteps > MAX_DETERMINISTIC_STEPS) {
      return `This scenario requires too many calculation periods. Reduce duration or frequency to ${MAX_DETERMINISTIC_STEPS.toLocaleString()} periods or fewer.`
    }

    const stepRate = periodicRate(input.annualReturn, periods, input.calculationMode ?? 'effective')
    if (stepRate < -1) return 'The selected return is not valid for this compounding frequency.'

    const baseMagnitude = Math.max(1, Math.abs(input.startingValue), Math.abs(input.cashflowAmount))
    const marketGrowthLog = Math.max(0, totalSteps * Math.log1p(stepRate))
    const inflationRate = input.excludeInflationAdjustment ? 0 : inflation / 100
    const cashflowGrowthLog = inflationRate > 0
      ? Math.max(0, input.duration * Math.log1p(inflationRate))
      : 0
    const estimatedLogMagnitude = Math.log(baseMagnitude)
      + Math.log1p(totalSteps)
      + marketGrowthLog
      + cashflowGrowthLog

    if (!Number.isFinite(estimatedLogMagnitude) || estimatedLogMagnitude > MAX_SAFE_LOG) {
      return 'These values would exceed the browser\'s safe numeric range. Reduce the starting value, return, duration, or compounding frequency.'
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'The selected values cannot be calculated safely.'
  }

  return null
}

export function validateGrowthStateRange(state: GrowthState): string | null {
  const rangeError = validateDeterministicRange({
    startingValue: state.startingBalance,
    annualReturn: state.annualReturn,
    duration: state.duration,
    frequency: state.frequency,
    calculationMode: state.calculationMode,
    cashflowAmount: state.periodicAddition,
    inflationAdjustment: state.inflationAdjustment,
    excludeInflationAdjustment: state.excludeInflationAdjustment,
  })
  if (rangeError) return rangeError
  if (state.targetValue !== undefined && !isAmount(state.targetValue)) {
    return `Target value must be between 0 and ${MAX_SCENARIO_AMOUNT.toLocaleString()}.`
  }
  if (state.taxRate !== undefined && (state.taxRate < 0 || state.taxRate > MAX_SCENARIO_TAX_PERCENT)) {
    return `Tax rate must be between 0% and ${MAX_SCENARIO_TAX_PERCENT}%.`
  }
  if (state.startingCostBasis !== undefined && !isAmount(state.startingCostBasis)) {
    return `Cost basis must be between 0 and ${MAX_SCENARIO_AMOUNT.toLocaleString()}.`
  }
  return null
}

export function validateWithdrawalStateRange(state: WithdrawalState): string | null {
  const rangeError = validateDeterministicRange({
    startingValue: state.startingBalance,
    annualReturn: state.annualReturn,
    duration: state.duration,
    frequency: state.frequency,
    calculationMode: state.calculationMode,
    cashflowAmount: state.periodicWithdrawal,
    inflationAdjustment: state.inflationAdjustment,
    excludeInflationAdjustment: state.excludeInflationAdjustment,
  })
  if (rangeError) return rangeError
  if (state.taxRate !== undefined && (state.taxRate < 0 || state.taxRate > MAX_SCENARIO_TAX_PERCENT)) {
    return `Tax rate must be between 0% and ${MAX_SCENARIO_TAX_PERCENT}%.`
  }
  if (state.startingCostBasis !== undefined && !isAmount(state.startingCostBasis)) {
    return `Cost basis must be between 0 and ${MAX_SCENARIO_AMOUNT.toLocaleString()}.`
  }
  return null
}

export function isValidGrowthState(value: unknown): value is GrowthState {
  if (!isRecord(value) || !isAmount(value.startingBalance)) return false
  if (!isFiniteNumber(value.annualReturn) || !isFiniteNumber(value.duration)) return false
  if (!isAmount(value.periodicAddition) || !isFrequency(value.frequency)) return false
  if (!isFiniteNumber(value.inflationAdjustment)) return false
  if (!optionalFinite(value.targetValue) || !optionalBoolean(value.excludeInflationAdjustment)) return false
  if (!hasValidTaxSettings(value)) return false
  return validateGrowthStateRange(value as unknown as GrowthState) === null
}

export function isValidWithdrawalState(value: unknown): value is WithdrawalState {
  if (!isRecord(value) || !isAmount(value.startingBalance)) return false
  if (!isFiniteNumber(value.annualReturn) || !isFiniteNumber(value.duration)) return false
  if (!isAmount(value.periodicWithdrawal) || !isFrequency(value.frequency)) return false
  if (!isFiniteNumber(value.inflationAdjustment)) return false
  if (!optionalBoolean(value.excludeInflationAdjustment) || !hasValidTaxSettings(value)) return false
  return validateWithdrawalStateRange(value as unknown as WithdrawalState) === null
}

export function isValidSimulationParams(value: unknown): value is SimulationParams {
  if (!isRecord(value) || !isAmount(value.initialValue)) return false
  if (!isFiniteNumber(value.expectedReturn) || value.expectedReturn <= -100 || value.expectedReturn > MAX_SCENARIO_RETURN_PERCENT) return false
  if (!isFiniteNumber(value.volatility) || value.volatility < 0 || value.volatility > MAX_SCENARIO_VOLATILITY_PERCENT) return false
  if (!isFiniteNumber(value.duration) || value.duration <= 0 || value.duration > MAX_SCENARIO_DURATION_YEARS) return false
  if (!isAmount(value.cashflowAmount) || !isFrequency(value.cashflowFrequency)) return false
  if (typeof value.numPaths !== 'number' || !Number.isInteger(value.numPaths) || value.numPaths < 1) return false
  if (!optionalFinite(value.inflationAdjustment) || !optionalFinite(value.portfolioGoal)) return false
  if (value.inflationAdjustment !== undefined && (
    value.inflationAdjustment < MIN_SCENARIO_INFLATION_PERCENT
    || value.inflationAdjustment > MAX_SCENARIO_INFLATION_PERCENT
  )) return false
  if (value.portfolioGoal !== undefined && !isAmount(value.portfolioGoal)) return false
  if (!optionalBoolean(value.excludeInflationAdjustment) || !optionalBoolean(value.enableCrashRisk)) return false
  if (!hasValidTaxSettings(value)) return false

  try {
    assertMonteCarloWorkload(
      value.numPaths,
      value.duration,
      stepsPerYear(value.cashflowFrequency),
    )
    return value.numPaths * Math.ceil(value.duration * stepsPerYear(value.cashflowFrequency)) <= MAX_MONTE_CARLO_WORK
  } catch {
    return false
  }
}

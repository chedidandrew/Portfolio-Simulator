import type { CalculationMode, CashflowFrequency, GrowthState, WithdrawalState } from '@/lib/types'
import { periodicRate, stepsPerYear } from './financial-utils'

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

const MAX_SAFE_LOG = Math.log(Number.MAX_VALUE) - 8

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
  if (input.duration <= 0) return 'Duration must be greater than zero.'

  try {
    const periods = stepsPerYear(input.frequency)
    const totalSteps = Math.max(1, Math.round(input.duration * periods))
    const stepRate = periodicRate(input.annualReturn, periods, input.calculationMode ?? 'effective')
    if (stepRate <= -1) return 'The selected return is not valid for this compounding frequency.'

    const baseMagnitude = Math.max(1, Math.abs(input.startingValue), Math.abs(input.cashflowAmount))
    const marketGrowthLog = Math.max(0, totalSteps * Math.log1p(stepRate))
    const inflationRate = input.excludeInflationAdjustment ? 0 : (input.inflationAdjustment ?? 0) / 100
    const cashflowGrowthLog = inflationRate > 0
      ? Math.max(0, input.duration * Math.log1p(inflationRate))
      : 0
    const estimatedLogMagnitude = Math.log(baseMagnitude) + Math.log1p(totalSteps) + marketGrowthLog + cashflowGrowthLog

    if (!Number.isFinite(estimatedLogMagnitude) || estimatedLogMagnitude > MAX_SAFE_LOG) {
      return 'These values would exceed the browser\'s safe numeric range. Reduce the starting value, return, duration, or compounding frequency.'
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'The selected values cannot be calculated safely.'
  }

  return null
}

export function validateGrowthStateRange(state: GrowthState): string | null {
  return validateDeterministicRange({
    startingValue: state.startingBalance,
    annualReturn: state.annualReturn,
    duration: state.duration,
    frequency: state.frequency,
    calculationMode: state.calculationMode,
    cashflowAmount: state.periodicAddition,
    inflationAdjustment: state.inflationAdjustment,
    excludeInflationAdjustment: state.excludeInflationAdjustment,
  })
}

export function validateWithdrawalStateRange(state: WithdrawalState): string | null {
  return validateDeterministicRange({
    startingValue: state.startingBalance,
    annualReturn: state.annualReturn,
    duration: state.duration,
    frequency: state.frequency,
    calculationMode: state.calculationMode,
    cashflowAmount: state.periodicWithdrawal,
    inflationAdjustment: state.inflationAdjustment,
    excludeInflationAdjustment: state.excludeInflationAdjustment,
  })
}

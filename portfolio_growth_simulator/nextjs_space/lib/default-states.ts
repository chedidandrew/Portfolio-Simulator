import type { GrowthState, WithdrawalState } from '@/lib/types'

export const DEFAULT_GROWTH_STATE: GrowthState = {
  startingBalance: 10_000,
  startingCostBasis: 10_000,
  costBasisIsUserEdited: false,
  annualReturn: 8,
  duration: 30,
  periodicAddition: 500,
  frequency: 'monthly',
  targetValue: 500_000,
  inflationAdjustment: 2.5,
  excludeInflationAdjustment: true,
  taxEnabled: false,
  taxRate: 15,
  taxType: 'capital_gains',
}

export const DEFAULT_WITHDRAWAL_STATE: WithdrawalState = {
  startingBalance: 1_000_000,
  startingCostBasis: 1_000_000,
  costBasisIsUserEdited: false,
  annualReturn: 7,
  duration: 30,
  periodicWithdrawal: 3_000,
  inflationAdjustment: 2.5,
  frequency: 'monthly',
  excludeInflationAdjustment: false,
  taxEnabled: false,
  taxRate: 15,
  taxType: 'capital_gains',
}

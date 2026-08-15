import type { GrowthState, SimulationParams, TaxType, WithdrawalState } from '@/lib/types'

const TAX_TYPES: TaxType[] = ['capital_gains', 'income', 'tax_deferred']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeTrackedBasis(
  balance: number,
  valueBasis: unknown,
  valueEdited: unknown,
  persistedValue: unknown | null,
): { startingCostBasis: number; costBasisIsUserEdited: boolean } {
  const persisted = isRecord(persistedValue) ? persistedValue : null
  const persistedBasis = persisted?.startingCostBasis
  const hasPersistedBasis = typeof persistedBasis === 'number' && Number.isFinite(persistedBasis)
  const hasPersistedEditFlag = typeof persisted?.costBasisIsUserEdited === 'boolean'

  // Legacy saved states and share links had no edit flag. If they contain an
  // explicit basis, preserve it as user-owned rather than guessing from whether
  // it happens to equal the current balance.
  const costBasisIsUserEdited = hasPersistedEditFlag
    ? persisted.costBasisIsUserEdited as boolean
    : persisted
      ? hasPersistedBasis
      : valueEdited === true

  const candidateBasis = hasPersistedBasis ? persistedBasis : valueBasis
  const validCandidate = typeof candidateBasis === 'number' && Number.isFinite(candidateBasis)

  return {
    startingCostBasis: costBasisIsUserEdited && validCandidate
      ? Math.max(0, candidateBasis)
      : Math.max(0, balance),
    costBasisIsUserEdited,
  }
}

export function normalizeGrowthState(
  value: GrowthState,
  persistedValue: unknown | null,
): GrowthState {
  return {
    ...value,
    ...normalizeTrackedBasis(
      value.startingBalance,
      value.startingCostBasis,
      value.costBasisIsUserEdited,
      persistedValue,
    ),
  }
}

export function normalizeWithdrawalState(
  value: WithdrawalState,
  persistedValue: unknown | null,
): WithdrawalState {
  const persisted = isRecord(persistedValue) ? persistedValue : null
  const persistedTaxType = persisted?.taxType
  const taxType = TAX_TYPES.includes(persistedTaxType as TaxType)
    ? persistedTaxType as TaxType
    : value.taxType ?? 'capital_gains'

  return {
    ...value,
    taxType,
    ...normalizeTrackedBasis(
      value.startingBalance,
      value.startingCostBasis,
      value.costBasisIsUserEdited,
      persistedValue,
    ),
  }
}

export function normalizeSimulationParams(
  value: SimulationParams,
  persistedValue: unknown | null,
): SimulationParams {
  return {
    ...value,
    ...normalizeTrackedBasis(
      value.initialValue,
      value.startingCostBasis,
      value.costBasisIsUserEdited,
      persistedValue,
    ),
  }
}

type DeterministicBasisState = {
  startingBalance: number
  startingCostBasis?: number
  costBasisIsUserEdited?: boolean
}

export function updateStartingBalanceWithTrackedBasis<T extends DeterministicBasisState>(
  state: T,
  startingBalance: number,
): T {
  return {
    ...state,
    startingBalance,
    startingCostBasis: state.costBasisIsUserEdited
      ? state.startingCostBasis ?? state.startingBalance
      : startingBalance,
  }
}

export function updateInitialValueWithTrackedBasis(
  params: SimulationParams,
  initialValue: number,
): SimulationParams {
  return {
    ...params,
    initialValue,
    startingCostBasis: params.costBasisIsUserEdited
      ? params.startingCostBasis ?? params.initialValue
      : initialValue,
  }
}

export function markCostBasisUserEdited<T extends { startingCostBasis?: number; costBasisIsUserEdited?: boolean }>(
  state: T,
  startingCostBasis: number,
): T {
  return {
    ...state,
    startingCostBasis,
    costBasisIsUserEdited: true,
  }
}

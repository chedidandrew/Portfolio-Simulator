import { isValidGrowthState, isValidWithdrawalState } from '@/lib/simulation/deterministic-validation'

export type PersistedValidator<T> = (value: unknown) => value is T

export function getDefaultPersistedValidator<T>(
  key: string,
  initialValue: T,
): PersistedValidator<T> | undefined {
  const initialRecord = (
    typeof initialValue === 'object'
    && initialValue !== null
    && !Array.isArray(initialValue)
  ) ? initialValue as Record<string, unknown> : null

  if (key === 'growth-mode-state' && initialRecord && 'periodicAddition' in initialRecord) {
    return isValidGrowthState as PersistedValidator<T>
  }

  if (key === 'withdrawal-mode-state' && initialRecord && 'periodicWithdrawal' in initialRecord) {
    return isValidWithdrawalState as PersistedValidator<T>
  }

  return undefined
}

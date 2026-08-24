'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addMonths,
  getLoanValidationErrors,
  isValidMonth,
  type LoanInputs,
  type LoanLumpSum,
} from '@/lib/loan/loan-engine'

export const FINANCIAL_PROFILE_STORAGE_KEY = 'portfolio-sim-financial-profile-v1'
export const LEGACY_LOAN_STORAGE_KEY = 'portfolio-sim-loan-state'
export const PAYOFF_GOAL_STORAGE_KEY = 'portfolio-sim-payoff-goal-state-v1'
export const REFINANCE_STORAGE_KEY = 'portfolio-sim-refinance-state-v1'
export const INVEST_VS_DEBT_STORAGE_KEY = 'portfolio-sim-invest-vs-debt-state-v1'

export const FINANCIAL_STORAGE_KEYS = [
  FINANCIAL_PROFILE_STORAGE_KEY,
  LEGACY_LOAN_STORAGE_KEY,
  PAYOFF_GOAL_STORAGE_KEY,
  REFINANCE_STORAGE_KEY,
  INVEST_VS_DEBT_STORAGE_KEY,
] as const

export interface FinancialProfile {
  loanBalance: number
  loanApr: number
  remainingMonths: number
  firstPaymentMonth: string
  extraMonthlyPayment: number
  lumpSums: LoanLumpSum[]
}

interface FinancialProfileContextValue {
  profile: FinancialProfile
  hydrated: boolean
  setProfile: (value: FinancialProfile | ((current: FinancialProfile) => FinancialProfile)) => void
  resetFinancialData: () => void
}

const FinancialProfileContext = createContext<FinancialProfileContextValue | null>(null)

function nextUtcMonth(): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function defaultFinancialProfile(): FinancialProfile {
  return {
    loanBalance: 350_000,
    loanApr: 6.5,
    remainingMonths: 360,
    firstPaymentMonth: nextUtcMonth(),
    extraMonthlyPayment: 0,
    lumpSums: [],
  }
}

export function financialProfileToLoanInputs(profile: FinancialProfile): LoanInputs {
  return {
    principal: profile.loanBalance,
    apr: profile.loanApr,
    termMonths: profile.remainingMonths,
    firstPaymentMonth: profile.firstPaymentMonth,
    extraMonthlyPayment: profile.extraMonthlyPayment,
    lumpSums: profile.lumpSums,
  }
}

export function loanInputsToFinancialProfile(inputs: LoanInputs): FinancialProfile {
  return {
    loanBalance: inputs.principal,
    loanApr: inputs.apr,
    remainingMonths: inputs.termMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: inputs.extraMonthlyPayment,
    lumpSums: inputs.lumpSums,
  }
}

function hasValidLumpSumShape(value: unknown): value is LoanLumpSum {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string'
    && candidate.id.length > 0
    && candidate.id.length <= 80
    && typeof candidate.month === 'string'
    && typeof candidate.amount === 'number'
    && Number.isFinite(candidate.amount)
    && candidate.amount > 0
    && candidate.amount <= 1_000_000_000
  )
}

function normalizeFinancialProfile(profile: FinancialProfile): FinancialProfile {
  if (!isValidMonth(profile.firstPaymentMonth) || !Number.isInteger(profile.remainingMonths) || profile.remainingMonths < 1 || profile.remainingMonths > 600) {
    return profile
  }

  const lastScheduledMonth = addMonths(profile.firstPaymentMonth, profile.remainingMonths - 1)
  const seenIds = new Set<string>()
  const lumpSums = profile.lumpSums.filter((payment) => {
    if (!hasValidLumpSumShape(payment) || seenIds.has(payment.id)) return false
    seenIds.add(payment.id)
    return isValidMonth(payment.month)
      && payment.month >= profile.firstPaymentMonth
      && payment.month <= lastScheduledMonth
  }).slice(0, 24)

  return lumpSums.length === profile.lumpSums.length && lumpSums.every((payment, index) => payment === profile.lumpSums[index])
    ? profile
    : { ...profile, lumpSums }
}

function isValidFinancialProfile(value: unknown): value is FinancialProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.loanBalance !== 'number'
    || typeof candidate.loanApr !== 'number'
    || typeof candidate.remainingMonths !== 'number'
    || typeof candidate.firstPaymentMonth !== 'string'
    || typeof candidate.extraMonthlyPayment !== 'number'
    || !Array.isArray(candidate.lumpSums)
    || candidate.lumpSums.length > 24
  ) return false

  const seenIds = new Set<string>()
  for (const payment of candidate.lumpSums) {
    if (!hasValidLumpSumShape(payment) || seenIds.has(payment.id)) return false
    seenIds.add(payment.id)
  }

  const loan: LoanInputs = {
    principal: candidate.loanBalance,
    apr: candidate.loanApr,
    termMonths: candidate.remainingMonths,
    firstPaymentMonth: candidate.firstPaymentMonth,
    extraMonthlyPayment: candidate.extraMonthlyPayment,
    lumpSums: candidate.lumpSums as LoanLumpSum[],
  }
  return getLoanValidationErrors(loan).length === 0
}

function readStoredProfile(): FinancialProfile {
  const fallback = defaultFinancialProfile()
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(FINANCIAL_PROFILE_STORAGE_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (isValidFinancialProfile(parsed)) return normalizeFinancialProfile(parsed)
    }
  } catch {
    // Fall through to the legacy loan migration or defaults.
  }

  try {
    const legacy = window.localStorage.getItem(LEGACY_LOAN_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as LoanInputs
      if (getLoanValidationErrors(parsed).length === 0) {
        const migrated = loanInputsToFinancialProfile(parsed)
        if (isValidFinancialProfile(migrated)) return normalizeFinancialProfile(migrated)
      }
    }
  } catch {
    // Fall through to defaults when legacy storage is malformed or unavailable.
  }

  return fallback
}

function persistProfile(profile: FinancialProfile) {
  if (typeof window === 'undefined') return
  const normalized = normalizeFinancialProfile(profile)
  try {
    // Keep the historical Loan Calculator key current as a compatibility mirror.
    // That preserves existing saved data and makes a deployment rollback less surprising,
    // while the React context remains the single in-page source of truth.
    window.localStorage.setItem(FINANCIAL_PROFILE_STORAGE_KEY, JSON.stringify(normalized))
    window.localStorage.setItem(LEGACY_LOAN_STORAGE_KEY, JSON.stringify(financialProfileToLoanInputs(normalized)))
  } catch {
    // In-memory state remains usable if browser storage is unavailable.
  }
}

export function FinancialProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<FinancialProfile>(() => defaultFinancialProfile())
  const [hydrated, setHydrated] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const stored = readStoredProfile()
    setProfileState(stored)
    persistProfile(stored)
    setHydrated(true)

    const reloadFromAnotherTab = (event: StorageEvent) => {
      if (event.key === FINANCIAL_PROFILE_STORAGE_KEY) setProfileState(readStoredProfile())
    }

    window.addEventListener('storage', reloadFromAnotherTab)
    return () => window.removeEventListener('storage', reloadFromAnotherTab)
  }, [])

  const setProfile = useCallback((value: FinancialProfile | ((current: FinancialProfile) => FinancialProfile)) => {
    setProfileState((current) => {
      const requested = value instanceof Function ? value(current) : value
      const next = normalizeFinancialProfile(requested)
      if (mountedRef.current) persistProfile(next)
      return next
    })
  }, [])

  const resetFinancialData = useCallback(() => {
    const defaults = defaultFinancialProfile()
    if (typeof window !== 'undefined') {
      for (const key of FINANCIAL_STORAGE_KEYS) {
        try {
          window.localStorage.removeItem(key)
          window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key } }))
        } catch {
          // Continue resetting in-memory state even if browser storage is blocked.
        }
      }
    }
    setProfileState(defaults)
    persistProfile(defaults)
  }, [])

  const value = useMemo(
    () => ({ profile, hydrated, setProfile, resetFinancialData }),
    [hydrated, profile, resetFinancialData, setProfile],
  )

  return <FinancialProfileContext.Provider value={value}>{children}</FinancialProfileContext.Provider>
}

export function useFinancialProfile() {
  const value = useContext(FinancialProfileContext)
  if (!value) throw new Error('useFinancialProfile must be used within FinancialProfileProvider')
  return value
}

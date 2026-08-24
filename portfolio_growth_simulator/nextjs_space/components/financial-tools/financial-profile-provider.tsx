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
  getLoanValidationErrors,
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
  ) return false

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
      if (isValidFinancialProfile(parsed)) return parsed
    }
  } catch {
    // Fall through to the legacy loan migration or defaults.
  }

  try {
    const legacy = window.localStorage.getItem(LEGACY_LOAN_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as LoanInputs
      if (getLoanValidationErrors(parsed).length === 0) return loanInputsToFinancialProfile(parsed)
    }
  } catch {
    // Fall through to defaults when legacy storage is malformed or unavailable.
  }

  return fallback
}

function persistProfile(profile: FinancialProfile) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FINANCIAL_PROFILE_STORAGE_KEY, JSON.stringify(profile))
    window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key: FINANCIAL_PROFILE_STORAGE_KEY } }))
  } catch {
    // In-memory state remains usable if browser storage is unavailable.
  }
}

export function FinancialProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<FinancialProfile>(() => defaultFinancialProfile())
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const stored = readStoredProfile()
    setProfileState(stored)
    persistProfile(stored)

    const reload = (event: StorageEvent | CustomEvent) => {
      if ((event as StorageEvent).key === FINANCIAL_PROFILE_STORAGE_KEY || (event as CustomEvent).detail?.key === FINANCIAL_PROFILE_STORAGE_KEY) {
        setProfileState(readStoredProfile())
      }
    }

    window.addEventListener('storage', reload)
    window.addEventListener('local-storage-update', reload as EventListener)
    return () => {
      window.removeEventListener('storage', reload)
      window.removeEventListener('local-storage-update', reload as EventListener)
    }
  }, [])

  const setProfile = useCallback((value: FinancialProfile | ((current: FinancialProfile) => FinancialProfile)) => {
    setProfileState((current) => {
      const next = value instanceof Function ? value(current) : value
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
          // Continue resetting the in-memory state even if storage is blocked.
        }
      }
    }
    setProfileState(defaults)
    persistProfile(defaults)
  }, [])

  const value = useMemo(() => ({ profile, setProfile, resetFinancialData }), [profile, resetFinancialData, setProfile])

  return <FinancialProfileContext.Provider value={value}>{children}</FinancialProfileContext.Provider>
}

export function useFinancialProfile() {
  const value = useContext(FinancialProfileContext)
  if (!value) throw new Error('useFinancialProfile must be used within FinancialProfileProvider')
  return value
}

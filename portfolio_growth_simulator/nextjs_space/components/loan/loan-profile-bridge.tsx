'use client'

import { useEffect } from 'react'
import { LoanCalculator } from '@/components/loan/loan-calculator'
import {
  LEGACY_LOAN_STORAGE_KEY,
  loanInputsToFinancialProfile,
  useFinancialProfile,
} from '@/components/financial-tools/financial-profile-provider'
import { getLoanValidationErrors, type LoanInputs } from '@/lib/loan/loan-engine'

export function LoanProfileBridge() {
  const { profile, hydrated, setProfile } = useFinancialProfile()

  useEffect(() => {
    if (!hydrated) return

    const syncFromLoanCalculator = (event: StorageEvent | CustomEvent) => {
      const key = (event as StorageEvent).key ?? (event as CustomEvent).detail?.key
      if (key !== LEGACY_LOAN_STORAGE_KEY) return
      try {
        const raw = window.localStorage.getItem(LEGACY_LOAN_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as LoanInputs
        if (getLoanValidationErrors(parsed).length > 0) return
        const nextProfile = loanInputsToFinancialProfile(parsed)
        if (JSON.stringify(nextProfile) !== JSON.stringify(profile)) setProfile(nextProfile)
      } catch {
        // Ignore malformed external storage writes; the validated profile remains authoritative.
      }
    }

    window.addEventListener('storage', syncFromLoanCalculator)
    window.addEventListener('local-storage-update', syncFromLoanCalculator as EventListener)
    return () => {
      window.removeEventListener('storage', syncFromLoanCalculator)
      window.removeEventListener('local-storage-update', syncFromLoanCalculator as EventListener)
    }
  }, [hydrated, profile, setProfile])

  if (!hydrated) return null
  return <LoanCalculator />
}

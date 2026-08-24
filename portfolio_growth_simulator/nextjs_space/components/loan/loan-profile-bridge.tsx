'use client'

import { useEffect, useMemo, useState } from 'react'
import { LoanCalculator } from '@/components/loan/loan-calculator'
import {
  LEGACY_LOAN_STORAGE_KEY,
  financialProfileToLoanInputs,
  loanInputsToFinancialProfile,
  useFinancialProfile,
} from '@/components/financial-tools/financial-profile-provider'
import { getLoanValidationErrors, type LoanInputs } from '@/lib/loan/loan-engine'

function writeLoanState(inputs: LoanInputs) {
  try {
    const serialized = JSON.stringify(inputs)
    if (window.localStorage.getItem(LEGACY_LOAN_STORAGE_KEY) === serialized) return
    window.localStorage.setItem(LEGACY_LOAN_STORAGE_KEY, serialized)
    window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key: LEGACY_LOAN_STORAGE_KEY } }))
  } catch {
    // The calculator still works in memory if storage is blocked.
  }
}

export function LoanProfileBridge() {
  const { profile, hydrated, setProfile } = useFinancialProfile()
  const [ready, setReady] = useState(false)
  const sharedLoan = useMemo(() => financialProfileToLoanInputs(profile), [profile])

  useEffect(() => {
    if (!hydrated) return
    writeLoanState(sharedLoan)
    setReady(true)
  }, [hydrated, sharedLoan])

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

  if (!hydrated || !ready) return null
  return <LoanCalculator />
}

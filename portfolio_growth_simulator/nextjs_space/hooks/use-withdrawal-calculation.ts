'use client'

import { useMemo } from 'react'
import { calculateWithdrawalProjection } from '@/lib/simulation/withdrawal-engine'
import { WithdrawalState } from '@/lib/types'

export function useWithdrawalCalculation(state: WithdrawalState) {
  const result = useMemo(() => {
    return calculateWithdrawalProjection(state)
  }, [state])

  return result
}
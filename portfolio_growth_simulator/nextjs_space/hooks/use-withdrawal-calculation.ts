'use client'

import { useMemo, useState, useEffect } from 'react'
import { calculateWithdrawalProjection } from '@/lib/simulation/withdrawal-engine'
import { WithdrawalState } from '@/lib/types'

export function useWithdrawalCalculation(state: WithdrawalState) {
  const result = useMemo(() => {
    return calculateWithdrawalProjection(state)
  }, [state])

  const [isCalculated, setIsCalculated] = useState(false)

  useEffect(() => {
    setIsCalculated(true)
    const timer = setTimeout(() => setIsCalculated(false), 500)
    return () => clearTimeout(timer)
  }, [result])

  return { ...result, isCalculated }
}
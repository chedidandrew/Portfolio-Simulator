'use client'

import { useMemo, useState, useEffect } from 'react'
import { calculateWithdrawalProjection } from '@/lib/simulation/withdrawal-engine'
import { WithdrawalState } from '@/lib/types'
import type { WithdrawalProjectionResult } from '@/lib/simulation/withdrawal-engine'
import { validateWithdrawalStateRange } from '@/lib/simulation/deterministic-validation'
import type { DeterministicCalculationState } from '@/hooks/use-growth-calculation'

export function useWithdrawalCalculation(state: WithdrawalState): DeterministicCalculationState<WithdrawalProjectionResult> {
  const calculation = useMemo(() => {
    const validationError = validateWithdrawalStateRange(state)
    if (validationError) return { result: null, error: validationError }

    try {
      return { result: calculateWithdrawalProjection(state), error: null }
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'This withdrawal scenario could not be calculated.',
      }
    }
  }, [state])

  const [isCalculated, setIsCalculated] = useState(false)

  useEffect(() => {
    setIsCalculated(true)
    const timer = setTimeout(() => setIsCalculated(false), 500)
    return () => clearTimeout(timer)
  }, [calculation.result])

  return { ...calculation, isCalculated }
}

'use client'

import { useMemo, useState, useEffect } from 'react'
import { calculateGrowthProjection } from '@/lib/simulation/growth-engine'
import { GrowthState } from '@/lib/types'
import type { GrowthProjectionResult } from '@/lib/simulation/growth-engine'
import { validateGrowthStateRange } from '@/lib/simulation/deterministic-validation'

export interface DeterministicCalculationState<Result> {
  result: Result | null
  error: string | null
  isCalculated: boolean
}

export function useGrowthCalculation(state: GrowthState): DeterministicCalculationState<GrowthProjectionResult> {
  const calculation = useMemo(() => {
    const validationError = validateGrowthStateRange(state)
    if (validationError) return { result: null, error: validationError }

    try {
      return { result: calculateGrowthProjection(state), error: null }
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'This growth scenario could not be calculated.',
      }
    }
  }, [state])

  // Small utility state to prevent hydration mismatch on initial load if needed,
  // or just to signal "calculation updated" for animations.
  const [isCalculated, setIsCalculated] = useState(false)

  useEffect(() => {
    setIsCalculated(true)
    const timer = setTimeout(() => setIsCalculated(false), 500)
    return () => clearTimeout(timer)
  }, [calculation.result])

  return { ...calculation, isCalculated }
}

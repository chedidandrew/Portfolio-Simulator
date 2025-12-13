'use client'

import { useMemo, useState, useEffect } from 'react'
import { calculateGrowthProjection } from '@/lib/simulation/growth-engine'
import { GrowthState } from '@/lib/types'

export function useGrowthCalculation(state: GrowthState) {
  // We wrap the heavy calculation in useMemo
  const result = useMemo(() => {
    return calculateGrowthProjection(state)
  }, [state])

  // Small utility state to prevent hydration mismatch on initial load if needed,
  // or just to signal "calculation updated" for animations.
  const [isCalculated, setIsCalculated] = useState(false)

  useEffect(() => {
    setIsCalculated(true)
    const timer = setTimeout(() => setIsCalculated(false), 500)
    return () => clearTimeout(timer)
  }, [result])

  return { ...result, isCalculated }
}
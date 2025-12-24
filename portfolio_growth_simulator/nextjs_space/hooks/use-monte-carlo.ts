'use client'

import { useState, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { SimulationParams } from '@/lib/types'
import { performMonteCarloSimulationAsync } from '@/lib/simulation/monte-carlo-engine'

interface LogScaleSettings {
  chart: boolean
  histogram: boolean
  drawdown: boolean
}

const PRESET_PROFILES = {
  conservative: {
    name: 'Conservative',
    expectedReturn: 5,
    volatility: 6,
    description: 'Low risk, stable returns - Bond investor',
  },
  moderate: {
    name: 'Moderate',
    expectedReturn: 7,
    volatility: 10,
    description: 'Balanced risk and return - 60/40 investor',
  },
  aggressive: {
    name: 'Aggressive',
    expectedReturn: 10,
    volatility: 18,
    description: 'High risk, high return potential - S&P 500 index investor',
  },
  custom: {
    name: 'Custom',
    expectedReturn: 7,
    volatility: 10,
    description: 'Define your own parameters',
  },
}

export function useMonteCarlo(
  mode: 'growth' | 'withdrawal', 
  initialValues: any,
  // NEW: Accept overrides from parent
  initialRngSeed?: string | null,
  initialMCParams?: SimulationParams
) {
  const [profile, setProfile] = useLocalStorage<keyof typeof PRESET_PROFILES>(
    'mc-profile-' + mode,
    'moderate'
  )

  const [params, setParams] = useLocalStorage<SimulationParams>(
    'mc-params-' + mode,
    {
      initialValue: initialValues?.startingBalance ?? 100000,
      expectedReturn: PRESET_PROFILES.moderate.expectedReturn,
      volatility: PRESET_PROFILES.moderate.volatility,
      duration: initialValues?.duration ?? 30,
      cashflowAmount:
        mode === 'growth'
          ? initialValues?.periodicAddition ?? 500
          : initialValues?.periodicWithdrawal ?? 3000,
      cashflowFrequency: initialValues?.frequency ?? 'monthly',
      inflationAdjustment: initialValues?.inflationAdjustment ?? 0,
      numPaths: 500,
      portfolioGoal: mode === 'growth' ? 1000000 : undefined,
    }
  )

  const [logScales, setLogScales] = useLocalStorage<LogScaleSettings>(
    'mc-log-scales-' + mode,
    { chart: false, histogram: false, drawdown: false }
  )

  const [rngSeed, setRngSeed] = useLocalStorage<string | null>(
    'mc-seed-' + mode,
    null
  )

  const [results, setSimulationResults] = useLocalStorage<any>(
    `mc-results-${mode}`,
    null
  )
  const [isSimulating, setIsSimulating] = useState(false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage(
    'mc-show-full-precision-' + mode,
    false
  )

  // 1. Initialize from Shared Link Data (if present)
  useEffect(() => {
    if (initialMCParams) {
      setParams(prev => ({ ...prev, ...initialMCParams }))
      setProfile('custom')
    }
    if (initialRngSeed) {
      setRngSeed(initialRngSeed)
    }
  }, [initialMCParams, initialRngSeed, setParams, setRngSeed, setProfile])

  // 2. Profile Switch Logic (only if NOT custom)
  useEffect(() => {
    if (profile !== 'custom') {
      const targetReturn = PRESET_PROFILES[profile].expectedReturn
      const targetVol = PRESET_PROFILES[profile].volatility

      if (
        params.expectedReturn !== targetReturn ||
        params.volatility !== targetVol
      ) {
        setParams((prev) => ({
          ...prev,
          expectedReturn: targetReturn,
          volatility: targetVol,
        }))
      }
    }
  }, [profile, setParams, params.expectedReturn, params.volatility])

  const runSimulation = (
    overrideParams?: SimulationParams,
    seedOverride?: string,
    preservedLogScales?: LogScaleSettings,
    onComplete?: (results: any) => void
  ) => {
    const simParams = overrideParams ?? params
    
    // If a seed is passed (e.g. from URL), use it. 
    // Otherwise use stored seed. 
    // Finally fallback to new random seed.
    const seed = seedOverride ?? rngSeed ?? `monte-carlo-${Date.now()}-${Math.random()}`

    setIsSimulating(true)
    setRngSeed(seed)

    setTimeout(() => {
      ;(async () => {
      const simResults = await performMonteCarloSimulationAsync(simParams, mode, seed)
      const finalResults = { ...simResults, simulationParams: simParams }

      if (preservedLogScales) {
        setLogScales(preservedLogScales)
      } else {
        setLogScales({
          chart: simResults.recommendLogLinear,
          histogram: simResults.recommendLogHistogram,
          drawdown: simResults.recommendLogDrawdown,
        })
      }

      setSimulationResults(finalResults)
      setIsSimulating(false)

      if (onComplete) {
        onComplete(finalResults)
      }
      })().catch(() => {
        setIsSimulating(false)
      })
    }, 100)
  }

  // 3. AUTO-RUN: Triggers immediately if a seed was provided via props (Link opened)
  useEffect(() => {
    if (initialRngSeed && initialMCParams) {
       // Run simulation using the passed params and seed
       runSimulation(initialMCParams, initialRngSeed)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRngSeed])

  return {
    profile,
    setProfile,
    params,
    setParams,
    results,
    isSimulating,
    logScales,
    setLogScales,
    rngSeed,
    showFullPrecision,
    setShowFullPrecision,
    runSimulation,
    PRESET_PROFILES,
  }
}
'use client'

import { useState, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { SimulationParams } from '@/lib/types'
import { performMonteCarloSimulation } from '@/lib/simulation/monte-carlo-engine'

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

export function useMonteCarlo(mode: 'growth' | 'withdrawal', initialValues: any) {
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
      cashflowFrequency: 'monthly',
      inflationAdjustment: initialValues?.inflationAdjustment ?? 0,
      numPaths: 500,
      portfolioGoal: mode === 'growth' ? 1000000 : undefined,
    }
  )

  const [logScales, setLogScales] = useLocalStorage<LogScaleSettings>(
    'mc-log-scales-' + mode,
    {
      chart: false,
      histogram: false,
      drawdown: false,
    }
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

  // Update params when profile changes
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
    const seed =
      seedOverride ?? rngSeed ?? `monte-carlo-${Date.now()}-${Math.random()}`

    setIsSimulating(true)
    setRngSeed(seed)

    setTimeout(() => {
      const simResults = performMonteCarloSimulation(simParams, mode, seed)

      // Store the params that generated these results for dirty checking
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
    }, 100)
  }

  // Handle URL loading
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')

      if (!mcParam) return

      const decoded = JSON.parse(decodeURIComponent(atob(mcParam)))

      if (!decoded || !decoded.params) return

      window.dispatchEvent(
        new CustomEvent('openMonteCarloFromLink', {
          detail: { mode: decoded.mode },
        })
      )

      setProfile('custom')

      const mergedParams: SimulationParams = {
        ...params,
        ...decoded.params,
      }
      setParams(mergedParams)

      const seedFromUrl =
        typeof decoded.rngSeed === 'string' ? decoded.rngSeed : undefined
      if (seedFromUrl) {
        setRngSeed(seedFromUrl)
      }

      const savedLogScales = decoded.logScales as LogScaleSettings | undefined

      if (typeof decoded.showFullPrecision === 'boolean') {
        setShowFullPrecision(decoded.showFullPrecision)
      }

      runSimulation(mergedParams, seedFromUrl, savedLogScales)

      window.history.replaceState(null, '', window.location.pathname)
    } catch (err) {
      console.error('Failed to restore Monte Carlo state from URL', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
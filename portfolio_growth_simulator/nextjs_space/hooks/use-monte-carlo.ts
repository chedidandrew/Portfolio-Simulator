'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { GrowthState, SimulationParams, WithdrawalState } from '@/lib/types'
import type { SimulationResults } from '@/lib/simulation/monte-carlo-engine'
import { runMonteCarloOffMainThread } from '@/lib/simulation/monte-carlo-client'
import { normalizeSimulationParams } from '@/lib/state-normalization'
import { isValidSimulationParams } from '@/lib/simulation/deterministic-validation'

export type CompletedSimulationResults = SimulationResults & {
  simulationParams: SimulationParams
  simulationSeed: string
  completedAt: string
}

interface LogScaleSettings {
  chart: boolean
  histogram: boolean
  drawdown: boolean
}

export const PRESET_PROFILES = {
  conservative: {
    name: 'Low Volatility',
    expectedReturn: 5,
    volatility: 6,
    description: 'Illustrative lower-return, lower-volatility assumptions. Not a forecast for any specific portfolio.',
  },
  moderate: {
    name: 'Balanced',
    expectedReturn: 7,
    volatility: 10,
    description: 'Illustrative middle-range return and volatility assumptions. Not a forecast for a 60/40 portfolio.',
  },
  aggressive: {
    name: 'High Volatility',
    expectedReturn: 10,
    volatility: 18,
    description: 'Illustrative higher-return, higher-volatility assumptions. Not a forecast for the S&P 500.',
  },
  custom: {
    name: 'Custom',
    expectedReturn: 7,
    volatility: 10,
    description: 'Define your own modeled return and volatility assumptions.',
  },
}

const isPresetProfile = (value: unknown): value is keyof typeof PRESET_PROFILES => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESET_PROFILES, value)
)

const isLogScaleSettings = (value: unknown): value is LogScaleSettings => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.chart === 'boolean'
    && typeof candidate.histogram === 'boolean'
    && typeof candidate.drawdown === 'boolean'
}

export function useMonteCarlo(
  mode: 'growth' | 'withdrawal',
  initialValues: GrowthState | WithdrawalState,
  initialRngSeed?: string | null,
  initialMCParams?: SimulationParams,
  initialLogScales?: LogScaleSettings,
  initialShowFullPrecision?: boolean,
) {
  const [profile, setProfile] = useLocalStorage<keyof typeof PRESET_PROFILES>(
    `mc-profile-${mode}`,
    'moderate',
    { validatePersisted: isPresetProfile },
  )

  const [params, setParams] = useLocalStorage<SimulationParams>(
    `mc-params-${mode}`,
    {
      initialValue: initialValues?.startingBalance ?? 100000,
      startingCostBasis: initialValues?.startingCostBasis,
      costBasisIsUserEdited: initialValues?.costBasisIsUserEdited ?? false,
      expectedReturn: PRESET_PROFILES.moderate.expectedReturn,
      volatility: PRESET_PROFILES.moderate.volatility,
      enableCrashRisk: false,
      duration: initialValues?.duration ?? 30,
      cashflowAmount: mode === 'growth'
        ? ('periodicAddition' in initialValues ? initialValues.periodicAddition : 500)
        : ('periodicWithdrawal' in initialValues ? initialValues.periodicWithdrawal : 3000),
      cashflowFrequency: initialValues?.frequency ?? 'monthly',
      inflationAdjustment: initialValues?.inflationAdjustment ?? 0,
      excludeInflationAdjustment: initialValues?.excludeInflationAdjustment ?? false,
      numPaths: 500,
      portfolioGoal: mode === 'growth' ? 1000000 : undefined,
      taxEnabled: initialValues?.taxEnabled ?? false,
      taxRate: initialValues?.taxRate ?? 0,
      taxType: initialValues?.taxType ?? 'capital_gains',
      calculationMode: initialValues?.calculationMode ?? 'effective',
    },
    {
      normalize: normalizeSimulationParams,
      validatePersisted: isValidSimulationParams,
    },
  )

  const [logScales, setLogScales] = useLocalStorage<LogScaleSettings>(
    `mc-log-scales-${mode}`,
    { chart: false, histogram: false, drawdown: false },
    { validatePersisted: isLogScaleSettings },
  )
  const [rngSeed, setRngSeed] = useLocalStorage<string | null>(`mc-seed-${mode}`, null)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage(
    `mc-show-full-precision-${mode}`,
    false,
  )

  const [results, setSimulationResults] = useState<CompletedSimulationResults | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  useEffect(() => {
    if (initialMCParams) {
      setParams((previous) => ({ ...previous, ...initialMCParams }))
      setProfile('custom')
    }
    if (initialRngSeed) setRngSeed(initialRngSeed)
    if (initialLogScales) setLogScales(initialLogScales)
    if (typeof initialShowFullPrecision === 'boolean') setShowFullPrecision(initialShowFullPrecision)
  }, [
    initialMCParams,
    initialRngSeed,
    initialLogScales,
    initialShowFullPrecision,
    setParams,
    setProfile,
    setRngSeed,
    setLogScales,
    setShowFullPrecision,
  ])

  useEffect(() => {
    if (profile === 'custom') return
    const preset = PRESET_PROFILES[profile]
    if (params.expectedReturn === preset.expectedReturn && params.volatility === preset.volatility) return
    setParams((previous) => ({
      ...previous,
      expectedReturn: preset.expectedReturn,
      volatility: preset.volatility,
    }))
  }, [profile, params.expectedReturn, params.volatility, setParams])

  const runSimulation = useCallback((
    overrideParams?: SimulationParams,
    seedOverride?: string,
    preservedLogScales?: LogScaleSettings,
    onComplete?: (completedResults: CompletedSimulationResults) => void,
  ) => {
    const simulationParams = overrideParams ?? params
    const simulationSeed = seedOverride ?? rngSeed ?? `monte-carlo-${Date.now()}-${Math.random()}`

    setIsSimulating(true)
    setSimulationError(null)
    setRngSeed(simulationSeed)

    void runMonteCarloOffMainThread(simulationParams, mode, simulationSeed)
      .then((simulationResults) => {
        const finalResults = {
          ...simulationResults,
          simulationParams: { ...simulationParams },
          simulationSeed,
          completedAt: new Date().toISOString(),
        }
        setSimulationResults(finalResults)
        setLogScales(preservedLogScales ?? {
          chart: simulationResults.recommendLogLinear,
          histogram: simulationResults.recommendLogHistogram,
          drawdown: simulationResults.recommendLogDrawdown,
        })
        onComplete?.(finalResults)
      })
      .catch((error: unknown) => {
        setSimulationError(error instanceof Error ? error.message : 'The simulation could not be completed.')
      })
      .finally(() => setIsSimulating(false))
  }, [mode, params, rngSeed, setLogScales, setRngSeed])

  useEffect(() => {
    if (initialRngSeed && initialMCParams) {
      runSimulation(initialMCParams, initialRngSeed, initialLogScales)
    }
    // The shared-link values are intentionally the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRngSeed])

  return {
    profile,
    setProfile,
    params,
    setParams,
    results,
    isSimulating,
    simulationError,
    logScales,
    setLogScales,
    rngSeed,
    showFullPrecision,
    setShowFullPrecision,
    runSimulation,
    PRESET_PROFILES,
  }
}

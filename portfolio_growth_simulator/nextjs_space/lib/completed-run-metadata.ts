import type { GrowthState, SharePayload, SimulationParams, WithdrawalState } from '@/lib/types'

interface CompletedRunMetadata {
  simulationParams?: SimulationParams
  simulationSeed?: string
}

export function resolveCompletedSimulationMetadata(
  completedResult: CompletedRunMetadata | null | undefined,
  currentParams: SimulationParams,
  currentSeed: string | null,
): { params: SimulationParams; seed: string | null } {
  return {
    params: completedResult?.simulationParams ?? currentParams,
    seed: completedResult?.simulationSeed ?? currentSeed,
  }
}

interface BuildMonteCarloSharePayloadOptions {
  mode: 'growth' | 'withdrawal'
  deterministicParams: GrowthState | WithdrawalState
  completedResult: CompletedRunMetadata | null | undefined
  currentParams: SimulationParams
  currentSeed: string | null
  logScales: SharePayload['logScales']
  showFullPrecision: boolean
  displayCurrency?: string
}

export function buildMonteCarloSharePayload({
  mode,
  deterministicParams,
  completedResult,
  currentParams,
  currentSeed,
  logScales,
  showFullPrecision,
  displayCurrency = 'USD',
}: BuildMonteCarloSharePayloadOptions): SharePayload {
  const completed = resolveCompletedSimulationMetadata(completedResult, currentParams, currentSeed)

  return {
    mode,
    type: 'monte-carlo',
    deterministicParams,
    mcParams: completed.params,
    rngSeed: completed.seed,
    logScales,
    showFullPrecision,
    displayCurrency,
  }
}

export function buildMonteCarloExportMetadata(
  completedResult: CompletedRunMetadata | null | undefined,
  currentParams: SimulationParams,
  currentSeed: string | null,
): {
  params: SimulationParams
  randomSeedRow: { Key: 'Random Seed'; Value: string }
} {
  const completed = resolveCompletedSimulationMetadata(completedResult, currentParams, currentSeed)
  return {
    params: completed.params,
    randomSeedRow: { Key: 'Random Seed', Value: completed.seed ?? '' },
  }
}

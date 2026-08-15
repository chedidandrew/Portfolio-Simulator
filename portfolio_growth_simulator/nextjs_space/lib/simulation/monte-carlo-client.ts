import type { SimulationParams } from '@/lib/types'
import type { SimulationResults } from './monte-carlo-engine'
import type { MonteCarloWorkerRequest, MonteCarloWorkerResponse } from './monte-carlo-worker-protocol'
import { stepsPerYear } from './financial-utils'
import {
  attachTimelineMetadata,
  buildTimelineRefinementPlan,
  mergeTimelineRefinement,
  type TimelineEnhancedResults,
} from './timeline-refinement'
import {
  clearSimulationProgress,
  publishSimulationProgress,
  subscribeSimulationCancel,
  type SimulationProgressPhase,
  type SimulationProgressSnapshot,
} from './simulation-progress-events'

function cancelledError(): Error {
  // An empty message lets existing callers treat cancellation as a silent stop.
  return new Error('')
}

async function runSingleMonteCarloOffMainThread(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed: string,
  signal?: AbortSignal,
): Promise<SimulationResults> {
  const fallback = async () => {
    const { performMonteCarloSimulationAsync } = await import('./monte-carlo-engine')
    if (signal?.aborted) throw cancelledError()
    const result = await performMonteCarloSimulationAsync(params, mode, seed)
    if (signal?.aborted) throw cancelledError()
    return result
  }

  if (typeof window === 'undefined' || typeof Worker === 'undefined') return fallback()

  let worker: Worker
  try {
    worker = new Worker(new URL('./monte-carlo-worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return fallback()
  }

  const id = `mc-${Date.now()}-${Math.random()}`
  const request: MonteCarloWorkerRequest = { id, params, mode, seed }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort)
      worker.terminate()
    }
    const handleAbort = () => {
      cleanup()
      reject(cancelledError())
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }
    signal?.addEventListener('abort', handleAbort, { once: true })

    worker.onmessage = (event: MessageEvent<MonteCarloWorkerResponse>) => {
      if (event.data.id !== id) return
      cleanup()
      if (event.data.error) reject(new Error(event.data.error))
      else if (event.data.result) resolve(event.data.result)
      else reject(new Error('The Monte Carlo worker returned no result.'))
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'The Monte Carlo worker stopped unexpectedly.'))
    }

    worker.postMessage(request)
  })
}

function estimateStageDurationMs(work: number): number {
  // This only drives the visible estimate. The worker controls completion.
  return Math.max(1_500, work / 5_000_000 * 1_000)
}

function phaseDetail(
  phase: SimulationProgressPhase,
  params: SimulationParams,
  timelineScenarioCount: number,
): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing seeded inputs and starting the calculation worker...'
    case 'running_scenarios':
      return `Calculating ${params.numPaths.toLocaleString()} independent portfolio paths...`
    case 'building_timeline':
      return `Building dense chart timelines from ${timelineScenarioCount.toLocaleString()} seeded paths...`
    case 'finalizing':
      return 'Sorting distributions, calculating percentiles, and preparing the result cards...'
    case 'cancelling':
      return 'Stopping the active browser worker and preserving your previous results...'
    case 'complete':
      return 'Simulation complete. Rendering charts and results...'
  }
}

async function runInteractiveMonteCarlo(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed: string,
): Promise<TimelineEnhancedResults> {
  const plan = buildTimelineRefinementPlan(params)
  const periodsPerScenario = Math.max(1, Math.round(params.duration * stepsPerYear(params.cashflowFrequency)))
  const totalPathPeriods = params.numPaths * periodsPerScenario
  const timelineScenarioCount = plan.required ? plan.samplePaths : params.numPaths
  const estimatedTimelinePointCount = plan.required ? plan.refinedPointCount : plan.primaryPointCount
  const runId = `mc-run-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const startedAt = Date.now()
  const controller = new AbortController()
  const executionMode: SimulationProgressSnapshot['executionMode'] = typeof Worker === 'undefined'
    ? 'Main thread fallback'
    : 'Web Worker'

  let currentPhase: SimulationProgressPhase = 'preparing'
  let phaseStartedAt = startedAt
  let phaseStartFraction = 0.01
  let phaseEndFraction = 0.03
  let phaseWork = Math.max(1, periodsPerScenario)
  let currentDetail = phaseDetail(currentPhase, params, timelineScenarioCount)
  let lastFraction = 0.01
  let timelinePointCount = estimatedTimelinePointCount

  const publish = (
    phase: SimulationProgressPhase,
    fraction: number,
    detail: string,
  ) => {
    lastFraction = Math.min(1, Math.max(0, fraction))
    publishSimulationProgress({
      runId,
      mode,
      phase,
      fraction: lastFraction,
      detail,
      scenarios: params.numPaths,
      duration: params.duration,
      frequency: params.cashflowFrequency,
      periodsPerScenario,
      totalPathPeriods,
      timelineScenarioCount,
      timelinePointCount,
      timelineUsesSample: plan.required,
      executionMode,
      seed,
      startedAt,
    })
  }

  const setPhase = (
    phase: SimulationProgressPhase,
    startFraction: number,
    endFraction: number,
    work: number,
  ) => {
    currentPhase = phase
    phaseStartedAt = Date.now()
    phaseStartFraction = startFraction
    phaseEndFraction = endFraction
    phaseWork = Math.max(1, work)
    currentDetail = phaseDetail(phase, params, timelineScenarioCount)
    publish(phase, startFraction, currentDetail)
  }

  const unsubscribeCancel = subscribeSimulationCancel((requestedRunId) => {
    if (requestedRunId !== runId || controller.signal.aborted) return
    currentPhase = 'cancelling'
    publish(
      'cancelling',
      Math.min(0.99, Math.max(0.02, lastFraction)),
      phaseDetail('cancelling', params, timelineScenarioCount),
    )
    controller.abort()
  })

  const timer = setInterval(() => {
    if (controller.signal.aborted || currentPhase === 'cancelling' || currentPhase === 'complete') return
    const elapsed = Date.now() - phaseStartedAt
    const expected = estimateStageDurationMs(phaseWork)
    const curve = Math.min(0.97, 1 - Math.exp(-elapsed / expected))
    publish(
      currentPhase,
      phaseStartFraction + (phaseEndFraction - phaseStartFraction) * curve,
      currentDetail,
    )
  }, 400)

  publish('preparing', 0.01, currentDetail)

  try {
    setPhase('running_scenarios', 0.03, plan.required ? 0.90 : 0.96, totalPathPeriods)
    const fullResults = await runSingleMonteCarloOffMainThread(params, mode, seed, controller.signal)

    let enhancedResults: TimelineEnhancedResults
    if (plan.required) {
      setPhase('building_timeline', 0.90, 0.975, plan.additionalWork)
      const timelineResults = await runSingleMonteCarloOffMainThread(
        { ...params, numPaths: plan.samplePaths },
        mode,
        seed,
        controller.signal,
      )
      enhancedResults = mergeTimelineRefinement(fullResults, timelineResults)
    } else {
      enhancedResults = attachTimelineMetadata(fullResults)
    }

    if (controller.signal.aborted) throw cancelledError()
    timelinePointCount = enhancedResults.timelinePointCount
    setPhase('finalizing', 0.975, 0.995, Math.max(1, timelinePointCount))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (controller.signal.aborted) throw cancelledError()

    currentPhase = 'complete'
    publish('complete', 1, phaseDetail('complete', params, timelineScenarioCount))
    return enhancedResults
  } finally {
    clearInterval(timer)
    unsubscribeCancel()
    window.setTimeout(() => clearSimulationProgress(runId), 150)
  }
}

export async function runMonteCarloOffMainThread(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed: string,
  signal?: AbortSignal,
): Promise<SimulationResults> {
  // Sensitivity analysis supplies its own signal and stays silent. The main
  // simulation has no external signal, so it receives progress, cancellation,
  // and the bounded dense-timeline refinement pass.
  if (signal || typeof window === 'undefined') {
    return runSingleMonteCarloOffMainThread(params, mode, seed, signal)
  }
  return runInteractiveMonteCarlo(params, mode, seed)
}

export type RunMonteCarlo = typeof runMonteCarloOffMainThread

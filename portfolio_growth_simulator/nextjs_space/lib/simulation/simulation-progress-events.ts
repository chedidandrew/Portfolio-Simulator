import type { CashflowFrequency } from '../types'

export type SimulationProgressPhase =
  | 'preparing'
  | 'running_scenarios'
  | 'building_timeline'
  | 'finalizing'
  | 'cancelling'
  | 'complete'

export interface SimulationProgressSnapshot {
  runId: string
  mode: 'growth' | 'withdrawal'
  phase: SimulationProgressPhase
  fraction: number
  detail: string
  scenarios: number
  duration: number
  frequency: CashflowFrequency
  periodsPerScenario: number
  totalPathPeriods: number
  timelineScenarioCount: number
  timelinePointCount: number
  timelineUsesSample: boolean
  executionMode: 'Web Worker' | 'Main thread fallback'
  seed: string
  startedAt: number
}

const UPDATE_EVENT = 'portfolio-simulator:simulation-progress'
const CLEAR_EVENT = 'portfolio-simulator:simulation-progress-clear'
const CANCEL_EVENT = 'portfolio-simulator:simulation-cancel'

let currentSnapshot: SimulationProgressSnapshot | null = null

export function publishSimulationProgress(snapshot: SimulationProgressSnapshot): void {
  currentSnapshot = snapshot
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SimulationProgressSnapshot>(UPDATE_EVENT, { detail: snapshot }))
}

export function clearSimulationProgress(runId: string): void {
  if (currentSnapshot?.runId === runId) currentSnapshot = null
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(CLEAR_EVENT, { detail: runId }))
}

export function getCurrentSimulationProgress(): SimulationProgressSnapshot | null {
  return currentSnapshot
}

export function subscribeSimulationProgress(
  onUpdate: (snapshot: SimulationProgressSnapshot) => void,
  onClear: (runId: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined

  const handleUpdate = (event: Event) => {
    onUpdate((event as CustomEvent<SimulationProgressSnapshot>).detail)
  }
  const handleClear = (event: Event) => {
    onClear((event as CustomEvent<string>).detail)
  }

  window.addEventListener(UPDATE_EVENT, handleUpdate)
  window.addEventListener(CLEAR_EVENT, handleClear)
  return () => {
    window.removeEventListener(UPDATE_EVENT, handleUpdate)
    window.removeEventListener(CLEAR_EVENT, handleClear)
  }
}

export function requestSimulationCancel(runId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(CANCEL_EVENT, { detail: runId }))
}

export function subscribeSimulationCancel(onCancel: (runId: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handleCancel = (event: Event) => {
    onCancel((event as CustomEvent<string>).detail)
  }
  window.addEventListener(CANCEL_EVENT, handleCancel)
  return () => window.removeEventListener(CANCEL_EVENT, handleCancel)
}

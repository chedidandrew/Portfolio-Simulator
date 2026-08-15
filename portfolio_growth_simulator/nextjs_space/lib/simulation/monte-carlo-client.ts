import type { SimulationParams } from '@/lib/types'
import type { SimulationResults } from './monte-carlo-engine'
import type { MonteCarloWorkerRequest, MonteCarloWorkerResponse } from './monte-carlo-worker-protocol'

export async function runMonteCarloOffMainThread(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed: string,
  signal?: AbortSignal,
): Promise<SimulationResults> {
  const fallback = async () => {
    const { performMonteCarloSimulationAsync } = await import('./monte-carlo-engine')
    if (signal?.aborted) throw new Error('Simulation cancelled.')
    return performMonteCarloSimulationAsync(params, mode, seed)
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
      reject(new Error('Simulation cancelled.'))
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

export type RunMonteCarlo = typeof runMonteCarloOffMainThread

import { performMonteCarloSimulation } from './monte-carlo-engine'
import type { MonteCarloWorkerRequest, MonteCarloWorkerResponse } from './monte-carlo-worker-protocol'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MonteCarloWorkerRequest>) => void) | null
  postMessage: (message: MonteCarloWorkerResponse) => void
}

workerScope.onmessage = (event) => {
  const { id, params, mode, seed } = event.data
  try {
    const result = performMonteCarloSimulation(params, mode, seed)
    workerScope.postMessage({ id, result })
  } catch (error) {
    workerScope.postMessage({
      id,
      error: error instanceof Error ? error.message : 'The simulation could not be completed.',
    })
  }
}

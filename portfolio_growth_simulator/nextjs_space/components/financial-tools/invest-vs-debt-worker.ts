import {
  compareInvestVsDebt,
  type InvestVsDebtInputs,
  type InvestVsDebtResult,
} from '../../lib/financial-tools/invest-vs-debt'

type WorkerRequest = {
  id: number
  inputs: InvestVsDebtInputs
}

type WorkerResponse =
  | { id: number; type: 'progress'; completed: number; total: number }
  | { id: number; type: 'result'; result: InvestVsDebtResult }
  | { id: number; type: 'error'; message: string }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

workerScope.onmessage = (event) => {
  const { id, inputs } = event.data
  try {
    const result = compareInvestVsDebt(inputs, (completed, total) => {
      workerScope.postMessage({ id, type: 'progress', completed, total })
    })
    workerScope.postMessage({ id, type: 'result', result })
  } catch (error) {
    workerScope.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'The comparison could not be completed.',
    })
  }
}

export {}

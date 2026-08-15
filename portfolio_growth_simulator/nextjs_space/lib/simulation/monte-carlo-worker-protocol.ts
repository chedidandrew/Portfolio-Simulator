import type { SimulationParams } from '@/lib/types'
import type { SimulationResults } from './monte-carlo-engine'

export interface MonteCarloWorkerRequest {
  id: string
  params: SimulationParams
  mode: 'growth' | 'withdrawal'
  seed: string
}

export interface MonteCarloWorkerResponse {
  id: string
  result?: SimulationResults
  error?: string
}

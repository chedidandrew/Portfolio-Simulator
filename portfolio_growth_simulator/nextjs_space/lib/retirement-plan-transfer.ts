import type { SimulationParams, WithdrawalState } from './types'
import { isValidSimulationParams, validateWithdrawalStateRange } from './simulation/deterministic-validation'

export const APPLY_RETIREMENT_PLAN_EVENT = 'portfolio-simulator:apply-retirement-plan'
const PENDING_TRANSFER_KEY = 'portfolio-simulator:pending-retirement-plan'

export interface RetirementPlanTransfer {
  requestId: string
  seed: string
  state: WithdrawalState
  params: SimulationParams
}

function isRetirementPlanTransfer(value: unknown): value is RetirementPlanTransfer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<RetirementPlanTransfer>
  return typeof candidate.requestId === 'string'
    && candidate.requestId.length > 0
    && typeof candidate.seed === 'string'
    && candidate.seed.length > 0
    && Boolean(candidate.state)
    && validateWithdrawalStateRange(candidate.state as WithdrawalState) === null
    && isValidSimulationParams(candidate.params)
}

export function dispatchRetirementPlanTransfer(transfer: RetirementPlanTransfer): void {
  if (typeof window === 'undefined' || !isRetirementPlanTransfer(transfer)) return
  try {
    window.sessionStorage.setItem(PENDING_TRANSFER_KEY, JSON.stringify(transfer))
  } catch {
    // The event still supports the currently mounted page if session storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<RetirementPlanTransfer>(APPLY_RETIREMENT_PLAN_EVENT, { detail: transfer }))
}

export function consumePendingRetirementPlanTransfer(): RetirementPlanTransfer | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PENDING_TRANSFER_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(PENDING_TRANSFER_KEY)
    const parsed: unknown = JSON.parse(raw)
    return isRetirementPlanTransfer(parsed) ? parsed : null
  } catch {
    try {
      window.sessionStorage.removeItem(PENDING_TRANSFER_KEY)
    } catch {}
    return null
  }
}

export function clearPendingRetirementPlanTransfer(requestId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.sessionStorage.getItem(PENDING_TRANSFER_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (isRetirementPlanTransfer(parsed) && parsed.requestId === requestId) {
      window.sessionStorage.removeItem(PENDING_TRANSFER_KEY)
    }
  } catch {
    try {
      window.sessionStorage.removeItem(PENDING_TRANSFER_KEY)
    } catch {}
  }
}

export function subscribeRetirementPlanTransfer(
  listener: (transfer: RetirementPlanTransfer) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => {
    const transfer = (event as CustomEvent<unknown>).detail
    if (isRetirementPlanTransfer(transfer)) listener(transfer)
  }
  window.addEventListener(APPLY_RETIREMENT_PLAN_EVENT, handler)
  return () => window.removeEventListener(APPLY_RETIREMENT_PLAN_EVENT, handler)
}

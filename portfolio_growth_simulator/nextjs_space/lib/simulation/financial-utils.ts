import type { GrowthState, SimulationParams, WithdrawalState } from '../types'

export type CashflowFrequency = GrowthState['frequency'] | WithdrawalState['frequency'] | SimulationParams['cashflowFrequency']
export type TaxType = NonNullable<GrowthState['taxType']>

export const MAX_MONTE_CARLO_WORK = 20_000_000
export const MAX_RECORDED_VALUES = 600_000
export const MAX_CHART_POINTS = 300

export function stepsPerYear(frequency: CashflowFrequency): number {
  switch (frequency) {
    case 'weekly': return 52
    case 'monthly': return 12
    case 'quarterly': return 4
    default: return 1
  }
}

export function normalizeTaxRate(rate: number | undefined): number {
  if (!Number.isFinite(rate)) return 0
  return Math.max(0, Math.min(99, Number(rate))) / 100
}

export function validateAnnualRate(ratePct: number): void {
  if (!Number.isFinite(ratePct)) throw new Error('Expected return must be a finite number.')
  if (ratePct < -100) throw new Error('Expected return cannot be below -100%.')
}

/**
 * Annual income tax drag is a simplified haircut on positive expected growth.
 * It deliberately does not turn a negative expected return into a smaller loss.
 */
export function annualReturnAfterIncomeTaxDrag(
  annualReturnPct: number,
  taxEnabled: boolean | undefined,
  taxType: TaxType | undefined,
  taxRatePct: number | undefined,
): number {
  if (!taxEnabled || taxType !== 'income' || annualReturnPct <= 0) return annualReturnPct
  return annualReturnPct * (1 - normalizeTaxRate(taxRatePct))
}

export function effectiveAnnualReturnFromInput(
  annualReturnPct: number,
  periodsPerYear: number,
  calculationMode: 'effective' | 'nominal' | undefined,
): number {
  validateAnnualRate(annualReturnPct)
  if (calculationMode === 'nominal') {
    const periodic = annualReturnPct / 100 / periodsPerYear
    if (periodic <= -1) throw new Error('The nominal rate is too negative for the selected frequency.')
    return Math.pow(1 + periodic, periodsPerYear) - 1
  }
  return annualReturnPct / 100
}

export function periodicRate(
  annualReturnPct: number,
  periodsPerYear: number,
  calculationMode: 'effective' | 'nominal' | undefined,
): number {
  validateAnnualRate(annualReturnPct)
  if (calculationMode === 'nominal') return annualReturnPct / 100 / periodsPerYear
  const annual = annualReturnPct / 100
  if (annual === -1) return -1
  return Math.pow(1 + annual, 1 / periodsPerYear) - 1
}

export function netLiquidationValue(args: {
  balance: number
  basis: number
  taxEnabled?: boolean
  taxType?: TaxType
  taxRate?: number
}): number {
  const balance = Math.max(0, Number.isFinite(args.balance) ? args.balance : 0)
  if (!args.taxEnabled) return balance

  const rate = normalizeTaxRate(args.taxRate)
  if (args.taxType === 'tax_deferred') return balance * (1 - rate)
  if (args.taxType === 'capital_gains') {
    return balance - Math.max(0, balance - Math.max(0, args.basis)) * rate
  }
  return balance
}

export function embeddedTaxLiability(args: {
  balance: number
  basis: number
  taxEnabled?: boolean
  taxType?: TaxType
  taxRate?: number
}): number {
  return Math.max(0, args.balance - netLiquidationValue(args))
}

export function proportionalCapitalGainsTax(
  balance: number,
  basis: number,
  grossWithdrawal: number,
  taxRatePct: number | undefined,
): number {
  if (balance <= 0 || grossWithdrawal <= 0) return 0
  const gainFraction = Math.max(0, balance - Math.max(0, basis)) / balance
  return grossWithdrawal * gainFraction * normalizeTaxRate(taxRatePct)
}

export function reduceBasisProportionally(balanceBefore: number, basisBefore: number, grossWithdrawal: number): number {
  if (balanceBefore <= 0) return 0
  const fractionRemaining = Math.max(0, 1 - Math.min(1, grossWithdrawal / balanceBefore))
  return Math.max(0, basisBefore) * fractionRemaining
}

export function inflationFactor(ratePct: number | undefined): number {
  const rate = Number.isFinite(ratePct) ? Number(ratePct) : 0
  if (rate <= -100) throw new Error('Inflation must be greater than -100%.')
  return 1 + rate / 100
}

export function toTodaysDollars(value: number, inflationRatePct: number | undefined, years: number): number {
  return value / Math.pow(inflationFactor(inflationRatePct), Math.max(0, years))
}

export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]
  const p = Math.max(0, Math.min(1, percentile))
  const index = p * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedValues[lower]
  const weight = index - lower
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export function assertFiniteResult(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} exceeded the supported numeric range.`)
  return value
}

export function assertMonteCarloWorkload(numPaths: number, duration: number, periodsPerYear: number): void {
  if (!Number.isInteger(numPaths) || numPaths < 1) throw new Error('Number of scenarios must be a positive whole number.')
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Duration must be greater than zero.')
  const work = numPaths * Math.ceil(duration * periodsPerYear)
  if (!Number.isSafeInteger(work) || work > MAX_MONTE_CARLO_WORK) {
    throw new Error(
      `This request contains ${Math.round(work).toLocaleString()} path-period calculations. ` +
      `Reduce scenarios, duration, or cashflow frequency so the total is ${MAX_MONTE_CARLO_WORK.toLocaleString()} or less.`
    )
  }
}

/** Lightweight deterministic PRNG so CPU results do not depend on a third-party RNG. */
export function createSeededRandom(seedText: string): () => number {
  let state = 0x811c9dc5
  for (let i = 0; i < seedText.length; i += 1) {
    state ^= seedText.charCodeAt(i)
    state = Math.imul(state, 0x01000193)
  }
  state >>>= 0
  if (state === 0) state = 0x6d2b79f5

  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function normalRandom(random: () => number): number {
  let u = 0
  let v = 0
  while (u <= Number.EPSILON) u = random()
  while (v <= Number.EPSILON) v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function poissonRandom(lambda: number, random: () => number): number {
  if (lambda <= 0) return 0
  const limit = Math.exp(-lambda)
  let product = 1
  let count = 0
  do {
    count += 1
    product *= random()
  } while (product > limit && count < 100)
  return count - 1
}
